import { buildEmailHtml } from '@/server/lib/email-template';
import { getFromEmail, getResend } from '@/server/lib/resend';

/**
 * Send a branded email via Resend.
 *
 * Wraps `htmlContent` in the VolunteerReady branded template (forest green
 * header, sand footer). Catches and logs errors — callers decide whether
 * to await or fire-and-forget.
 */
export async function sendEmail(
	to: string,
	subject: string,
	htmlContent: string,
): Promise<boolean> {
	try {
		const from = getFromEmail();
		await getResend().emails.send({
			from,
			to,
			subject,
			html: buildEmailHtml(htmlContent),
		});
		return true;
	} catch (err) {
		console.error('[sendEmail] Failed to send email:', { to, subject, err });
		return false;
	}
}
