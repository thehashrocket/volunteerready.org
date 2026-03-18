import { sendEmail } from '@/server/lib/email';

/** Email asking a volunteer to share their credentials with an organization. */
export async function sendCredentialRequestEmail(opts: {
	to: string;
	volunteerName: string;
	orgName: string;
	profileUrl: string;
}) {
	await sendEmail(
		opts.to,
		`${opts.orgName} would like to see your verified credentials`,
		`
        <p>Hi ${opts.volunteerName || 'there'},</p>
        <p>
          <strong>${opts.orgName}</strong> noticed you have verified credentials on VolunteerReady
          and would like you to share them.
        </p>
        <p>
          Sharing your credentials means ${opts.orgName} can verify your background without
          requiring you to go through the process again.
        </p>
        <p>
          <a href="${opts.profileUrl}" style="display: inline-block; padding: 10px 20px; background: #1B3C2A; color: white; text-decoration: none; border-radius: 6px;">
            Share your credentials
          </a>
        </p>
        <p>If you don't want to share, you can simply ignore this email.</p>
    `,
	);
}
