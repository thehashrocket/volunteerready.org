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

	// -------------------------------------------------------------------------
	// Raw-body integrity.
	//
	// Added alongside the Next.js 16.2.12 bump, three of whose advisories
	// concern request-body handling (GHSA-4633-3j49-mh5q specifically about
	// invalid UTF-8). Stripe's constructEvent recomputes an HMAC over the exact
	// bytes it sent, so anything that re-encodes the body between the wire and
	// billingService rejects every legitimate webhook as forged.
	//
	// None of the status-code tests above can see that — they mock the verifier
	// away, so they stay green through a corruption that would take payments
	// down. Verification itself lives inside billingService, so what is asserted
	// here is the handoff: the bytes the route passes on are the bytes received.
	// -------------------------------------------------------------------------
	describe('raw body integrity', () => {
		it('hands billingService the exact bytes received, without re-encoding', async () => {
			const payload = JSON.stringify({ id: 'evt_1', type: 'invoice.paid' });
			vi.mocked(billingService.handleStripeWebhookEvent).mockResolvedValueOnce(
				undefined,
			);

			await POST(
				new Request('http://localhost/', { method: 'POST', body: payload }),
			);

			const [rawBody] = vi.mocked(billingService.handleStripeWebhookEvent).mock
				.calls[0];
			expect(Buffer.isBuffer(rawBody)).toBe(true);
			expect(rawBody.toString('utf8')).toBe(payload);
		});

		it('preserves invalid UTF-8 byte sequences byte-for-byte', async () => {
			// 0xFF/0xFE are not legal UTF-8. A .text()-then-re-encode round trip
			// replaces them with U+FFFD (0xEF 0xBF 0xBD), silently changing the
			// bytes the signature is computed over.
			const bytes = new Uint8Array([0x7b, 0x22, 0xff, 0xfe, 0x22, 0x7d]);
			vi.mocked(billingService.handleStripeWebhookEvent).mockResolvedValueOnce(
				undefined,
			);

			await POST(
				new Request('http://localhost/', { method: 'POST', body: bytes }),
			);

			const [rawBody] = vi.mocked(billingService.handleStripeWebhookEvent).mock
				.calls[0];
			expect(Uint8Array.from(rawBody)).toEqual(bytes);
		});

		it('never calls .json() — that would consume the stream first', async () => {
			const req = new Request('http://localhost/', {
				method: 'POST',
				body: JSON.stringify({ id: 'evt_1' }),
			});
			const jsonSpy = vi.spyOn(req, 'json');
			const arrayBufferSpy = vi.spyOn(req, 'arrayBuffer');
			vi.mocked(billingService.handleStripeWebhookEvent).mockResolvedValueOnce(
				undefined,
			);

			await POST(req);

			expect(jsonSpy).not.toHaveBeenCalled();
			expect(arrayBufferSpy).toHaveBeenCalledTimes(1);
		});

		it('forwards the stripe-signature header, empty string when absent', async () => {
			mockHeadersGet.mockReturnValue(null);
			vi.mocked(billingService.handleStripeWebhookEvent).mockResolvedValueOnce(
				undefined,
			);

			await POST(
				new Request('http://localhost/', { method: 'POST', body: '{}' }),
			);

			expect(mockHeadersGet).toHaveBeenCalledWith('stripe-signature');
			expect(
				vi.mocked(billingService.handleStripeWebhookEvent).mock.calls[0][1],
			).toBe('');
		});
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
