import { buildEmailHtml } from '@/server/lib/email-template';
import { getFromEmail, getResend } from '@/server/lib/resend';

export async function sendStatusLinkEmail(input: { to: string; link: string }) {
	const from = getFromEmail();

	await getResend().emails.send({
		from,
		to: input.to,
		subject: 'Your volunteer application status link',
		html: buildEmailHtml(`
        <p>Here's your secure, one-time link to view your application status:</p>
        <p><a href="${input.link}" style="color: #1B3C2A;">View status</a></p>
        <p>This link expires in 30 minutes and can only be used once.</p>
        <p>If you didn't request this, you can ignore this email.</p>
    `),
	});
}
