import Stripe from 'stripe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// vi.hoisted — runs before any vi.mock factories and before static imports.
// (1) Set env vars so PRICE_MAP (module-level const) is populated at load.
// (2) Define mockStripe so it's available when the stripe mock factory runs.
// ---------------------------------------------------------------------------

vi.hoisted(() => {
	process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
	process.env.STRIPE_PRICE_ID_STARTER = 'price_starter';
	process.env.STRIPE_PRICE_ID_PRO = 'price_pro';
	process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
});

const mockStripe = vi.hoisted(() => ({
	customers: { create: vi.fn(), del: vi.fn(async () => ({})) },
	// Default: the customer holds no live subscription. Each describe resets
	// to this so a queued list can never leak into another describe.
	subscriptions: {
		list: vi.fn(() => ({ autoPagingToArray: async () => [] as unknown[] })),
	},
	checkout: {
		sessions: {
			create: vi.fn(),
			list: vi.fn(() => ({ autoPagingToArray: async () => [] as unknown[] })),
			expire: vi.fn(async () => ({})),
		},
	},
	billingPortal: { sessions: { create: vi.fn() } },
	webhooks: { constructEvent: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Mock Stripe — preserve real error classes (needed for instanceof checks)
// via importOriginal so that StripeSignatureVerificationError works correctly.
// ---------------------------------------------------------------------------

vi.mock('stripe', async (importOriginal) => {
	const actual = await importOriginal<typeof import('stripe')>();
	return {
		default: Object.assign(
			// biome-ignore lint/complexity/useArrowFunction: must be a regular function so `new Stripe()` works as a constructor
			vi.fn(function () {
				return mockStripe;
			}),
			{ errors: actual.default.errors },
		),
	};
});

vi.mock('@/server/repositories/orgRepo', () => ({
	findOrgByStripeCustomerId: vi.fn(async () => null),
	findOrgWithOwnerEmail: vi.fn(async () => null),
	updateOrgPlanTx: vi.fn(async () => ({})),
	claimOrgStripeCustomerId: vi.fn(async () => true),
	findOrgStripeCustomerId: vi.fn(async () => null),
}));

vi.mock('@/server/repositories/companyRepo', () => ({
	findCompanyByStripeCustomerId: vi.fn(async () => null),
	findCompanyWithOwnerEmail: vi.fn(async () => null),
	updateCompanyPlanTx: vi.fn(async () => ({})),
}));

vi.mock('@/server/repositories/webhookRepo', () => ({
	isWebhookEventProcessed: vi.fn(async () => false),
	markWebhookEventProcessedTx: vi.fn(async () => ({})),
	lockStripeCustomerTx: vi.fn(async () => 0),
}));

vi.mock('@/server/repositories/auditRepo', () => ({
	writeAuditLogTx: vi.fn(async () => ({})),
}));

vi.mock('@/server/repositories/send-billing-emails', () => ({
	sendPlanUpgradeEmail: vi.fn(async () => {}),
	sendPaymentFailedEmail: vi.fn(async () => {}),
	sendCancellationEmail: vi.fn(async () => {}),
}));

vi.mock('@/server/lib/admin-alerts', () => ({
	sendUnknownStripePriceAlert: vi.fn(async () => {}),
}));

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		organization: {
			findUniqueOrThrow: vi.fn(async () => ({
				id: 'org-1',
				stripeCustomerId: null,
			})),
			update: vi.fn(async () => ({})),
		},
		$transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
			fn({}),
		),
		stripeWebhookEvent: {
			create: vi.fn(async () => ({})),
		},
	},
}));

import * as adminAlerts from '@/server/lib/admin-alerts';
import * as auditRepo from '@/server/repositories/auditRepo';
import * as companyRepo from '@/server/repositories/companyRepo';
import * as orgRepo from '@/server/repositories/orgRepo';
import { prisma } from '@/server/repositories/prisma';
import * as billingEmails from '@/server/repositories/send-billing-emails';
import * as webhookRepo from '@/server/repositories/webhookRepo';
import {
	createCheckoutSession,
	handleStripeWebhookEvent,
	processStripeEvent,
} from '../billingService';

// A subscription as `stripe.subscriptions.list` returns it: the customer's
// current state, which the service applies whatever the event's snapshot says.
function stripeSub(
	id: string,
	status: Stripe.Subscription.Status,
	priceId = 'price_starter',
	created = 0,
) {
	return {
		id,
		status,
		created,
		customer: 'cus_1',
		items: { data: [{ price: { id: priceId } }] },
	};
}

// Queues the customer's subscriptions for the next `subscriptions.list`.
function mockSubscriptions(...subscriptions: unknown[]) {
	mockStripe.subscriptions.list.mockReturnValueOnce({
		autoPagingToArray: async () => subscriptions,
	});
}

function resetSubscriptions() {
	mockStripe.subscriptions.list
		.mockReset()
		.mockReturnValue({ autoPagingToArray: async () => [] });
}

function subscriptionEvent(
	id: string,
	type:
		| 'customer.subscription.created'
		| 'customer.subscription.updated'
		| 'customer.subscription.deleted'
		| 'customer.subscription.paused'
		| 'customer.subscription.resumed',
	subscriptionId = 'sub_1',
) {
	return {
		id,
		type,
		data: {
			object: {
				id: subscriptionId,
				customer: 'cus_1',
				// The event's snapshot always claims active STARTER: tests prove the
				// service ignores it in favour of the customer's listed subscriptions.
				status: 'active',
				items: { data: [{ price: { id: 'price_starter' } }] },
			},
		},
	};
}

describe('createCheckoutSession', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		resetSubscriptions();
		process.env.STRIPE_PRICE_ID_STARTER = 'price_starter';
		process.env.STRIPE_PRICE_ID_PRO = 'price_pro';
	});

	it('creates a new Stripe customer when none exists', async () => {
		vi.mocked(prisma.organization.findUniqueOrThrow).mockResolvedValueOnce({
			id: 'org-1',
			stripeCustomerId: null,
		} as never);
		mockStripe.customers.create.mockResolvedValueOnce({ id: 'cus_new' });
		mockStripe.checkout.sessions.create.mockResolvedValueOnce({
			url: 'https://checkout.stripe.com/test',
		});

		const result = await createCheckoutSession({
			orgId: 'org-1',
			email: 'admin@org.com',
			tier: 'STARTER',
			successUrl: 'http://localhost/app/billing?upgraded=1',
			cancelUrl: 'http://localhost/app/billing',
		});

		expect(mockStripe.customers.create).toHaveBeenCalledWith(
			expect.objectContaining({ email: 'admin@org.com' }),
		);
		expect(result.checkoutUrl).toBe('https://checkout.stripe.com/test');
	});

	it('reuses existing Stripe customer', async () => {
		vi.mocked(prisma.organization.findUniqueOrThrow).mockResolvedValueOnce({
			id: 'org-1',
			stripeCustomerId: 'cus_existing',
		} as never);
		mockStripe.checkout.sessions.create.mockResolvedValueOnce({
			url: 'https://checkout.stripe.com/test',
		});

		await createCheckoutSession({
			orgId: 'org-1',
			email: 'admin@org.com',
			tier: 'PRO',
			successUrl: 'http://localhost/app/billing?upgraded=1',
			cancelUrl: 'http://localhost/app/billing',
		});

		expect(mockStripe.customers.create).not.toHaveBeenCalled();
	});
});

