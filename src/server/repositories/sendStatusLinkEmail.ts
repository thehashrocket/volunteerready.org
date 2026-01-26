import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendStatusLinkEmail(input: { to: string; link: string }) {
	const from = process.env.RESEND_FROM_EMAIL;
	if (!from) throw new Error('RESEND_FROM_EMAIL is not set');

	await resend.emails.send({
		from,
		to: input.to,
		subject: 'Your volunteer application status link',
		html: `
      <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; line-height: 1.4">
        <p>Here’s your secure, one-time link to view your application status:</p>
        <p><a href="${input.link}">View status</a></p>
        <p>This link expires in 30 minutes and can only be used once.</p>
        <p>If you didn’t request this, you can ignore this email.</p>
      </div>
    `,
	});
}
