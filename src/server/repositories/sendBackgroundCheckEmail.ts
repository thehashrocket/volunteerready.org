import { getFromEmail, getResend } from '@/server/lib/resend';

/**
 * Sends a notification email to org staff when a background check result
 * is CONSIDER — i.e., it requires manual review before a decision is made.
 *
 * Follows sendInviteEmail.ts pattern.
 */
export async function sendBackgroundCheckConsiderEmail(input: {
	to: string;
	volunteerName: string;
	orgName: string;
	requestId: string;
}): Promise<void> {
	const from = getFromEmail();

	const appUrl =
		process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.volunteerready.com';
	const reviewUrl = `${appUrl}/app/credentials`;

	await getResend().emails.send({
		from,
		to: input.to,
		subject: `Background check requires review — ${input.volunteerName}`,
		html: `
      <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; line-height: 1.4">
        <p>The background check for <strong>${input.volunteerName}</strong> at <strong>${input.orgName}</strong> has returned a <strong>Consider</strong> result.</p>
        <p>A "Consider" result means the check found something that requires your review before a decision can be made. Please log in to VolunteerReady to review the details and determine next steps.</p>
        <p><a href="${reviewUrl}" style="background: #2563eb; color: white; padding: 8px 16px; border-radius: 6px; text-decoration: none; display: inline-block;">Review Background Check</a></p>
        <p style="color: #6b7280; font-size: 0.875rem;">Request ID: ${input.requestId}</p>
        <p style="color: #6b7280; font-size: 0.875rem;">If you have questions, please contact your legal or HR team before taking action.</p>
      </div>
    `,
	});
}
