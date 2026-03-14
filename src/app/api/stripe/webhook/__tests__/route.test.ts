import Stripe from 'stripe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@/prisma/generated/client';

// ---------------------------------------------------------------------------
// Do NOT mock `stripe` here — the route handler only uses
// Stripe.errors.StripeSignatureVerificationError for `instanceof` checks,
// and the billingService (which creates the Stripe instance) is fully mocked.
// Using the real Stripe module lets us create proper error instances via
// Object.create without fighting the arrow-function-constructor restriction.
// ---------------------------------------------------------------------------

// Mock the billing service — the route handler is a thin HTTP wrapper;
// all logic lives in billingService.
vi.mock('@/server/services/billingService', () => ({
	handleStripeWebhookEvent: vi.fn(),
}));

// Mock next/headers — return a deterministic stripe-signature header.
const mockHeadersGet = vi.fn();
vi.mock('next/headers', () => ({
	headers: vi.fn(async () => ({ get: mockHeadersGet })),
}));

import * as billingService from '@/server/services/billingService';
import { POST } from '../route';

/**
 * Create a StripeSignatureVerificationError without calling its internal
 * constructor (which requires Stripe webhook internals). Using Object.create
 * gives us an instance that passes `instanceof` checks correctly.
 */
function makeStripeSignatureError(): Stripe.errors.StripeSignatureVerificationError {
	const err = Object.create(
		Stripe.errors.StripeSignatureVerificationError.prototype,
	) as Stripe.errors.StripeSignatureVerificationError;
	Object.defineProperty(err, 'message', {
		value: 'No signatures found matching the expected signature',
		configurable: true,
	});
	return err;
}

describe('POST /api/stripe/webhook', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockHeadersGet.mockReturnValue('t=12345,v1=abc');
	});

	it('returns 200 { received: true } for a valid, processed event', async () => {
		vi.mocked(billingService.handleStripeWebhookEvent).mockResolvedValueOnce(
			undefined,
		);

		const req = new Request('http://localhost/', {
			method: 'POST',
			body: JSON.stringify({
				id: 'evt_1',
				type: 'customer.subscription.created',
			}),
		});
		const res = await POST(req);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ received: true });
	});

	it('returns 400 { error: "Invalid signature" } for bad Stripe signature', async () => {
		vi.mocked(billingService.handleStripeWebhookEvent).mockRejectedValueOnce(
			makeStripeSignatureError(),
		);

		const req = new Request('http://localhost/', {
			method: 'POST',
			body: 'raw-body',
		});
		const res = await POST(req);

		// Stripe does NOT retry 4xx — return 400 to reject invalid requests.
		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({ error: 'Invalid signature' });
	});

	it('returns 200 { received: true, duplicate: true } for P2002 duplicate event', async () => {
		const dupError = new Prisma.PrismaClientKnownRequestError(
			'Unique constraint failed on the fields: (`stripeId`)',
			{ code: 'P2002', clientVersion: '7.0.0' },
		);
		vi.mocked(billingService.handleStripeWebhookEvent).mockRejectedValueOnce(
			dupError,
		);

		const req = new Request('http://localhost/', {
			method: 'POST',
			body: 'raw-body',
		});
		const res = await POST(req);

		// Stripe receives 200 — we already processed this event; not an error.
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ received: true, duplicate: true });
	});

	it('returns 500 { error: "Internal error" } for unexpected errors so Stripe retries', async () => {
		vi.mocked(billingService.handleStripeWebhookEvent).mockRejectedValueOnce(
			new Error('DB connection pool exhausted'),
		);

		const req = new Request('http://localhost/', {
			method: 'POST',
			body: 'raw-body',
		});
		const res = await POST(req);

		// Stripe sees 500 and will retry delivery — correct behavior.
		expect(res.status).toBe(500);
		expect(await res.json()).toEqual({ error: 'Internal error' });
	});
});
