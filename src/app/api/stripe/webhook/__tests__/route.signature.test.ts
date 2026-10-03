import Stripe from 'stripe';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Real signature verification, end to end through the route.
//
// route.test.ts mocks billingService and billingService.test.ts mocks the whole
// stripe module, so without this file the verifier never runs in any test. A
// correctly signed webhook must be processed (200); a tampered, wrongly signed,
// stale or unsigned one must be refused with 400 and recorded nowhere. This
// goes red if an SDK upgrade changes constructEvent's tolerance or signature
// rules, or the error class it throws (the route would fall through to 500),
// or if billingService ever passes tolerance 0 or a different secret.
//
// Only the repositories and next/headers are mocked. The stripe module is
// real; no network call is made — constructEvent and generateTestHeaderString
// are pure HMAC. The secret key below is a placeholder, never a real key.
// ---------------------------------------------------------------------------

// Hoisted so the env vars are set before billingService reads them at import,
// and returned so the signer below uses the same values.
const { WEBHOOK_SECRET, SECRET_KEY } = vi.hoisted(() => {
	const values = {
		WEBHOOK_SECRET: 'whsec_offline_test_secret',
		SECRET_KEY: 'sk_test_offline_placeholder',
	};
	process.env.STRIPE_SECRET_KEY = values.SECRET_KEY;
	process.env.STRIPE_WEBHOOK_SECRET = values.WEBHOOK_SECRET;
	return values;
});

const mockHeadersGet = vi.fn();
vi.mock('next/headers', () => ({
	headers: vi.fn(async () => ({ get: mockHeadersGet })),
}));

vi.mock('@/server/repositories/orgRepo', () => ({
	findOrgByStripeCustomerId: vi.fn(async () => null),
	findOrgWithOwnerEmail: vi.fn(async () => null),
	updateOrgPlanTx: vi.fn(async () => ({})),
}));
vi.mock('@/server/repositories/companyRepo', () => ({
	findCompanyByStripeCustomerId: vi.fn(async () => null),
	findCompanyWithOwnerEmail: vi.fn(async () => null),
	updateCompanyPlanTx: vi.fn(async () => ({})),
}));
vi.mock('@/server/repositories/webhookRepo', () => ({
	isWebhookEventProcessed: vi.fn(async () => false),
	markWebhookEventProcessedTx: vi.fn(async () => ({})),
}));
vi.mock('@/server/repositories/auditRepo', () => ({
	writeAuditLogTx: vi.fn(async () => ({})),
}));
vi.mock('@/server/repositories/send-billing-emails', () => ({
	sendPlanUpgradeEmail: vi.fn(async () => {}),
	sendPaymentFailedEmail: vi.fn(async () => {}),
	sendCancellationEmail: vi.fn(async () => {}),
}));
vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		$transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
			fn({}),
		),
		stripeWebhookEvent: { create: vi.fn(async () => ({})) },
	},
}));

import { prisma } from '@/server/repositories/prisma';
import { POST } from '../route';

const signer = new Stripe(SECRET_KEY);

const payload = JSON.stringify({
	id: 'evt_sig_1',
	object: 'event',
	type: 'invoice.paid',
	data: { object: { id: 'in_1' } },
});

function sign(
	body: string,
	opts: { secret?: string; timestamp?: number } = {},
): string {
	return signer.webhooks.generateTestHeaderString({
		payload: body,
		secret: opts.secret ?? WEBHOOK_SECRET,
		timestamp: opts.timestamp ?? Math.floor(Date.now() / 1000),
	});
}

async function post(body: string, signature: string) {
	mockHeadersGet.mockReturnValue(signature);
	return POST(new Request('http://localhost/', { method: 'POST', body }));
}

describe('POST /api/stripe/webhook — real signature verification', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('accepts a correctly signed payload and processes the event', async () => {
		const res = await post(payload, sign(payload));

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ received: true });
		expect(prisma.stripeWebhookEvent.create).toHaveBeenCalledWith({
			data: expect.objectContaining({
				stripeId: 'evt_sig_1',
				type: 'invoice.paid',
			}),
		});
	});

	it.each([
		{
			name: 'body tampered after signing',
			body: payload.replace('in_1', 'in_2'),
			signature: () => sign(payload),
		},
		{
			name: 'signed with a different secret',
			body: payload,
			signature: () => sign(payload, { secret: 'whsec_attacker' }),
		},
		{
			// Default tolerance is 300s. Passing tolerance 0 would disable this.
			name: 'timestamp outside the default tolerance window',
			body: payload,
			signature: () =>
				sign(payload, { timestamp: Math.floor(Date.now() / 1000) - 600 }),
		},
		{
			name: 'missing signature header',
			body: payload,
			signature: () => '',
		},
	])('refuses with 400 when $name', async ({ body, signature }) => {
		const res = await post(body, signature());

		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({ error: 'Invalid signature' });
		expect(prisma.stripeWebhookEvent.create).not.toHaveBeenCalled();
	});

	it('refuses with 400 when STRIPE_WEBHOOK_SECRET is unset, even for a payload signed with an empty key', async () => {
		// billingService falls back to '' when the env var is missing, so the
		// only thing stopping an empty-key forgery is the SDK refusing an empty
		// secret. Pin that, so an SDK upgrade that drops the guard goes red.
		const saved = process.env.STRIPE_WEBHOOK_SECRET;
		delete process.env.STRIPE_WEBHOOK_SECRET;
		vi.resetModules();
		try {
			const { POST: freshPost } = await import('../route');
			const { prisma: freshPrisma } = await import(
				'@/server/repositories/prisma'
			);
			mockHeadersGet.mockReturnValue(sign(payload, { secret: '' }));
			const res = await freshPost(
				new Request('http://localhost/', { method: 'POST', body: payload }),
			);

			expect(res.status).toBe(400);
			expect(await res.json()).toEqual({ error: 'Invalid signature' });
			expect(freshPrisma.stripeWebhookEvent.create).not.toHaveBeenCalled();
		} finally {
			process.env.STRIPE_WEBHOOK_SECRET = saved;
			vi.resetModules();
		}
	});
});