describe('handleStripeWebhookEvent', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
		process.env.STRIPE_PRICE_ID_STARTER = 'price_starter';
		resetSubscriptions();
		// The legacy cases below assume one active STARTER subscription.
		mockStripe.subscriptions.list.mockReturnValue({
			autoPagingToArray: async () => [stripeSub('sub_1', 'active')],
		});
	});

	it('throws StripeSignatureVerificationError on bad signature', async () => {
		mockStripe.webhooks.constructEvent.mockImplementation(() => {
			// Use Object.create so we don't fight the constructor signature
			const err = Object.create(
				Stripe.errors.StripeSignatureVerificationError.prototype,
			);
			err.message = 'No signatures found matching the expected signature';
			throw err;
		});

		await expect(
			handleStripeWebhookEvent(Buffer.from(''), 'bad-sig'),
		).rejects.toBeInstanceOf(Stripe.errors.StripeSignatureVerificationError);
	});

	it('returns early for duplicate events', async () => {
		mockStripe.webhooks.constructEvent.mockReturnValueOnce({
			id: 'evt_dup',
			type: 'customer.subscription.created',
			data: { object: {} },
		});
		vi.mocked(webhookRepo.isWebhookEventProcessed).mockResolvedValueOnce(true);

		await handleStripeWebhookEvent(Buffer.from(''), 'sig');

		// No DB writes should have occurred
		expect(prisma.$transaction).not.toHaveBeenCalled();
	});

	it('logs warning and records event for unknown Stripe customer', async () => {
		mockStripe.webhooks.constructEvent.mockReturnValueOnce({
			id: 'evt_unknown',
			type: 'customer.subscription.created',
			data: {
				object: {
					id: 'sub_1',
					customer: 'cus_unknown',
					items: { data: [{ price: { id: 'price_starter' } }] },
				},
			},
		});
		vi.mocked(orgRepo.findOrgByStripeCustomerId).mockResolvedValueOnce(null);

		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		await handleStripeWebhookEvent(Buffer.from(''), 'sig');

		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining('Unknown Stripe customer'),
		);
		expect(prisma.stripeWebhookEvent.create).toHaveBeenCalled();
		warnSpy.mockRestore();
	});

	it('updates org plan on subscription.created', async () => {
		vi.mocked(orgRepo.findOrgByStripeCustomerId).mockResolvedValueOnce({
			id: 'org-1',
			planTier: 'FREE',
			stripeCustomerId: 'cus_1',
			stripeSubscriptionId: null,
		});
		mockStripe.webhooks.constructEvent.mockReturnValueOnce({
			id: 'evt_sub',
			type: 'customer.subscription.created',
			data: {
				object: {
					id: 'sub_1',
					customer: 'cus_1',
					items: { data: [{ price: { id: 'price_starter' } }] },
				},
			},
		});

		await handleStripeWebhookEvent(Buffer.from(''), 'sig');

		expect(prisma.$transaction).toHaveBeenCalled();
	});

	it('resets org plan to FREE on subscription.deleted', async () => {
		vi.mocked(orgRepo.findOrgByStripeCustomerId).mockResolvedValueOnce({
			id: 'org-1',
			planTier: 'STARTER',
			stripeCustomerId: 'cus_1',
			stripeSubscriptionId: null,
		});
		mockStripe.webhooks.constructEvent.mockReturnValueOnce({
			id: 'evt_del',
			type: 'customer.subscription.deleted',
			data: {
				object: {
					id: 'sub_1',
					customer: 'cus_1',
					items: { data: [{ price: { id: 'price_starter' } }] },
				},
			},
		});

		mockSubscriptions(stripeSub('sub_1', 'canceled'));

		await handleStripeWebhookEvent(Buffer.from(''), 'sig');

		expect(prisma.$transaction).toHaveBeenCalled();
		expect(orgRepo.updateOrgPlanTx).toHaveBeenCalledWith({}, 'org-1', {
			planTier: 'FREE',
			stripeSubscriptionId: null,
		});
	});

	// -----------------------------------------------------------------------
	// Billing email dispatch tests
	// -----------------------------------------------------------------------

	it('sends upgrade email on subscription.created for org', async () => {
		vi.mocked(orgRepo.findOrgByStripeCustomerId).mockResolvedValueOnce({
			id: 'org-1',
			planTier: 'FREE',
			stripeCustomerId: 'cus_1',
			stripeSubscriptionId: null,
		});
		vi.mocked(orgRepo.findOrgWithOwnerEmail).mockResolvedValueOnce({
			id: 'org-1',
			name: 'Test Org',
			members: [{ user: { email: 'owner@org.com', name: 'Owner' } }],
		});
		mockStripe.webhooks.constructEvent.mockReturnValueOnce({
			id: 'evt_created',
			type: 'customer.subscription.created',
			data: {
				object: {
					id: 'sub_1',
					customer: 'cus_1',
					items: { data: [{ price: { id: 'price_starter' } }] },
				},
			},
		});

		await handleStripeWebhookEvent(Buffer.from(''), 'sig');

		expect(billingEmails.sendPlanUpgradeEmail).toHaveBeenCalledWith(
			expect.objectContaining({
				to: 'owner@org.com',
				orgName: 'Test Org',
				tier: 'STARTER',
			}),
		);
	});

	it('does not resend the upgrade email when an already-paid org gets an updated event', async () => {
		vi.mocked(orgRepo.findOrgByStripeCustomerId).mockResolvedValueOnce({
			id: 'org-1',
			planTier: 'STARTER',
			stripeCustomerId: 'cus_1',
			stripeSubscriptionId: null,
		});
		mockStripe.webhooks.constructEvent.mockReturnValueOnce({
			id: 'evt_updated',
			type: 'customer.subscription.updated',
			data: {
				object: {
					id: 'sub_1',
					customer: 'cus_1',
					items: { data: [{ price: { id: 'price_starter' } }] },
				},
			},
		});

		await handleStripeWebhookEvent(Buffer.from(''), 'sig');

		expect(billingEmails.sendPlanUpgradeEmail).not.toHaveBeenCalled();
	});

	it('sends cancellation email on subscription.deleted', async () => {
		vi.mocked(orgRepo.findOrgByStripeCustomerId).mockResolvedValueOnce({
			id: 'org-1',
			planTier: 'STARTER',
			stripeCustomerId: 'cus_1',
			stripeSubscriptionId: null,
		});
		vi.mocked(orgRepo.findOrgWithOwnerEmail).mockResolvedValueOnce({
			id: 'org-1',
			name: 'Test Org',
			members: [{ user: { email: 'owner@org.com', name: 'Owner' } }],
		});
		mockStripe.webhooks.constructEvent.mockReturnValueOnce({
			id: 'evt_cancel',
			type: 'customer.subscription.deleted',
			data: {
				object: {
					id: 'sub_1',
					customer: 'cus_1',
					items: { data: [{ price: { id: 'price_starter' } }] },
				},
			},
		});
		mockSubscriptions(stripeSub('sub_1', 'canceled'));

		await handleStripeWebhookEvent(Buffer.from(''), 'sig');

		expect(billingEmails.sendCancellationEmail).toHaveBeenCalledWith(
			expect.objectContaining({
				to: 'owner@org.com',
				orgName: 'Test Org',
				previousTier: 'STARTER',
			}),
		);
	});

	it('sends payment failed email for known customer', async () => {
		vi.mocked(orgRepo.findOrgByStripeCustomerId).mockResolvedValueOnce({
			id: 'org-1',
			planTier: 'STARTER',
			stripeCustomerId: 'cus_1',
			stripeSubscriptionId: null,
		});
		vi.mocked(orgRepo.findOrgWithOwnerEmail).mockResolvedValueOnce({
			id: 'org-1',
			name: 'Test Org',
			members: [{ user: { email: 'owner@org.com', name: 'Owner' } }],
		});
		mockStripe.webhooks.constructEvent.mockReturnValueOnce({
			id: 'evt_fail',
			type: 'invoice.payment_failed',
			data: {
				object: { id: 'inv_1', customer: 'cus_1' },
			},
		});
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		await handleStripeWebhookEvent(Buffer.from(''), 'sig');

		expect(billingEmails.sendPaymentFailedEmail).toHaveBeenCalledWith(
			expect.objectContaining({
				to: 'owner@org.com',
				orgName: 'Test Org',
			}),
		);
		warnSpy.mockRestore();
	});

	it('does not crash when email send throws', async () => {
		vi.mocked(orgRepo.findOrgByStripeCustomerId).mockResolvedValueOnce({
			id: 'org-1',
			planTier: 'FREE',
			stripeCustomerId: 'cus_1',
			stripeSubscriptionId: null,
		});
		vi.mocked(orgRepo.findOrgWithOwnerEmail).mockResolvedValueOnce({
			id: 'org-1',
			name: 'Test Org',
			members: [{ user: { email: 'owner@org.com', name: 'Owner' } }],
		});
		vi.mocked(billingEmails.sendPlanUpgradeEmail).mockRejectedValueOnce(
			new Error('Resend is down'),
		);
		mockStripe.webhooks.constructEvent.mockReturnValueOnce({
			id: 'evt_email_fail',
			type: 'customer.subscription.created',
			data: {
				object: {
					id: 'sub_1',
					customer: 'cus_1',
					items: { data: [{ price: { id: 'price_starter' } }] },
				},
			},
		});
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		// Should not throw
		await handleStripeWebhookEvent(Buffer.from(''), 'sig');

		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining('Failed to send upgrade email'),
			expect.any(Error),
		);
		errorSpy.mockRestore();
	});

	it('skips email when no owner member exists', async () => {
		vi.mocked(orgRepo.findOrgByStripeCustomerId).mockResolvedValueOnce({
			id: 'org-1',
			planTier: 'FREE',
			stripeCustomerId: 'cus_1',
			stripeSubscriptionId: null,
		});
		vi.mocked(orgRepo.findOrgWithOwnerEmail).mockResolvedValueOnce({
			id: 'org-1',
			name: 'Test Org',
			members: [],
		});
		mockStripe.webhooks.constructEvent.mockReturnValueOnce({
			id: 'evt_no_owner',
			type: 'customer.subscription.created',
			data: {
				object: {
					id: 'sub_1',
					customer: 'cus_1',
					items: { data: [{ price: { id: 'price_starter' } }] },
				},
			},
		});

		await handleStripeWebhookEvent(Buffer.from(''), 'sig');

		expect(billingEmails.sendPlanUpgradeEmail).not.toHaveBeenCalled();
	});

	it('sends upgrade email for company entity', async () => {
		vi.mocked(orgRepo.findOrgByStripeCustomerId).mockResolvedValueOnce(null);
		vi.mocked(companyRepo.findCompanyByStripeCustomerId).mockResolvedValueOnce({
			id: 'company-1',
			planTier: 'FREE',
			stripeCustomerId: 'cus_co',
			stripeSubscriptionId: null,
		});
		vi.mocked(companyRepo.findCompanyWithOwnerEmail).mockResolvedValueOnce({
			id: 'company-1',
			name: 'Test Company',
			members: [{ user: { email: 'boss@company.com', name: 'Boss' } }],
		});
		mockStripe.webhooks.constructEvent.mockReturnValueOnce({
			id: 'evt_co_created',
			type: 'customer.subscription.created',
			data: {
				object: {
					id: 'sub_co',
					customer: 'cus_co',
					items: { data: [{ price: { id: 'price_pro' } }] },
				},
			},
		});
		mockSubscriptions(stripeSub('sub_co', 'active', 'price_pro'));

		await handleStripeWebhookEvent(Buffer.from(''), 'sig');

		expect(billingEmails.sendPlanUpgradeEmail).toHaveBeenCalledWith(
			expect.objectContaining({
				to: 'boss@company.com',
				orgName: 'Test Company',
				tier: 'PRO',
			}),
		);
	});
});

