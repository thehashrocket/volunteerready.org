import { TRPCError } from '@trpc/server';
import Stripe from 'stripe';
import type { PlanTier, Prisma } from '@/prisma/generated/client';
import { writeAuditLogTx } from '../repositories/auditRepo';
import {
	findCompanyByStripeCustomerId,
	findCompanyWithOwnerEmail,
	updateCompanyPlanTx,
} from '../repositories/companyRepo';
import {
	findOrgByStripeCustomerId,
	findOrgWithOwnerEmail,
	updateOrgPlanTx,
} from '../repositories/orgRepo';
import { prisma } from '../repositories/prisma';
import {
	sendCancellationEmail,
	sendPaymentFailedEmail,
	sendPlanUpgradeEmail,
} from '../repositories/send-billing-emails';
import {
	isWebhookEventProcessed,
	markWebhookEventProcessedTx,
} from '../repositories/webhookRepo';

// ---------------------------------------------------------------------------
// Stripe singleton — only file that imports Stripe
// Lazy-initialized so Next.js build-time module evaluation doesn't fail when
// STRIPE_SECRET_KEY is absent from the build environment.
// ---------------------------------------------------------------------------

let _stripe: Stripe | null = null;
function getStripe(): Stripe {
	if (!_stripe) {
		const key = process.env.STRIPE_SECRET_KEY;
		if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
		_stripe = new Stripe(key, { apiVersion: '2026-02-25.clover' });
	}
	return _stripe;
}

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? '';

// ---------------------------------------------------------------------------
// Price ID <-> tier mapping — single source of truth
//
// Both conversion functions are derived from PRICE_MAP. Adding a new tier
// requires one change here only.
// ---------------------------------------------------------------------------

const PRICE_MAP: Record<'STARTER' | 'PRO', string> = {
	STARTER: process.env.STRIPE_PRICE_ID_STARTER ?? '',
	PRO: process.env.STRIPE_PRICE_ID_PRO ?? '',
};

function getPriceIdForTier(tier: 'STARTER' | 'PRO'): string {
	const id = PRICE_MAP[tier];
	if (!id)
		throw new Error(`Missing STRIPE_PRICE_ID_${tier} environment variable`);
	return id;
}

function mapPriceIdToTier(priceId: string): PlanTier {
	const entry = Object.entries(PRICE_MAP).find(([, id]) => id === priceId);
	if (!entry) throw new Error(`Unknown Stripe price ID: ${priceId}`);
	return entry[0] as PlanTier;
}

// ---------------------------------------------------------------------------
// Resolve entity (org or company) by Stripe customer ID.
// Returns null for unknown customers — caller logs and returns 200 to Stripe.
// ---------------------------------------------------------------------------

async function resolveEntityByCustomerId(customerId: string) {
	const org = await findOrgByStripeCustomerId(customerId);
	if (org) return { type: 'org' as const, id: org.id };

	const company = await findCompanyByStripeCustomerId(customerId);
	if (company) return { type: 'company' as const, id: company.id };

	return null;
}

// Record a webhook event outside of a transaction (for cases where there's no
// plan update to be atomic with, e.g. unknown customers or unsupported events).
async function recordEvent(event: Stripe.Event) {
	await prisma.stripeWebhookEvent.create({
		data: {
			stripeId: event.id,
			type: event.type,
			payload: JSON.parse(JSON.stringify(event)) as Prisma.InputJsonValue,
		},
	});
}

// ---------------------------------------------------------------------------
// Billing email helper — fire-and-forget (never crashes the webhook handler)
// ---------------------------------------------------------------------------

async function trySendBillingEmail(
	entity: { type: 'org' | 'company'; id: string },
	sendFn: (opts: { to: string; orgName: string }) => Promise<void>,
	label: string,
) {
	try {
		let ownerEmail: string | null | undefined;
		let name: string | undefined;

		if (entity.type === 'org') {
			const org = await findOrgWithOwnerEmail(entity.id);
			ownerEmail = org?.members[0]?.user?.email;
			name = org?.name;
		} else {
			const company = await findCompanyWithOwnerEmail(entity.id);
			ownerEmail = company?.members[0]?.user?.email;
			name = company?.name;
		}

		if (ownerEmail && name) {
			await sendFn({ to: ownerEmail, orgName: name });
		}
	} catch (e) {
		console.error(`[billing] Failed to send ${label} email`, e);
	}
}

// ---------------------------------------------------------------------------
// Checkout session
// ---------------------------------------------------------------------------

