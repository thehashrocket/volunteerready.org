import { buildEmailHtml } from '@/server/lib/email-template';
import { getFromEmail, getResend } from '@/server/lib/resend';

/** Fire-and-forget email notifying a volunteer that their credential was claimed. */
export async function sendCredentialClaimedEmail(opts: {
	to: string;
	volunteerName: string;
	credentialType: string;
	claimingOrgName: string;
}) {
	const typeName = opts.credentialType.replace(/_/g, ' ').toLowerCase();

	await getResend().emails.send({
		from: getFromEmail(),
		to: opts.to,
		subject: `Your ${typeName} credential was claimed by ${opts.claimingOrgName}`,
		html: buildEmailHtml(`
        <p>Hi ${opts.volunteerName || 'there'},</p>
        <p>
          Your <strong>${typeName}</strong> credential has been claimed by
          <strong>${opts.claimingOrgName}</strong> via a share link you generated.
        </p>
        <p>
          This means ${opts.claimingOrgName} now has a verified copy of your credential
          on file. You don't need to do anything else.
        </p>
        <p>If you didn't expect this, you can revoke active share links from your profile page.</p>
    `),
	});
}