describe("subscription events apply the customer's subscriptions", () => {
	const org = (
		planTier: 'FREE' | 'STARTER' | 'PRO',
		stripeSubscriptionId: string | null,
	) => ({
		id: 'org-1',
		planTier,
		stripeCustomerId: 'cus_1',
		stripeSubscriptionId,
	});

	let warnSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		vi.clearAllMocks();
		resetSubscriptions();
		process.env.STRIPE_PRICE_ID_STARTER = 'price_starter';
		process.env.STRIPE_PRICE_ID_PRO = 'price_pro';
		warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		vi.mocked(orgRepo.findOrgWithOwnerEmail).mockResolvedValue({
			id: 'org-1',
			name: 'Test Org',
			members: [{ user: { email: 'owner@org.com', name: 'Owner' } }],
		});
	});

	afterEach(() => {
		warnSpy.mockRestore();
		vi.mocked(orgRepo.findOrgWithOwnerEmail)
			.mockReset()
			.mockResolvedValue(null);
	});

	it.each([
		'unpaid',
		'paused',
		'canceled',
		'incomplete',
		'incomplete_expired',
	] as const)(
		'drops the plan to FREE when the only subscription is %s',
		async (status) => {
			vi.mocked(orgRepo.findOrgByStripeCustomerId).mockResolvedValueOnce(
				org('STARTER', 'sub_1'),
			);
			mockSubscriptions(stripeSub('sub_1', status));

			const result = await processStripeEvent(
				subscriptionEvent('evt_s', 'customer.subscription.updated') as never,
			);

			expect(result.action).toBe('plan_downgraded');
			expect(orgRepo.updateOrgPlanTx).toHaveBeenCalledWith({}, 'org-1', {
				planTier: 'FREE',
				stripeSubscriptionId: null,
			});
		},
	);

	it.each(['active', 'trialing', 'past_due'] as const)(
		'keeps the paid tier when the subscription is %s',
		async (status) => {
			vi.mocked(orgRepo.findOrgByStripeCustomerId).mockResolvedValueOnce(
				org('STARTER', 'sub_1'),
			);
			mockSubscriptions(stripeSub('sub_1', status, 'price_pro'));

			const result = await processStripeEvent(
				subscriptionEvent('evt_s', 'customer.subscription.updated') as never,
			);

			expect(result.action).toBe('plan_updated');
			expect(orgRepo.updateOrgPlanTx).toHaveBeenCalledWith({}, 'org-1', {
				planTier: 'PRO',
				stripeSubscriptionId: 'sub_1',
			});
		},
	);

	it('lists the subscriptions of the event customer, failing fast', async () => {
		vi.mocked(orgRepo.findOrgByStripeCustomerId).mockResolvedValueOnce(
			org('FREE', null),
		);

		await processStripeEvent(
			subscriptionEvent('evt_list', 'customer.subscription.updated') as never,
		);

		expect(mockStripe.subscriptions.list).toHaveBeenCalledWith(
			{ customer: 'cus_1', limit: 100 },
			expect.objectContaining({ timeout: expect.any(Number) }),
		);
	});

	it('does not restore a cancelled plan from a stale "updated" event', async () => {
		// Reconciliation replays newest first, so the cancellation is applied
		// before an older "updated" whose snapshot still says active.
		vi.mocked(orgRepo.findOrgByStripeCustomerId).mockResolvedValueOnce(
			org('FREE', null),
		);
		mockSubscriptions(stripeSub('sub_1', 'canceled'));

		await processStripeEvent(
			subscriptionEvent('evt_old', 'customer.subscription.updated') as never,
			{ skipEmails: true },
		);

		expect(orgRepo.updateOrgPlanTx).toHaveBeenCalledWith({}, 'org-1', {
			planTier: 'FREE',
			stripeSubscriptionId: null,
		});
	});

	it('lets a Stripe failure fail the event so Stripe retries it', async () => {
		vi.mocked(orgRepo.findOrgByStripeCustomerId).mockResolvedValueOnce(
			org('STARTER', 'sub_1'),
		);
		mockStripe.subscriptions.list.mockReturnValueOnce({
			autoPagingToArray: async () => {
				throw new Error('Stripe is down');
			},
		});

		await expect(
			processStripeEvent(
				subscriptionEvent('evt_down', 'customer.subscription.updated') as never,
			),
		).rejects.toThrow('Stripe is down');
		// The transaction rolls back: nothing is marked processed, so the
		// retried event is applied in full.
		expect(webhookRepo.markWebhookEventProcessedTx).not.toHaveBeenCalled();
		expect(orgRepo.updateOrgPlanTx).not.toHaveBeenCalled();
	});

	it('drops the plan on a real customer.subscription.paused event', async () => {
		vi.mocked(orgRepo.findOrgByStripeCustomerId).mockResolvedValueOnce(
			org('STARTER', 'sub_1'),
		);
		mockSubscriptions(stripeSub('sub_1', 'paused'));

		const result = await processStripeEvent(
			subscriptionEvent('evt_pause', 'customer.subscription.paused') as never,
		);

		expect(result.action).toBe('plan_downgraded');
	});

	it('restores the plan on a real customer.subscription.resumed event', async () => {
		vi.mocked(orgRepo.findOrgByStripeCustomerId).mockResolvedValueOnce(
			org('FREE', null),
		);
		mockSubscriptions(stripeSub('sub_1', 'active', 'price_pro'));

		const result = await processStripeEvent(
			subscriptionEvent('evt_resume', 'customer.subscription.resumed') as never,
		);

		expect(result.action).toBe('plan_updated');
		expect(orgRepo.updateOrgPlanTx).toHaveBeenCalledWith({}, 'org-1', {
			planTier: 'PRO',
			stripeSubscriptionId: 'sub_1',
		});
	});

	it('locks the customer before listing its subscriptions', async () => {
		vi.mocked(orgRepo.findOrgByStripeCustomerId).mockResolvedValueOnce(
			org('FREE', null),
		);

		await processStripeEvent(
			subscriptionEvent('evt_lock', 'customer.subscription.updated') as never,
		);

		expect(webhookRepo.lockStripeCustomerTx).toHaveBeenCalledWith({}, 'cus_1');
		const [lockOrder] = vi.mocked(webhookRepo.lockStripeCustomerTx).mock
			.invocationCallOrder;
		const [listOrder] = mockStripe.subscriptions.list.mock.invocationCallOrder;
		expect(lockOrder).toBeLessThan(listOrder);
	});

	it('keeps the plan of a subscription still paid when another is cancelled', async () => {
		vi.mocked(orgRepo.findOrgByStripeCustomerId).mockResolvedValueOnce(
			org('PRO', 'sub_1'),
		);
		mockSubscriptions(
			stripeSub('sub_1', 'canceled', 'price_pro'),
			stripeSub('sub_2', 'active', 'price_starter'),
		);

		const result = await processStripeEvent(
			subscriptionEvent(
				'evt_cancel_one',
				'customer.subscription.deleted',
			) as never,
		);

		expect(result.action).toBe('plan_updated');
		expect(orgRepo.updateOrgPlanTx).toHaveBeenCalledWith({}, 'org-1', {
			planTier: 'STARTER',
			stripeSubscriptionId: 'sub_2',
		});
		expect(billingEmails.sendCancellationEmail).not.toHaveBeenCalled();
	});

	it('does not drop a PRO payer to STARTER when the older STARTER renews', async () => {
		vi.mocked(orgRepo.findOrgByStripeCustomerId).mockResolvedValueOnce(
			org('PRO', 'sub_2'),
		);
		mockSubscriptions(
			stripeSub('sub_1', 'active', 'price_starter', 100),
			stripeSub('sub_2', 'active', 'price_pro', 50),
		);

		await processStripeEvent(
			subscriptionEvent(
				'evt_renew',
				'customer.subscription.updated',
				'sub_1',
			) as never,
		);

		expect(orgRepo.updateOrgPlanTx).toHaveBeenCalledWith({}, 'org-1', {
			planTier: 'PRO',
			stripeSubscriptionId: 'sub_2',
		});
	});

	it('picks the newest of two subscriptions on the same tier', async () => {
		vi.mocked(orgRepo.findOrgByStripeCustomerId).mockResolvedValueOnce(
			org('STARTER', 'sub_1'),
		);
		mockSubscriptions(
			stripeSub('sub_1', 'active', 'price_starter', 100),
			stripeSub('sub_2', 'active', 'price_starter', 200),
		);

		await processStripeEvent(
			subscriptionEvent('evt_tie', 'customer.subscription.updated') as never,
		);

		expect(orgRepo.updateOrgPlanTx).toHaveBeenCalledWith({}, 'org-1', {
			planTier: 'STARTER',
			stripeSubscriptionId: 'sub_2',
		});
	});

	it('grants nothing and sends no upgrade email while checkout is incomplete', async () => {
		vi.mocked(orgRepo.findOrgByStripeCustomerId).mockResolvedValueOnce(
			org('FREE', null),
		);
		mockSubscriptions(stripeSub('sub_1', 'incomplete'));

		await processStripeEvent(
			subscriptionEvent('evt_inc', 'customer.subscription.created') as never,
		);

		expect(orgRepo.updateOrgPlanTx).toHaveBeenCalledWith({}, 'org-1', {
			planTier: 'FREE',
			stripeSubscriptionId: null,
		});
		expect(billingEmails.sendPlanUpgradeEmail).not.toHaveBeenCalled();
	});

	it('sends the upgrade email when payment completes on an "updated" event', async () => {
		vi.mocked(orgRepo.findOrgByStripeCustomerId).mockResolvedValueOnce(
			org('FREE', null),
		);
		mockSubscriptions(stripeSub('sub_1', 'active'));

		await processStripeEvent(
			subscriptionEvent('evt_paid', 'customer.subscription.updated') as never,
		);

		expect(billingEmails.sendPlanUpgradeEmail).toHaveBeenCalledWith(
			expect.objectContaining({ to: 'owner@org.com', tier: 'STARTER' }),
		);
	});

	it('sends no cancellation email when an unpaid subscription drops the plan', async () => {
		vi.mocked(orgRepo.findOrgByStripeCustomerId).mockResolvedValueOnce(
			org('STARTER', 'sub_1'),
		);
		mockSubscriptions(stripeSub('sub_1', 'unpaid'));

		await processStripeEvent(
			subscriptionEvent('evt_unpaid', 'customer.subscription.updated') as never,
		);

		expect(billingEmails.sendCancellationEmail).not.toHaveBeenCalled();
	});

	it('sends no email for a replayed upgrade when emails are skipped', async () => {
		vi.mocked(orgRepo.findOrgByStripeCustomerId).mockResolvedValueOnce(
			org('FREE', null),
		);
		mockSubscriptions(stripeSub('sub_1', 'active'));

		await processStripeEvent(
			subscriptionEvent('evt_replay', 'customer.subscription.created') as never,
			{ skipEmails: true },
		);

		expect(orgRepo.updateOrgPlanTx).toHaveBeenCalled();
		expect(billingEmails.sendPlanUpgradeEmail).not.toHaveBeenCalled();
	});

	it('sends no email for a replayed cancellation when emails are skipped', async () => {
		vi.mocked(orgRepo.findOrgByStripeCustomerId).mockResolvedValueOnce(
			org('STARTER', 'sub_1'),
		);

		await processStripeEvent(
			subscriptionEvent(
				'evt_replay_del',
				'customer.subscription.deleted',
			) as never,
			{ skipEmails: true },
		);

		expect(orgRepo.updateOrgPlanTx).toHaveBeenCalledWith({}, 'org-1', {
			planTier: 'FREE',
			stripeSubscriptionId: null,
		});
		expect(billingEmails.sendCancellationEmail).not.toHaveBeenCalled();
	});

	it('records the event and leaves the plan when a paying subscription has no price', async () => {
		vi.mocked(orgRepo.findOrgByStripeCustomerId).mockResolvedValueOnce(
			org('STARTER', 'sub_1'),
		);
		mockSubscriptions({ ...stripeSub('sub_1', 'active'), items: { data: [] } });

		const result = await processStripeEvent(
			subscriptionEvent(
				'evt_noprice',
				'customer.subscription.updated',
			) as never,
		);

		expect(result.action).toBe('skipped_no_price');
		expect(orgRepo.updateOrgPlanTx).not.toHaveBeenCalled();
		expect(prisma.stripeWebhookEvent.create).toHaveBeenCalled();
	});
});

