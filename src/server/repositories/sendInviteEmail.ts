import { buildEmailHtml } from '@/server/lib/email-template';
import { getFromEmail, getResend } from '@/server/lib/resend';

export async function sendInviteEmail(input: {
	to: string;
	orgName: string;
	inviteLink: string;
	role: string;
}) {
	const from = getFromEmail();

	await getResend().emails.send({
		from,
		to: input.to,
		subject: `You've been invited to join ${input.orgName} on VolunteerReady`,
		html: buildEmailHtml(`
        <p>You've been invited to join <strong>${input.orgName}</strong> as <strong>${input.role}</strong>.</p>
        <p><a href="${input.inviteLink}" style="color: #1B3C2A;">Accept invitation</a></p>
        <p>This invitation expires in 48 hours. If you didn't expect this, you can ignore this email.</p>
    `),
	});
}
