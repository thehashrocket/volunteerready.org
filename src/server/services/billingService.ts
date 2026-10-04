import { TRPCError } from '@trpc/server';
import Stripe from 'stripe';
import type { PlanTier, Prisma } from '@/prisma/generated/client';
import { PLAN_TIER_RANK } from '@/server/domain/billing';
import { sendUnknownStripePriceAlert } from '@/server/lib/admin-alerts';
import { writeAuditLogTx } from '../repositories/auditRepo';
import {
	findCompanyByStripeCustomerId,
	findCompanyWithOwnerEmail,
	updateCompanyPlanTx,
} from '../repositories/companyRepo';
import {
	claimOrgStripeCustomerId,
	findOrgBillingFields,
	findOrgByStripeCustomerId,
	findOrgStripeCustomerId,
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
	lockStripeCustomerTx,
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
		// Pins the shape of OUTBOUND calls only. Webhook payloads arrive at the
		// API version set on the endpoint in the Stripe dashboard, and
		// events.list returns each event at the version it was created with.
		_stripe = new Stripe(key, { apiVersion: '2026-09-30.endive' });
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

class UnknownStripePriceError extends Error {
	constructor(readonly priceId: string) {
		super(`Unknown Stripe price ID: ${priceId}`);
	}
}

function mapPriceIdToTier(priceId: string): PlanTier {
	const entry = Object.entries(PRICE_MAP).find(([, id]) => id === priceId);
	if (!entry) throw new UnknownStripePriceError(priceId);
	return entry[0] as PlanTier;
}

// Stripe retries a failed event for up to three days, sending the same event
// again each time. Alert only while the event is fresh, so a retry days later
// does not email again. This limits alerts per event, not per price: a wrong
// STRIPE_PRICE_ID_* fails every fresh event on that tier, and each can be
// delivered more than once in its first hour, so expect several emails.
const UNKNOWN_PRICE_ALERT_WINDOW_SECONDS = 60 * 60;

// ---------------------------------------------------------------------------
// Resolve entity (org or company) by Stripe customer ID.
// Returns null for unknown customers — caller logs and returns 200 to Stripe.
// ---------------------------------------------------------------------------

async function resolveEntityByCustomerId(customerId: string) {
	const org = await findOrgByStripeCustomerId(customerId);
	if (org) return { type: 'org' as const, ...org };

	const company = await findCompanyByStripeCustomerId(customerId);
	if (company) return { type: 'company' as const, ...company };

	return null;
}

// ---------------------------------------------------------------------------
// Subscription state
//
// past_due keeps the paid tier: Stripe is still retrying the card, and its
// retry schedule ends by moving the subscription to unpaid or canceled, which
// drop the tier. That ending is a dashboard setting (Billing → Revenue
// recovery → "If all retries fail"); set to leave the subscription past_due,
// a card that never pays would keep the tier. See docs/post-deploy-checks.md.
// incomplete, incomplete_expired, unpaid, paused and canceled grant nothing.
// ---------------------------------------------------------------------------

const ENTITLED_STATUSES: ReadonlySet<Stripe.Subscription.Status> = new Set([
	'active',
	'trialing',
	'past_due',
]);

// Stripe calls made while a webhook, checkout or the /app/billing page waits
// fail fast: a slow Stripe API turns into a 500 that Stripe retries (webhook),
// a retryable error (checkout), or the stored-subscription fallback (billing
// page) rather than a hung function.
const FAIL_FAST: Stripe.RequestOptions = {
	timeout: 10_000,
	maxNetworkRetries: 1,
};

// A customer can hold more than one live subscription (one left over from an
// earlier plan, or two checkouts that raced), so the tier is decided per
// customer, never per event: Stripe does not guarantee event order, and
// reconciliation replays newest first, so no single event's snapshot can be
// trusted. Without a status filter Stripe lists every subscription except
// canceled ones; any failure throws, the webhook answers 500 and Stripe
// retries the event.
async function listLiveSubscriptions(
	customerId: string,
): Promise<Stripe.Subscription[]> {
	return getStripe()
		.subscriptions.list({ customer: customerId, limit: 100 }, FAIL_FAST)
		.autoPagingToArray({ limit: 1000 });
}

async function listEntitledSubscriptions(
	customerId: string,
): Promise<Stripe.Subscription[]> {
	const subscriptions = await listLiveSubscriptions(customerId);
	return subscriptions.filter((s) => ENTITLED_STATUSES.has(s.status));
}

// A new checkout is allowed only beside subscriptions that can never bill
// again. Every other status blocks it, including an unpaid, paused or
// incomplete one that grants nothing today: paying its open invoice turns it
// active (an incomplete one within 23 hours), and the customer would be billed
// twice. Listing the final statuses rather than the blocking ones means a
// status Stripe adds later blocks checkout instead of slipping through.
const FINAL_STATUSES: ReadonlySet<Stripe.Subscription.Status> = new Set([
	'canceled',
	'incomplete_expired',
]);

function couldStillBill(subscription: Stripe.Subscription): boolean {
	return !FINAL_STATUSES.has(subscription.status);
}

// When an org has several subscriptions that could still bill, the billing
// page explains the one that matters most: a paying one first, then the ones
// that need action.
const STATUS_PRIORITY: Stripe.Subscription.Status[] = [
	'active',
	'trialing',
	'past_due',
	'unpaid',
	'paused',
	'incomplete',
];

export type OrgBillingStatus = {
	planTier: PlanTier;
	trialEndsAt: Date | null;
	hasStripeCustomer: boolean;
	/** True when a subscription could still bill, so checkout would refuse. */
	hasSubscription: boolean;
	/** The status that subscription is in, or 'unknown' if Stripe could not be asked. */
	subscriptionStatus: Stripe.Subscription.Status | 'unknown' | null;
};

/**
 * The org's plan from the database alone, for the many components that only
 * need the tier (PlanGate, background checks). No Stripe call: these render
 * on ordinary pages and refetch on every focus. `hasSubscription` reflects the
 * stored paying subscription only; /app/billing uses `getOrgBillingStatus`,
 * which asks Stripe.
 */
export async function getOrgPlanStatus(
	orgId: string,
): Promise<Omit<OrgBillingStatus, 'subscriptionStatus'>> {
	const org = await findOrgBillingFields(orgId);
	return {
		planTier: org.planTier,
		trialEndsAt: org.trialEndsAt,
		hasStripeCustomer: org.stripeCustomerId !== null,
		hasSubscription: org.stripeSubscriptionId !== null,
	};
}

/**
 * What /app/billing shows. `hasSubscription` asks Stripe with the same rule
 * checkout refuses on, so the page never offers an upgrade that checkout will
 * refuse: an unpaid, paused or incomplete subscription leaves the org on FREE
 * with no stored `stripeSubscriptionId`, yet still blocks a new checkout. If
 * Stripe cannot be reached the page falls back to the stored subscription
 * rather than failing to load.
 */
export async function getOrgBillingStatus(
	orgId: string,
): Promise<OrgBillingStatus> {
	const org = await findOrgBillingFields(orgId);
	const base = {
		planTier: org.planTier,
		trialEndsAt: org.trialEndsAt,
		hasStripeCustomer: org.stripeCustomerId !== null,
	};
	if (!org.stripeCustomerId) {
		return { ...base, hasSubscription: false, subscriptionStatus: null };
	}

	let live: Stripe.Subscription[];
	try {
		live = await listLiveSubscriptions(org.stripeCustomerId);
	} catch (e) {
		console.error(
			`[billing] Could not list subscriptions for org ${orgId}; using the stored subscription`,
			e,
		);
		const stored = org.stripeSubscriptionId !== null;
		return {
			...base,
			hasSubscription: stored,
			subscriptionStatus: stored ? 'unknown' : null,
		};
	}

	const blocking = live.filter(couldStillBill);
	if (blocking.length === 0) {
		return { ...base, hasSubscription: false, subscriptionStatus: null };
	}
	const statuses = new Set(blocking.map((s) => s.status));
	const status =
		STATUS_PRIORITY.find((candidate) => statuses.has(candidate)) ??
		blocking[0].status;
	return { ...base, hasSubscription: true, subscriptionStatus: status };
}

type Entitlement = {
	tier: PlanTier;
	subscription: Stripe.Subscription | null;
};

// The best paying subscription decides the tier: highest tier first, then the
// newest. Returns null when a paying subscription has no price to map.
function pickEntitlement(
	subscriptions: Stripe.Subscription[],
): Entitlement | null {
	let best: Entitlement = { tier: 'FREE', subscription: null };
	for (const subscription of subscriptions) {
		const priceId = subscription.items.data[0]?.price.id;
		if (!priceId) return null;
		const tier = mapPriceIdToTier(priceId);
		const rank = PLAN_TIER_RANK[tier] - PLAN_TIER_RANK[best.tier];
		if (
			rank > 0 ||
			(rank === 0 &&
				best.subscription !== null &&
				subscription.created > best.subscription.created)
		) {
			best = { tier, subscription };
		}
	}
	return best;
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

		// Two first checkouts can race here. Only one customer may be stored:
		// a payment against the other would never be matched to this org.
		if (await claimOrgStripeCustomerId(opts.orgId, customer.id)) {
			customerId = customer.id;
		} else {
			await getStripe()
				.customers.del(customer.id)
				.catch((e: unknown) =>
					console.error(
						`[billing] Failed to delete duplicate Stripe customer ${customer.id}`,
						e,
					),
				);
			customerId = await findOrgStripeCustomerId(opts.orgId);
			if (!customerId) {
				throw new Error(
					`Org ${opts.orgId} lost the Stripe customer claim but has none stored`,
				);
			}
		}
	}
	const lockedCustomerId = customerId;

	// Expire, check and create under the customer's lock, so two checkouts for
	// one org run one after the other: the second sees the first's session and
	// expires it, and only one can ever be paid.
	const session = await prisma.$transaction(
		async (tx) => {
			await lockStripeCustomerTx(tx, lockedCustomerId);

			// Expire first, then check. An abandoned checkout stays open for 24
			// hours and can still be paid, even in another tab while this runs. Once
			// every open session is expired no new subscription can appear for this
			// customer, so the check below sees anything paid until now. A session
			// completed just before its expire either fails the expire (the checkout
			// fails; the user retries) or has already left the open list, and its
			// subscription is then in the list below.
			const openSessions = await getStripe()
				.checkout.sessions.list(
					{ customer: lockedCustomerId, status: 'open', limit: 100 },
					FAIL_FAST,
				)
				.autoPagingToArray({ limit: 1000 });
			await Promise.all(
				openSessions.map((s) =>
					getStripe().checkout.sessions.expire(s.id, {}, FAIL_FAST),
				),
			);

			// A second checkout would start a second subscription billed alongside
			// the first. Paying orgs change plans in the billing portal, which swaps
			// the price on the existing subscription. A subscription that is not
			// paying (unpaid, paused, incomplete) cannot always be fixed from the
			// portal, so the message also points to support.
			const live = await listLiveSubscriptions(lockedCustomerId);
			if (live.some(couldStillBill)) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message:
						'This organization already has a subscription, or a payment for one is still pending. Use Manage subscription to change plans, or contact support.',
				});
			}

			return getStripe().checkout.sessions.create(
				{
					customer: lockedCustomerId,
					line_items: [{ price: getPriceIdForTier(opts.tier), quantity: 1 }],
					mode: 'subscription',
					success_url: opts.successUrl,
					cancel_url: opts.cancelUrl,
				},
				FAIL_FAST,
			);
		},
		{ timeout: 30_000 },
	);

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

	try {
		await processStripeEvent(event);
	} catch (e) {
		// Still thrown: the 500 makes Stripe retry, and the retry succeeds once
		// the price mapping is fixed. The alert is what gets it fixed.
		if (e instanceof UnknownStripePriceError) {
			// Logged on every delivery, with a stable tag to search for, so the
			// failure stays visible even if the alert email could not be sent.
			console.error(
				`[billing] unknown-stripe-price ${e.priceId} on event ${event.id}`,
			);
			if (
				Date.now() / 1000 - event.created <
				UNKNOWN_PRICE_ALERT_WINDOW_SECONDS
			) {
				const subject = event.data.object as { customer?: unknown };
				await sendUnknownStripePriceAlert({
					priceId: e.priceId,
					eventId: event.id,
					eventType: event.type,
					customerId:
						typeof subject.customer === 'string' ? subject.customer : null,
					priceEnvVars: Object.keys(PRICE_MAP).map(
						(tier) => `STRIPE_PRICE_ID_${tier}`,
					),
				});
			}
		}
		throw e;
	}
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
		case 'customer.subscription.updated':
		case 'customer.subscription.deleted':
		case 'customer.subscription.paused':
		case 'customer.subscription.resumed': {
			const eventSubscription = event.data.object as Stripe.Subscription;
			const customerId = eventSubscription.customer as string;

			const entity = await resolveEntityByCustomerId(customerId);
			if (!entity) {
				console.warn(
					`[billing] Unknown Stripe customer ${customerId} — skipping`,
				);
				await recordEvent(event);
				return { action: 'skipped_unknown_customer' };
			}

			// Lock, list and write in one transaction: see lockStripeCustomerTx.
			// The timeout covers waiting for the lock plus this transaction's own
			// Stripe call. Only a slow Stripe API behind a burst of events for one
			// customer exceeds it; the webhook then answers 500 and Stripe retries.
			const entitlement = await prisma.$transaction(
				async (tx) => {
					await lockStripeCustomerTx(tx, customerId);
					const picked = pickEntitlement(
						await listEntitledSubscriptions(customerId),
					);
					if (!picked) return null;

					const planUpdate = {
						planTier: picked.tier,
						stripeSubscriptionId: picked.subscription?.id ?? null,
					};
					const auditAction = picked.subscription
						? 'PLAN_UPDATED'
						: 'PLAN_DOWNGRADED';
					const metadata = {
						planTier: picked.tier,
						stripeEventId: event.id,
						subscriptionStatus: picked.subscription?.status ?? 'none',
					};

					await markWebhookEventProcessedTx(tx, {
						stripeId: event.id,
						type: event.type,
						payload: JSON.parse(JSON.stringify(event)) as Prisma.InputJsonValue,
					});

					if (entity.type === 'org') {
						await updateOrgPlanTx(tx, entity.id, planUpdate);
						await writeAuditLogTx(tx, {
							orgId: entity.id,
							action: auditAction,
							entityType: 'Organization',
							entityId: entity.id,
							metadata,
						});
					} else {
						await updateCompanyPlanTx(tx, entity.id, planUpdate);
						await writeAuditLogTx(tx, {
							companyId: entity.id,
							action: auditAction,
							entityType: 'CompanyAccount',
							entityId: entity.id,
							metadata,
						});
					}
					return picked;
				},
				{ timeout: 30_000 },
			);

			if (!entitlement) {
				console.warn(
					`[billing] A paying subscription for customer ${customerId} has no price`,
				);
				await recordEvent(event);
				return { action: 'skipped_no_price' };
			}
			const newTier = entitlement.tier;
			const entitled = entitlement.subscription !== null;

			if (!skipEmails) {
				const previousTier = entity.planTier;
				if (previousTier === 'FREE' && newTier !== 'FREE') {
					await trySendBillingEmail(
						entity,
						(opts) => sendPlanUpgradeEmail({ ...opts, tier: newTier }),
						'upgrade',
					);
				} else if (
					event.type === 'customer.subscription.deleted' &&
					previousTier !== 'FREE' &&
					newTier === 'FREE'
				) {
					await trySendBillingEmail(
						entity,
						(opts) => sendCancellationEmail({ ...opts, previousTier }),
						'cancellation',
					);
				}
			}
			return { action: entitled ? 'plan_updated' : 'plan_downgraded' };
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

// One Stripe page of events per call. Each event can take a database check, a
// replay with its own Stripe call, and a 100 ms pause, so a batch this size
// finishes well inside the function time limit; the admin page offers
// Continue until the window is done.
const RECONCILE_BATCH_SIZE = 50;
const RECONCILE_MAX_WINDOW_HOURS = 720;

export type ReconcileCursor = { startingAfter: string; since: number };

export async function reconcileStripeEvents(opts: {
	windowHours: number;
	/** From the previous call's `nextCursor`, to continue the same window. */
	cursor?: ReconcileCursor;
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
	/** Set when more events remain in the window; pass it back to continue. */
	nextCursor: ReconcileCursor | null;
}> {
	const stripe = getStripe();
	// Keep the window's start fixed across batches, so continuing does not
	// slide it forward, but never earlier than the 720-hour maximum the admin
	// can pick: a hand-edited cursor cannot widen the window.
	const earliest = Math.floor(
		(Date.now() - RECONCILE_MAX_WINDOW_HOURS * 60 * 60 * 1000) / 1000,
	);
	const since = Math.max(
		opts.cursor?.since ??
			Math.floor((Date.now() - opts.windowHours * 60 * 60 * 1000) / 1000),
		earliest,
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

	const listParams: Stripe.EventListParams = {
		created: { gte: since },
		limit: RECONCILE_BATCH_SIZE,
	};
	if (opts.cursor) {
		listParams.starting_after = opts.cursor.startingAfter;
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

	const last = events.data[events.data.length - 1];
	return {
		eventsChecked,
		eventsReplayed,
		eventsFailed,
		alreadyProcessed,
		details,
		nextCursor:
			events.has_more && last ? { startingAfter: last.id, since } : null,
	};
}