describe('createCheckoutSession under a concurrent first checkout', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		resetSubscriptions();
		process.env.STRIPE_PRICE_ID_STARTER = 'price_starter';
	});

	it('uses the customer the other request stored and deletes its own', async () => {
		vi.mocked(prisma.organization.findUniqueOrThrow).mockResolvedValueOnce({
			id: 'org-1',
			stripeCustomerId: null,
		} as never);
		mockStripe.customers.create.mockResolvedValueOnce({ id: 'cus_loser' });
		vi.mocked(orgRepo.claimOrgStripeCustomerId).mockResolvedValueOnce(false);
		vi.mocked(orgRepo.findOrgStripeCustomerId).mockResolvedValueOnce(
			'cus_winner',
		);
		mockStripe.checkout.sessions.create.mockResolvedValueOnce({
			url: 'https://checkout.stripe.com/test',
		});

		await createCheckoutSession({
			orgId: 'org-1',
			email: 'admin@org.com',
			tier: 'STARTER',
			successUrl: 'http://localhost/app/billing?upgraded=1',
			cancelUrl: 'http://localhost/app/billing',
		});

		expect(orgRepo.claimOrgStripeCustomerId).toHaveBeenCalledWith(
			'org-1',
			'cus_loser',
		);
		expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
			expect.objectContaining({ customer: 'cus_winner' }),
			expect.anything(),
		);
		expect(mockStripe.customers.del).toHaveBeenCalledWith('cus_loser');
	});

	it('refuses to check out when it lost the claim but finds no customer', async () => {
		vi.mocked(prisma.organization.findUniqueOrThrow).mockResolvedValueOnce({
			id: 'org-1',
			stripeCustomerId: null,
		} as never);
		mockStripe.customers.create.mockResolvedValueOnce({ id: 'cus_loser' });
		vi.mocked(orgRepo.claimOrgStripeCustomerId).mockResolvedValueOnce(false);
		vi.mocked(orgRepo.findOrgStripeCustomerId).mockResolvedValueOnce(null);

		await expect(
			createCheckoutSession({
				orgId: 'org-1',
				email: 'admin@org.com',
				tier: 'STARTER',
				successUrl: 'http://localhost/app/billing?upgraded=1',
				cancelUrl: 'http://localhost/app/billing',
			}),
		).rejects.toThrow('lost the Stripe customer claim');
		expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
		// The customer it just created is not left orphaned in Stripe.
		expect(mockStripe.customers.del).toHaveBeenCalledWith('cus_loser');
	});

	it('refuses a second checkout while the org has a paying subscription', async () => {
		vi.mocked(prisma.organization.findUniqueOrThrow).mockResolvedValueOnce({
			id: 'org-1',
			stripeCustomerId: 'cus_1',
		} as never);
		mockSubscriptions(stripeSub('sub_1', 'active'));

		await expect(
			createCheckoutSession({
				orgId: 'org-1',
				email: 'admin@org.com',
				tier: 'PRO',
				successUrl: 'http://localhost/app/billing?upgraded=1',
				cancelUrl: 'http://localhost/app/billing',
			}),
		).rejects.toMatchObject({ code: 'BAD_REQUEST' });
		expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
	});

	// 'some_future_status' stands for a status Stripe adds later: checkout
	// is allowed only beside final ones, so an unknown status must block.
	it.each(['unpaid', 'paused', 'incomplete', 'some_future_status'] as const)(
		'refuses a new checkout beside a %s subscription that could come back',
		async (status) => {
			vi.mocked(prisma.organization.findUniqueOrThrow).mockResolvedValueOnce({
				id: 'org-1',
				stripeCustomerId: 'cus_1',
			} as never);
			mockSubscriptions(
				stripeSub('sub_1', status as Stripe.Subscription.Status),
			);

			await expect(
				createCheckoutSession({
					orgId: 'org-1',
					email: 'admin@org.com',
					tier: 'STARTER',
					successUrl: 'http://localhost/app/billing?upgraded=1',
					cancelUrl: 'http://localhost/app/billing',
				}),
			).rejects.toMatchObject({ code: 'BAD_REQUEST' });
			expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
		},
	);

	it.each(['canceled', 'incomplete_expired'] as const)(
		'lets an org whose subscription is %s check out again',
		async (status) => {
			vi.mocked(prisma.organization.findUniqueOrThrow).mockResolvedValueOnce({
				id: 'org-1',
				stripeCustomerId: 'cus_1',
			} as never);
			mockSubscriptions(stripeSub('sub_1', status));
			mockStripe.checkout.sessions.create.mockResolvedValueOnce({
				url: 'https://checkout.stripe.com/test',
			});

			await createCheckoutSession({
				orgId: 'org-1',
				email: 'admin@org.com',
				tier: 'PRO',
				successUrl: 'http://localhost/app/billing?upgraded=1',
				cancelUrl: 'http://localhost/app/billing',
			});

			expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
				expect.objectContaining({ customer: 'cus_1' }),
				expect.anything(),
			);
		},
	);

	it('keeps its own customer when it stores first', async () => {
		vi.mocked(prisma.organization.findUniqueOrThrow).mockResolvedValueOnce({
			id: 'org-1',
			stripeCustomerId: null,
		} as never);
		mockStripe.customers.create.mockResolvedValueOnce({ id: 'cus_new' });
		mockStripe.checkout.sessions.create.mockResolvedValueOnce({
			url: 'https://checkout.stripe.com/test',
		});

		await createCheckoutSession({
			orgId: 'org-1',
			email: 'admin@org.com',
			tier: 'STARTER',
			successUrl: 'http://localhost/app/billing?upgraded=1',
			cancelUrl: 'http://localhost/app/billing',
		});

		expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
			expect.objectContaining({ customer: 'cus_new' }),
			expect.anything(),
		);
		expect(mockStripe.customers.del).not.toHaveBeenCalled();
	});
});

