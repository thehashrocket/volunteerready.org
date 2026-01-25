export function buildMagicLinkEmail(url: string) {
	return {
		subject: 'Sign in to VolunteerMatch',
		html: `
      <div style="font-family: Arial, sans-serif; color: #111;">
        <h2 style="margin-bottom: 8px;">VolunteerMatch</h2>
        <p style="margin: 0 0 16px;">Use the button below to sign in.</p>
        <a
          href="${url}"
          style="display: inline-block; padding: 10px 16px; background: #111; color: #fff; text-decoration: none; border-radius: 6px;"
        >
          Sign in
        </a>
        <p style="margin-top: 16px; font-size: 12px; color: #666;">
          If you did not request this email, you can safely ignore it.
        </p>
      </div>
    `,
	};
}