export async function createCheckoutSession(opts: {
	orgId: string;
	email: string;
	tier: 'STARTER' | 'PRO';
	successUrl: string;
	cancelUrl: string;
}) {
	const org = await prisma.organization.findUniqueOrThrow({
		where: { id: opts.orgId },
		select: { id: true, stripeCustomerId: true },
	});

	let customerId = org.stripeCustomerId;

	if (!customerId) {
		const customer = await getStripe().customers.create({
			email: opts.email,
			metadata: { orgId: opts.orgId },
		});
		customerId = customer.id;

		// Persist immediately so next checkout attempt reuses the customer
		await prisma.organization.update({
			where: { id: opts.orgId },
			data: { stripeCustomerId: customerId },
		});
	}

	const session = await getStripe().checkout.sessions.create({
		customer: customerId,
		line_items: [{ price: getPriceIdForTier(opts.tier), quantity: 1 }],
		mode: 'subscription',
		success_url: opts.successUrl,
		cancel_url: opts.cancelUrl,
	});

	return { checkoutUrl: session.url };
}

// ---------------------------------------------------------------------------
// Billing portal
// ---------------------------------------------------------------------------

export async function createBillingPortalSession(opts: {
	orgId: string;
	returnUrl: string;
}) {
	const org = await prisma.organization.findUniqueOrThrow({
		where: { id: opts.orgId },
		select: { stripeCustomerId: true },
	});

	if (!org.stripeCustomerId) {
		throw new TRPCError({
			code: 'BAD_REQUEST',
			message:
				'No billing account set up yet. Please start a subscription first.',
		});
	}

	const session = await getStripe().billingPortal.sessions.create({
		customer: org.stripeCustomerId,
		return_url: opts.returnUrl,
	});

	return { portalUrl: session.url };
}

// ---------------------------------------------------------------------------
// Webhook handler
// ---------------------------------------------------------------------------

export async function handleStripeWebhookEvent(
	rawBody: Buffer,
	signature: string,
) {
	// Throws Stripe.errors.StripeSignatureVerificationError on bad signature
	const event = getStripe().webhooks.constructEvent(
		rawBody,
		signature,
		STRIPE_WEBHOOK_SECRET,
	);

	await processStripeEvent(event);
}

// ---------------------------------------------------------------------------
// Core event processor — used by both webhook handler and reconciliation.
// Extracted so reconciliation can replay events from Stripe list API without
// signature verification.
// ---------------------------------------------------------------------------

export async function processStripeEvent(
	event: Stripe.Event,
	opts?: { skipEmails?: boolean },
): Promise<{ action: string }> {
	const skipEmails = opts?.skipEmails ?? false;

	// Early return if already processed (optimization — UNIQUE constraint is safety net)
	if (await isWebhookEventProcessed(event.id)) {
		return { action: 'already_processed' };
	}

	switch (event.type) {
		case 'customer.subscription.created':
		case 'customer.subscription.updated': {
			const subscription = event.data.object as Stripe.Subscription;
			const customerId = subscription.customer as string;
			const priceId = subscription.items.data[0]?.price.id;

			if (!priceId) {
				console.warn(
					`[billing] No price ID on subscription ${subscription.id}`,
				);
				await recordEvent(event);
				return { action: 'skipped_no_price' };
			}

			const entity = await resolveEntityByCustomerId(customerId);
			if (!entity) {
				console.warn(
					`[billing] Unknown Stripe customer ${customerId} — skipping`,
				);
				await recordEvent(event);
				return { action: 'skipped_unknown_customer' };
			}

			const newTier = mapPriceIdToTier(priceId);

			await prisma.$transaction(async (tx) => {
				await markWebhookEventProcessedTx(tx, {
					stripeId: event.id,
					type: event.type,
					payload: JSON.parse(JSON.stringify(event)) as Prisma.InputJsonValue,
				});

				if (entity.type === 'org') {
					await updateOrgPlanTx(tx, entity.id, {
						planTier: newTier,
						stripeSubscriptionId: subscription.id,
					});
					await writeAuditLogTx(tx, {
						orgId: entity.id,
						action: 'PLAN_UPDATED',
						entityType: 'Organization',
						entityId: entity.id,
						metadata: { planTier: newTier, stripeEventId: event.id },
					});
				} else {
					await updateCompanyPlanTx(tx, entity.id, {
						planTier: newTier,
						stripeSubscriptionId: subscription.id,
					});
					await writeAuditLogTx(tx, {
						companyId: entity.id,
						action: 'PLAN_UPDATED',
						entityType: 'CompanyAccount',
						entityId: entity.id,
						metadata: { planTier: newTier, stripeEventId: event.id },
					});
				}
			});

			if (!skipEmails && event.type === 'customer.subscription.created') {
				await trySendBillingEmail(
					entity,
					(opts) => sendPlanUpgradeEmail({ ...opts, tier: newTier }),
					'upgrade',
				);
			}
			return { action: 'plan_updated' };
		}

		case 'customer.subscription.deleted': {
			const subscription = event.data.object as Stripe.Subscription;
			const customerId = subscription.customer as string;

			const entity = await resolveEntityByCustomerId(customerId);
			if (!entity) {
				console.warn(
					`[billing] Unknown Stripe customer ${customerId} — skipping`,
				);
				await recordEvent(event);
				return { action: 'skipped_unknown_customer' };
			}

			const priceId = subscription.items.data[0]?.price.id;
			let previousTier: PlanTier = 'STARTER';
			if (priceId) {
				try {
					previousTier = mapPriceIdToTier(priceId);
				} catch {
					// Unknown price — fall back to STARTER for email display
				}
			}

			await prisma.$transaction(async (tx) => {
				await markWebhookEventProcessedTx(tx, {
					stripeId: event.id,
					type: event.type,
					payload: JSON.parse(JSON.stringify(event)) as Prisma.InputJsonValue,
				});

				if (entity.type === 'org') {
					await updateOrgPlanTx(tx, entity.id, {
						planTier: 'FREE',
						stripeSubscriptionId: null,
					});
					await writeAuditLogTx(tx, {
						orgId: entity.id,
						action: 'PLAN_DOWNGRADED',
						entityType: 'Organization',
						entityId: entity.id,
						metadata: { planTier: 'FREE', stripeEventId: event.id },
					});
				} else {
					await updateCompanyPlanTx(tx, entity.id, {
						planTier: 'FREE',
						stripeSubscriptionId: null,
					});
					await writeAuditLogTx(tx, {
						companyId: entity.id,
						action: 'PLAN_DOWNGRADED',
						entityType: 'CompanyAccount',
						entityId: entity.id,
						metadata: { planTier: 'FREE', stripeEventId: event.id },
					});
				}
			});

			if (!skipEmails) {
				await trySendBillingEmail(
					entity,
					(opts) => sendCancellationEmail({ ...opts, previousTier }),
					'cancellation',
				);
			}
			return { action: 'plan_downgraded' };
		}

		case 'invoice.payment_failed': {
			const invoice = event.data.object as Stripe.Invoice;
			const customerId = invoice.customer as string;
			console.warn(
				`[billing] Payment failed for customer ${customerId} — invoice ${invoice.id}`,
			);

			const entity = await resolveEntityByCustomerId(customerId);
			if (!skipEmails && entity) {
				await trySendBillingEmail(
					entity,
					sendPaymentFailedEmail,
					'payment-failed',
				);
			}

			await recordEvent(event);
			return { action: 'payment_failed_recorded' };
		}

		default:
			await recordEvent(event);
			return { action: 'unknown_event_recorded' };
	}
}

