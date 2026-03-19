import { sendEmail } from '@/server/lib/email';

export async function sendInviteToApplyEmail(input: {
	to: string;
	volunteerName: string;
	orgName: string;
	opportunityTitle: string;
	opportunityLink: string;
}) {
	await sendEmail(
		input.to,
		`You've been invited to apply to ${input.opportunityTitle} at ${input.orgName}`,
		`
        <h2 style="color: #1B3C2A; margin-bottom: 16px;">You've been invited to volunteer!</h2>
        <p>Hi ${input.volunteerName},</p>
        <p>
          <strong>${input.orgName}</strong> has personally invited you to apply for their
          volunteer opportunity: <strong>${input.opportunityTitle}</strong>.
        </p>
        <p style="margin: 24px 0;">
          <a
            href="${input.opportunityLink}"
            style="background-color: #1B3C2A; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;"
          >
            View &amp; Apply
          </a>
        </p>
        <p style="color: #6b7280; font-size: 14px;">
          If you didn't expect this email or don't recognize this organization, you can safely ignore it.
        </p>
    `,
	);
}
