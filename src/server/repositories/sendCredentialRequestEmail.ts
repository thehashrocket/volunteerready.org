import { getFromEmail, getResend } from '@/server/lib/resend';

/** Email asking a volunteer to share their credentials with an organization. */
export async function sendCredentialRequestEmail(opts: {
	to: string;
	volunteerName: string;
	orgName: string;
	profileUrl: string;
}) {
	await getResend().emails.send({
		from: getFromEmail(),
		to: opts.to,
		subject: `${opts.orgName} would like to see your verified credentials`,
		html: `
      <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; line-height: 1.5">
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
          <a href="${opts.profileUrl}" style="display: inline-block; padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px;">
            Share your credentials
          </a>
        </p>
        <p>If you don't want to share, you can simply ignore this email.</p>
        <p style="color: #6b7280; font-size: 0.875rem">— VolunteerReady</p>
      </div>
    `,
	});
}