// ---------------------------------------------------------------------------
// Stripe reconciliation — admin-triggered, replays missed events
// ---------------------------------------------------------------------------

export async function reconcileStripeEvents(opts: {
	windowHours: number;
}): Promise<{
	eventsChecked: number;
	eventsReplayed: number;
	eventsFailed: number;
	alreadyProcessed: number;
	details: Array<{
		eventId: string;
		type: string;
		status: string;
		timestamp: string;
	}>;
}> {
	const stripe = getStripe();
	const since = Math.floor(
		(Date.now() - opts.windowHours * 60 * 60 * 1000) / 1000,
	);

	let eventsChecked = 0;
	let eventsReplayed = 0;
	let eventsFailed = 0;
	let alreadyProcessed = 0;
	const details: Array<{
		eventId: string;
		type: string;
		status: string;
		timestamp: string;
	}> = [];

	let hasMore = true;
	let startingAfter: string | undefined;

	while (hasMore) {
		const listParams: Stripe.EventListParams = {
			created: { gte: since },
			limit: 100,
		};
		if (startingAfter) {
			listParams.starting_after = startingAfter;
		}

		const events = await stripe.events.list(listParams);
		eventsChecked += events.data.length;

		for (const event of events.data) {
			const isProcessed = await isWebhookEventProcessed(event.id);

			if (isProcessed) {
				alreadyProcessed++;
				details.push({
					eventId: event.id,
					type: event.type,
					status: 'already_processed',
					timestamp: new Date(event.created * 1000).toISOString(),
				});
				continue;
			}

			try {
				const result = await processStripeEvent(event, {
					skipEmails: true,
				});
				eventsReplayed++;
				details.push({
					eventId: event.id,
					type: event.type,
					status: `replayed:${result.action}`,
					timestamp: new Date(event.created * 1000).toISOString(),
				});
			} catch (e) {
				eventsFailed++;
				console.error(`[reconcile] Failed to replay event ${event.id}`, e);
				details.push({
					eventId: event.id,
					type: event.type,
					status: `failed:${e instanceof Error ? e.message : 'unknown'}`,
					timestamp: new Date(event.created * 1000).toISOString(),
				});
			}

			// Rate limit: ~10 req/sec (sleep 100ms between events)
			await new Promise((resolve) => setTimeout(resolve, 100));
		}

		hasMore = events.has_more;
		if (events.data.length > 0) {
			startingAfter = events.data[events.data.length - 1]?.id;
		}
	}

	return {
		eventsChecked,
		eventsReplayed,
		eventsFailed,
		alreadyProcessed,
		details,
	};
}
