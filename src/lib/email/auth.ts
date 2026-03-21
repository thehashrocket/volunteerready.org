/**
 * Magic link email content.
 *
 * Returns inner HTML only — the branded wrapper (forest green header,
 * sand footer) is applied by `sendEmail()` via `buildEmailHtml()`.
 */
export function buildMagicLinkEmail(url: string) {
	return {
		subject: 'Sign in to VolunteerReady',
		html: `
      <h2 style="margin: 0 0 8px; font-size: 20px; font-weight: 600; color: #252422;">
        Sign in to VolunteerReady
      </h2>
      <p style="margin: 0 0 24px; color: #3D3B38;">
        Click the button below to sign in to your account.
      </p>
      <a
        href="${url}"
        style="display: inline-block; padding: 12px 24px; background: #1B3C2A; color: #fff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600;"
      >
        Sign in
      </a>
      <p style="margin-top: 24px; font-size: 14px; color: #787571;">
        If you did not request this email, you can safely ignore it.
      </p>
    `,
	};
}
