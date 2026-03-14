import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { Prisma } from '@/prisma/generated/client';
import { handleStripeWebhookEvent } from '@/server/services/billingService';

/**
 * Stripe webhook handler.
 *
 * Three-way error routing:
 *   - Invalid signature  → 400 (Stripe does NOT retry 4xx)
 *   - Duplicate event    → 200 (P2002 on stripeId UNIQUE — already processed)
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
			return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
		}

		if (
			err instanceof Prisma.PrismaClientKnownRequestError &&
			err.code === 'P2002'
		) {
			// Duplicate event — already processed, not an error
			return NextResponse.json({ received: true, duplicate: true });
		}

		console.error('[stripe-webhook] Unhandled error', err);
		return NextResponse.json({ error: 'Internal error' }, { status: 500 });
	}
}
