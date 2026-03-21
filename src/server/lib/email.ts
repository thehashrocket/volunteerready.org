import { buildEmailHtml } from '@/server/lib/email-template';
import { getFromEmail, getResend } from '@/server/lib/resend';
import { prisma } from '@/server/repositories/prisma';

const MAX_REENABLE_CAP = 3;

/**
 * Send a branded email via Resend.
 *
 * Wraps `htmlContent` in the VolunteerReady branded template (forest green
 * header, sand footer). Catches and logs errors — callers decide whether
 * to await or fire-and-forget.
 *
 * Bounce suppression: if the recipient has bounced >= MAX_REENABLE_CAP (3)
 * times and is currently suppressed, the email is silently skipped unless
 * `isCritical` is true (e.g., FCRA adverse action notices).
 *
 * Logs a SENT EmailEvent on success (best-effort, never blocks).
 */
export async function sendEmail(
	to: string,
	subject: string,
	htmlContent: string,
	opts?: { isCritical?: boolean },
): Promise<boolean> {
	try {
		// Check bounce suppression (skip for critical emails)
		if (!opts?.isCritical) {
			const bounceStatus = await prisma.emailBounceStatus.findUnique({
				where: { email: to.toLowerCase() },
				select: { suppressedAt: true, bounceCount: true },
			});
			if (
				bounceStatus?.suppressedAt &&
				bounceStatus.bounceCount >= MAX_REENABLE_CAP
			) {
				console.warn('[sendEmail] Skipping suppressed address:', {
					to,
					bounceCount: bounceStatus.bounceCount,
				});
				return false;
			}
		}

		const from = getFromEmail();
		const result = await getResend().emails.send({
			from,
			to,
			subject,
			html: buildEmailHtml(htmlContent),
		});

		// Log SENT event (best-effort)
		const resendId = result?.data?.id ?? null;
		prisma.emailEvent
			.create({
				data: {
					resendId,
					to: to.toLowerCase(),
					subject,
					eventType: 'SENT',
				},
			})
			.catch((err) => {
				console.error('[sendEmail] Failed to log SENT event:', err);
			});

		return true;
	} catch (err) {
		console.error('[sendEmail] Failed to send email:', { to, subject, err });
		return false;
	}
}
