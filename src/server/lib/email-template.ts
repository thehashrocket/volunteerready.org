/** Wraps email content in the branded VolunteerReady template. */
export function buildEmailHtml(content: string): string {
	return `
    <div style="font-family: system-ui,-apple-system,Segoe UI,Roboto,sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #1B3C2A; padding: 24px; border-radius: 8px 8px 0 0;">
        <span style="color: white; font-size: 18px; font-weight: 600;">VolunteerReady</span>
      </div>
      <div style="padding: 24px; line-height: 1.6; color: #3D3B38;">
        ${content}
      </div>
      <div style="background-color: #F5F4F0; padding: 16px 24px; border-radius: 0 0 8px 8px;">
        <p style="color: #787571; font-size: 14px; margin: 0;">
          Sent via <a href="https://volunteerready.org" style="color: #1B3C2A; text-decoration: none;">VolunteerReady</a>
        </p>
      </div>
    </div>
  `;
}