describe('company subscription cancellation', () => {
	// Before this, only the company upgrade email was tested.
	beforeEach(() => {
		vi.clearAllMocks();
		resetSubscriptions();
		process.env.STRIPE_PRICE_ID_STARTER = 'price_starter';
		process.env.STRIPE_PRICE_ID_PRO = 'price_pro';
	});

	it('downgrades the company it belongs to and emails its owner', async () => {
		vi.mocked(orgRepo.findOrgByStripeCustomerId).mockResolvedValueOnce(null);
		vi.mocked(companyRepo.findCompanyByStripeCustomerId).mockResolvedValueOnce({
			id: 'company-1',
			planTier: 'PRO',
			stripeCustomerId: 'cus_1',
			stripeSubscriptionId: 'sub_co',
		});
		vi.mocked(companyRepo.findCompanyWithOwnerEmail).mockResolvedValueOnce({
			id: 'company-1',
			name: 'Test Company',
			members: [{ user: { email: 'boss@company.com', name: 'Boss' } }],
		});
		mockSubscriptions(stripeSub('sub_co', 'canceled', 'price_pro'));

		const result = await processStripeEvent(
			subscriptionEvent(
				'evt_co_deleted',
				'customer.subscription.deleted',
				'sub_co',
			) as never,
		);

		expect(result.action).toBe('plan_downgraded');
		expect(companyRepo.updateCompanyPlanTx).toHaveBeenCalledWith(
			{},
			'company-1',
			{ planTier: 'FREE', stripeSubscriptionId: null },
		);
		expect(orgRepo.updateOrgPlanTx).not.toHaveBeenCalled();
		expect(auditRepo.writeAuditLogTx).toHaveBeenCalledWith(
			{},
			expect.objectContaining({
				companyId: 'company-1',
				action: 'PLAN_DOWNGRADED',
				entityType: 'CompanyAccount',
				metadata: expect.objectContaining({ subscriptionStatus: 'none' }),
			}),
		);
		expect(billingEmails.sendCancellationEmail).toHaveBeenCalledWith(
			expect.objectContaining({ to: 'boss@company.com', previousTier: 'PRO' }),
		);
	});
});

