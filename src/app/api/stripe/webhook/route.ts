import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { isUniqueViolationOn } from '@/server/lib/prisma-errors';
import { handleStripeWebhookEvent } from '@/server/services/billingService';

/**
 * Stripe webhook handler.
 *
 * Three-way error routing:
 *   - Invalid signature  → 400, logged without the payload. Stripe retries any
 *     non-2xx for up to three days, so a rotated or mistyped
 *     STRIPE_WEBHOOK_SECRET fails every delivery until the log is noticed.
 *     No email alert: anyone can send an unsigned request here.
 *   - Duplicate event    → 200 (P2002 on the stripeId UNIQUE only — already processed)
 *   - Any other error    → 500 (Stripe retries until success)
 *
 * CRITICAL: rawBody must be read via arrayBuffer() BEFORE any json() call.
 * Consuming the body stream invalidates Stripe signature verification.
 */
export async function POST(req: Request) {
	const rawBody = Buffer.from(await req.arrayBuffer());
	const signature = (await headers()).get('stripe-signature') ?? '';

	try {
		await handleStripeWebhookEvent(rawBody, signature);
		return NextResponse.json({ received: true });
	} catch (err) {
		if (err instanceof Stripe.errors.StripeSignatureVerificationError) {
			console.warn(
				'[stripe-webhook] Rejected a request whose signature did not verify. If every delivery fails, check STRIPE_WEBHOOK_SECRET against the endpoint signing secret.',
			);
			return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
		}

		// Only the event-id constraint means "already processed". A unique
		// violation anywhere else in the transaction is a real failure: answer
		// 500 so Stripe retries instead of dropping the event.
		if (isUniqueViolationOn(err, 'StripeWebhookEvent_stripeId_key')) {
			return NextResponse.json({ received: true, duplicate: true });
		}

		console.error('[stripe-webhook] Unhandled error', err);
		return NextResponse.json({ error: 'Internal error' }, { status: 500 });
	}
}
