import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { Prisma } from '@/prisma/generated/client';
import {
	CheckrRequeueError,
	CheckrWebhookError,
	handleCheckrWebhookEvent,
} from '@/server/services/backgroundCheckService';

/**
 * Checkr webhook handler.
 *
 * Four-way error routing:
 *   - Bad signature or bad JSON  → 400 (Checkr does NOT retry 4xx)
 *   - Duplicate event            → 200 (P2002 on checkrId UNIQUE — already processed)
 *   - Unknown reportId (requeue) → 500 (Checkr retries for 72h on 5xx)
 *   - Any other error            → 500 (Checkr retries until success)
 *
 * CRITICAL: rawBody must be read via arrayBuffer() BEFORE any .json() call.
 * Consuming the body stream invalidates Checkr signature verification.
 */

// Opt out of static rendering — this route must run dynamically
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
	const rawBody = Buffer.from(await req.arrayBuffer());
	const signature = (await headers()).get('x-checkr-signature') ?? '';

	try {
		await handleCheckrWebhookEvent(rawBody, signature);
		return NextResponse.json({ received: true });
	} catch (err) {
		// Bad signature or bad JSON body → 400 (no retry from Checkr)
		if (err instanceof CheckrWebhookError) {
			return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
		}

		// Duplicate event (P2002 UNIQUE violation) → 200, already processed
		if (
			err instanceof Prisma.PrismaClientKnownRequestError &&
			err.code === 'P2002'
		) {
			return NextResponse.json({ received: true, duplicate: true });
		}

		// Unknown reportId → 500 so Checkr retries during its 72-hour window
		if (err instanceof CheckrRequeueError) {
			console.warn('[checkr-webhook] Requeue', err.message);
			return NextResponse.json({ error: 'Requeue' }, { status: 500 });
		}

		console.error('[checkr-webhook] Unhandled error', err);
		return NextResponse.json({ error: 'Internal error' }, { status: 500 });
	}
}
