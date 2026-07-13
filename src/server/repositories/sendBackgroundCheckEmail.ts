import { sendEmail } from '@/server/lib/email';

/**
 * Sends a notification email to org staff when a background check result
 * is CONSIDER — i.e., it requires manual review before a decision is made.
 */
export async function sendBackgroundCheckConsiderEmail(input: {
	to: string;
	volunteerName: string;
	orgName: string;
	requestId: string;
}): Promise<void> {
	const appUrl =
		process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.volunteerready.com';
	const reviewUrl = `${appUrl}/app/settings/background-checks`;

	await sendEmail(
		input.to,
		`Background check requires review — ${input.volunteerName}`,
		`
        <p>The background check for <strong>${input.volunteerName}</strong> at <strong>${input.orgName}</strong> has returned a <strong>Consider</strong> result.</p>
        <p>A "Consider" result means the check found something that requires your review before a decision can be made. Please log in to VolunteerReady to review the details and determine next steps.</p>
        <p><a href="${reviewUrl}" style="display: inline-block; background: #1B3C2A; color: #FAFAF8; padding: 8px 16px; border-radius: 8px; text-decoration: none;">Review Background Check</a></p>
        <p style="color: #787571; font-size: 0.875rem;">Request ID: ${input.requestId}</p>
        <p style="color: #787571; font-size: 0.875rem;">If you have questions, please contact your legal or HR team before taking action.</p>
    `,
	);
}
