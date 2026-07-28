import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { normalizeEmail } from '@/server/domain/org-volunteer';
import { prisma } from '@/server/repositories/prisma';

/**
 * Resend webhook handler — tracks email delivery lifecycle events.
 *
 * Resend sends: email.sent, email.delivered, email.bounced, email.complained
 *
 * Error routing (mirrors Stripe/Checkr pattern):
 *   - Bad signature       → 400 (Resend does NOT retry 4xx)
 *   - Processed event     → 200 (best-effort log, no idempotency key needed)
 *   - Any other error     → 500 (Resend retries)
 *
 * Bounce management: on BOUNCED events, increments EmailBounceStatus.bounceCount.
 * When count reaches 3 (MAX_REENABLE_CAP), sets suppressedAt — sendEmail()
 * will skip delivery for that address until admin resets.
 */

export const dynamic = 'force-dynamic';

const MAX_REENABLE_CAP = 3;

type ResendWebhookPayload = {
	type: string;
	data: {
		email_id?: string;
		to?: string[];
		subject?: string;
		[key: string]: unknown;
	};
};

const EVENT_TYPE_MAP: Record<
	string,
	'SENT' | 'DELIVERED' | 'BOUNCED' | 'COMPLAINED'
> = {
	'email.sent': 'SENT',
	'email.delivered': 'DELIVERED',
	'email.bounced': 'BOUNCED',
	'email.complained': 'COMPLAINED',
};

function verifyResendSignature(rawBody: Buffer, signature: string): boolean {
	const secret = process.env.RESEND_WEBHOOK_SECRET;
	if (!secret) {
		console.warn(
			'[resend-webhook] RESEND_WEBHOOK_SECRET not set, skipping verification',
		);
		return true; // Allow in dev, but log warning
	}

	const expected = crypto
		.createHmac('sha256', secret)
		.update(rawBody)
		.digest('hex');

	const sigBuf = Buffer.from(signature);
	const expBuf = Buffer.from(expected);
	if (sigBuf.length !== expBuf.length) return false;
	return crypto.timingSafeEqual(sigBuf, expBuf);
}

export async function POST(req: Request) {
	const rawBody = Buffer.from(await req.arrayBuffer());
	const signature = req.headers.get('svix-signature') ?? '';

	// Verify signature
	if (
		process.env.RESEND_WEBHOOK_SECRET &&
		!verifyResendSignature(rawBody, signature)
	) {
		return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
	}

	let payload: ResendWebhookPayload;
	try {
		payload = JSON.parse(rawBody.toString('utf-8'));
	} catch {
		return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
	}

	const eventType = EVENT_TYPE_MAP[payload.type];
	if (!eventType) {
		// Unknown event type — acknowledge without processing
		return NextResponse.json({ received: true, skipped: true });
	}

	const resendId = payload.data?.email_id ?? null;
	const recipients = payload.data?.to ?? [];
	const subject = (payload.data?.subject as string) ?? '';

	try {
		// Log event for each recipient
		for (const to of recipients) {
			// TWO KEYS, deliberately. Do not merge them back into one.
			//
			// `EmailEvent.to` uses the canonical form so webhook rows file under
			// the same key as the SENT and SUPPRESSED_UNCLAIMED rows sendEmail
			// writes — those event types are read together to answer "what
			// happened to this person's mail?", and a split key makes that
			// question need two lookups.
			//
			// `EmailBounceStatus.email` stays bare-lowercased: that is the key
			// `sendEmail`'s bounce lookup uses, and the table is deliberately
			// excluded from T1 canonicalization. Normalizing it here would desync
			// the two halves of bounce suppression and silently stop suppressing.
			const eventKey = normalizeEmail(to);
			const email = to.toLowerCase();

			// Idempotency: skip if this exact event was already processed
			const existing =
				resendId &&
				(await prisma.emailEvent.findFirst({
					where: { resendId, to: eventKey, eventType },
					select: { id: true },
				}));
			if (existing) continue;

			await prisma.emailEvent.create({
				data: {
					resendId,
					to: eventKey,
					subject,
					eventType,
					payload: payload.data as object,
				},
			});

			// Bounce management (only runs for genuinely new events)
			if (eventType === 'BOUNCED' || eventType === 'COMPLAINED') {
				await prisma.emailBounceStatus.upsert({
					where: { email },
					create: {
						email,
						bounceCount: 1,
						lastBouncedAt: new Date(),
						suppressedAt: null, // Not suppressed on first bounce
					},
					update: {
						bounceCount: { increment: 1 },
						lastBouncedAt: new Date(),
					},
				});

				// Check if we need to suppress
				const updated = await prisma.emailBounceStatus.findUnique({
					where: { email },
					select: { bounceCount: true, suppressedAt: true },
				});

				if (
					updated &&
					updated.bounceCount >= MAX_REENABLE_CAP &&
					!updated.suppressedAt
				) {
					await prisma.emailBounceStatus.update({
						where: { email },
						data: { suppressedAt: new Date() },
					});
					console.warn(
						'[resend-webhook] Address suppressed after bounce cap:',
						email,
					);
				}
			}
		}

		return NextResponse.json({ received: true });
	} catch (err) {
		console.error('[resend-webhook] Processing error:', err);
		return NextResponse.json({ error: 'Internal error' }, { status: 500 });
	}
}
