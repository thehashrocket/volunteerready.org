import Stripe from 'stripe';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
	customers: { create: vi.fn() },
	checkout: { sessions: { create: vi.fn() } },
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
	updateOrgPlanTx: vi.fn(async () => ({})),
}));

vi.mock('@/server/repositories/companyRepo', () => ({
	findCompanyByStripeCustomerId: vi.fn(async () => null),
	updateCompanyPlanTx: vi.fn(async () => ({})),
}));

vi.mock('@/server/repositories/webhookRepo', () => ({
	isWebhookEventProcessed: vi.fn(async () => false),
	markWebhookEventProcessedTx: vi.fn(async () => ({})),
}));

vi.mock('@/server/repositories/auditRepo', () => ({
	writeAuditLogTx: vi.fn(async () => ({})),
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

import * as orgRepo from '@/server/repositories/orgRepo';
import { prisma } from '@/server/repositories/prisma';
import * as webhookRepo from '@/server/repositories/webhookRepo';
import {
	createCheckoutSession,
	handleStripeWebhookEvent,
} from '../billingService';

describe('createCheckoutSession', () => {
	beforeEach(() => {
		vi.clearAllMocks();
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
		});
		mockStripe.webhooks.constructEvent.mockReturnValueOnce({
			id: 'evt_del',
			type: 'customer.subscription.deleted',
			data: {
				object: { id: 'sub_1', customer: 'cus_1' },
			},
		});

		await handleStripeWebhookEvent(Buffer.from(''), 'sig');

		expect(prisma.$transaction).toHaveBeenCalled();
	});
});