describe('createCheckoutSession when the duplicate customer cannot be deleted', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		resetSubscriptions();
		process.env.STRIPE_PRICE_ID_STARTER = 'price_starter';
	});

	it('logs the failure and still checks out against the stored customer', async () => {
		const consoleError = vi
			.spyOn(console, 'error')
			.mockImplementation(() => {});
		vi.mocked(prisma.organization.findUniqueOrThrow).mockResolvedValueOnce({
			id: 'org-1',
			stripeCustomerId: null,
		} as never);
		mockStripe.customers.create.mockResolvedValueOnce({ id: 'cus_loser' });
		vi.mocked(orgRepo.claimOrgStripeCustomerId).mockResolvedValueOnce(false);
		vi.mocked(orgRepo.findOrgStripeCustomerId).mockResolvedValueOnce(
			'cus_winner',
		);
		mockStripe.customers.del.mockRejectedValueOnce(new Error('Stripe is down'));
		mockStripe.checkout.sessions.create.mockResolvedValueOnce({
			url: 'https://checkout.stripe.com/test',
		});

		const result = await createCheckoutSession({
			orgId: 'org-1',
			email: 'admin@org.com',
			tier: 'STARTER',
			successUrl: 'http://localhost/app/billing?upgraded=1',
			cancelUrl: 'http://localhost/app/billing',
		});

		expect(result.checkoutUrl).toBe('https://checkout.stripe.com/test');
		expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
			expect.objectContaining({ customer: 'cus_winner' }),
			expect.anything(),
		);
		expect(consoleError).toHaveBeenCalledWith(
			expect.stringContaining('cus_loser'),
			expect.any(Error),
		);
		consoleError.mockRestore();
	});
});

