import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import {
	SterlingSignatureError,
	SterlingWebhookError,
} from '@/server/lib/adapters/background-check/sterling';
import { handleSterlingWebhookEvent } from '@/server/services/backgroundCheckService';

/**
 * Sterling webhook handler.
 *
 * Error routing (mirrors Checkr pattern):
 *   - Bad signature or bad JSON  → 400 (Sterling does NOT retry 4xx)
 *   - Unknown reportId (requeue) → 500 (Sterling retries on 5xx)
 *   - Any other error            → 500 (retry until success)
 *
 * CRITICAL: rawBody must be read via arrayBuffer() BEFORE any .json() call.
 * Consuming the body stream invalidates Sterling signature verification.
 */

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
	const rawBody = Buffer.from(await req.arrayBuffer());
	const signature = (await headers()).get('x-sterling-signature') ?? '';

	try {
		await handleSterlingWebhookEvent(rawBody, signature);
		return NextResponse.json({ received: true });
	} catch (err) {
		// Bad signature or bad JSON → 400 (no retry)
		if (
			err instanceof SterlingWebhookError ||
			err instanceof SterlingSignatureError
		) {
			return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
		}

		console.error('[sterling-webhook] Unhandled error', err);
		return NextResponse.json({ error: 'Internal error' }, { status: 500 });
	}
}