describe('createCheckoutSession with an abandoned checkout still open', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		resetSubscriptions();
		process.env.STRIPE_PRICE_ID_STARTER = 'price_starter';
		process.env.STRIPE_PRICE_ID_PRO = 'price_pro';
		mockStripe.checkout.sessions.list
			.mockReset()
			.mockReturnValue({ autoPagingToArray: async () => [] });
		mockStripe.checkout.sessions.expire
			.mockReset()
			.mockResolvedValue({} as never);
	});

	const checkout = () =>
		createCheckoutSession({
			orgId: 'org-1',
			email: 'admin@org.com',
			tier: 'PRO',
			successUrl: 'http://localhost/app/billing?upgraded=1',
			cancelUrl: 'http://localhost/app/billing',
		});

	it('expires the open sessions before opening a new one', async () => {
		vi.mocked(prisma.organization.findUniqueOrThrow).mockResolvedValueOnce({
			id: 'org-1',
			stripeCustomerId: 'cus_1',
		} as never);
		mockStripe.checkout.sessions.list.mockReturnValueOnce({
			autoPagingToArray: async () => [{ id: 'cs_old_1' }, { id: 'cs_old_2' }],
		});
		mockStripe.checkout.sessions.create.mockResolvedValueOnce({
			url: 'https://checkout.stripe.com/test',
		});

		await checkout();

		expect(mockStripe.checkout.sessions.list).toHaveBeenCalledWith(
			{ customer: 'cus_1', status: 'open', limit: 100 },
			expect.anything(),
		);
		expect(mockStripe.checkout.sessions.expire).toHaveBeenCalledWith(
			'cs_old_1',
			{},
			expect.anything(),
		);
		expect(mockStripe.checkout.sessions.expire).toHaveBeenCalledWith(
			'cs_old_2',
			{},
			expect.anything(),
		);
		const [lastExpire] =
			mockStripe.checkout.sessions.expire.mock.invocationCallOrder.slice(-1);
		const [create] =
			mockStripe.checkout.sessions.create.mock.invocationCallOrder;
		expect(lastExpire).toBeLessThan(create);
	});

	it('locks the customer before checking and creating', async () => {
		vi.mocked(prisma.organization.findUniqueOrThrow).mockResolvedValueOnce({
			id: 'org-1',
			stripeCustomerId: 'cus_1',
		} as never);
		mockStripe.checkout.sessions.create.mockResolvedValueOnce({
			url: 'https://checkout.stripe.com/test',
		});

		await checkout();

		expect(webhookRepo.lockStripeCustomerTx).toHaveBeenCalledWith({}, 'cus_1');
		const [lockOrder] = vi.mocked(webhookRepo.lockStripeCustomerTx).mock
			.invocationCallOrder;
		const [listOrder] = mockStripe.subscriptions.list.mock.invocationCallOrder;
		const [createOrder] =
			mockStripe.checkout.sessions.create.mock.invocationCallOrder;
		expect(lockOrder).toBeLessThan(listOrder);
		expect(listOrder).toBeLessThan(createOrder);
	});

	it('opens no new session when an old one cannot be expired', async () => {
		vi.mocked(prisma.organization.findUniqueOrThrow).mockResolvedValueOnce({
			id: 'org-1',
			stripeCustomerId: 'cus_1',
		} as never);
		mockStripe.checkout.sessions.list.mockReturnValueOnce({
			autoPagingToArray: async () => [{ id: 'cs_old' }],
		});
		mockStripe.checkout.sessions.expire.mockRejectedValueOnce(
			new Error('Stripe is down'),
		);

		await expect(checkout()).rejects.toThrow('Stripe is down');
		expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
	});
});

describe('the per-customer lock spans the whole transaction', () => {
	// The shared $transaction mock hands every call the same empty object, so
	// it cannot tell one transaction from two. Here each call gets its own tx
	// and records, in order, the lock and the Stripe calls made while its
	// callback was still open.
	let inside = false;
	const stripeCallsInside: string[] = [];

	beforeEach(() => {
		vi.clearAllMocks();
		resetSubscriptions();
		stripeCallsInside.length = 0;
		process.env.STRIPE_PRICE_ID_STARTER = 'price_starter';
		vi.mocked(prisma.$transaction).mockImplementationOnce((async (
			fn: (tx: unknown) => Promise<unknown>,
		) => {
			inside = true;
			try {
				return await fn({ tx: 'only-this-one' });
			} finally {
				inside = false;
			}
		}) as never);
		vi.mocked(webhookRepo.lockStripeCustomerTx).mockImplementationOnce(
			(async () => {
				if (inside) stripeCallsInside.push('lock');
				return 0;
			}) as never,
		);
		mockStripe.subscriptions.list.mockImplementation(() => {
			if (inside) stripeCallsInside.push('subscriptions.list');
			return { autoPagingToArray: async () => [] };
		});
		mockStripe.checkout.sessions.list.mockReset().mockImplementation(() => {
			if (inside) stripeCallsInside.push('sessions.list');
			return { autoPagingToArray: async () => [{ id: 'cs_open' }] };
		});
		mockStripe.checkout.sessions.expire
			.mockReset()
			.mockImplementation((async () => {
				if (inside) stripeCallsInside.push('sessions.expire');
				return {};
			}) as never);
	});

	it('locks, lists and writes a webhook in one 30 s transaction', async () => {
		vi.mocked(orgRepo.findOrgByStripeCustomerId).mockResolvedValueOnce({
			id: 'org-1',
			planTier: 'FREE',
			stripeCustomerId: 'cus_1',
			stripeSubscriptionId: null,
		});

		await processStripeEvent(
			subscriptionEvent('evt_tx', 'customer.subscription.updated') as never,
		);

		const tx = { tx: 'only-this-one' };
		expect(prisma.$transaction).toHaveBeenCalledWith(
			expect.any(Function),
			expect.objectContaining({ timeout: 30_000 }),
		);
		expect(webhookRepo.lockStripeCustomerTx).toHaveBeenCalledWith(tx, 'cus_1');
		expect(webhookRepo.markWebhookEventProcessedTx).toHaveBeenCalledWith(
			tx,
			expect.anything(),
		);
		expect(orgRepo.updateOrgPlanTx).toHaveBeenCalledWith(
			tx,
			'org-1',
			expect.anything(),
		);
		expect(stripeCallsInside).toEqual(['lock', 'subscriptions.list']);
	});

	it('locks, expires, then checks and creates a checkout in one 30 s transaction', async () => {
		vi.mocked(prisma.organization.findUniqueOrThrow).mockResolvedValueOnce({
			id: 'org-1',
			stripeCustomerId: 'cus_1',
		} as never);
		mockStripe.checkout.sessions.create.mockImplementationOnce(async () => {
			if (inside) stripeCallsInside.push('sessions.create');
			return { url: 'https://checkout.stripe.com/test' };
		});

		await createCheckoutSession({
			orgId: 'org-1',
			email: 'admin@org.com',
			tier: 'STARTER',
			successUrl: 'http://localhost/app/billing?upgraded=1',
			cancelUrl: 'http://localhost/app/billing',
		});

		expect(prisma.$transaction).toHaveBeenCalledWith(
			expect.any(Function),
			expect.objectContaining({ timeout: 30_000 }),
		);
		expect(webhookRepo.lockStripeCustomerTx).toHaveBeenCalledWith(
			{ tx: 'only-this-one' },
			'cus_1',
		);
		expect(stripeCallsInside).toEqual([
			'lock',
			'sessions.list',
			'sessions.expire',
			'subscriptions.list',
			'sessions.create',
		]);
	});
});

describe('a webhook for a price the app does not know', () => {
	const nowSeconds = () => Math.floor(Date.now() / 1000);
	let errorSpy: ReturnType<typeof vi.spyOn>;

	afterEach(() => {
		errorSpy.mockRestore();
	});

	beforeEach(() => {
		errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.clearAllMocks();
		resetSubscriptions();
		process.env.STRIPE_PRICE_ID_STARTER = 'price_starter';
		process.env.STRIPE_PRICE_ID_PRO = 'price_pro';
		vi.mocked(orgRepo.findOrgByStripeCustomerId).mockResolvedValueOnce({
			id: 'org-1',
			planTier: 'FREE',
			stripeCustomerId: 'cus_1',
			stripeSubscriptionId: null,
		});
	});

	function deliver(created: number) {
		mockStripe.webhooks.constructEvent.mockReturnValueOnce({
			...subscriptionEvent('evt_price', 'customer.subscription.updated'),
			created,
		});
		return handleStripeWebhookEvent(Buffer.from(''), 'sig');
	}

	it('alerts the admins and still fails, so Stripe retries once it is fixed', async () => {
		mockSubscriptions(stripeSub('sub_1', 'active', 'price_unknown'));

		await expect(deliver(nowSeconds())).rejects.toThrow('price_unknown');

		expect(adminAlerts.sendUnknownStripePriceAlert).toHaveBeenCalledWith({
			priceId: 'price_unknown',
			eventId: 'evt_price',
			eventType: 'customer.subscription.updated',
			customerId: 'cus_1',
			priceEnvVars: ['STRIPE_PRICE_ID_STARTER', 'STRIPE_PRICE_ID_PRO'],
		});
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining('[billing] unknown-stripe-price price_unknown'),
		);
		expect(orgRepo.updateOrgPlanTx).not.toHaveBeenCalled();
	});

	it('does not alert again for a retry of an event over an hour old', async () => {
		mockSubscriptions(stripeSub('sub_1', 'active', 'price_unknown'));

		await expect(deliver(nowSeconds() - 2 * 60 * 60)).rejects.toThrow(
			'price_unknown',
		);

		expect(adminAlerts.sendUnknownStripePriceAlert).not.toHaveBeenCalled();
		// Still logged, so the failure is visible after the alert window.
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining('[billing] unknown-stripe-price'),
		);
	});

	it('does not alert for any other failure', async () => {
		mockStripe.subscriptions.list.mockReturnValueOnce({
			autoPagingToArray: async () => {
				throw new Error('Stripe is down');
			},
		});

		await expect(deliver(nowSeconds())).rejects.toThrow('Stripe is down');

		expect(adminAlerts.sendUnknownStripePriceAlert).not.toHaveBeenCalled();
	});
});
