/** Wraps email content in the branded VolunteerReady template. */
export function buildEmailHtml(content: string): string {
	return `
    <div style="font-family: system-ui,-apple-system,'Segoe UI',Roboto,sans-serif; max-width: 600px; margin: 0 auto; background-color: #FAFAF8;">
      <div style="background-color: #1B3C2A; padding: 24px 32px; border-radius: 8px 8px 0 0;">
        <span style="font-family: Georgia,'Times New Roman',serif; color: #FAFAF8; font-size: 20px; font-weight: 700; letter-spacing: -0.01em;">VolunteerReady</span>
      </div>
      <div style="padding: 32px 24px; line-height: 1.6; font-size: 16px; color: #141311; background-color: #FAFAF8;">
        ${content}
      </div>
      <div style="background-color: #F5F4F0; padding: 20px 24px; border-radius: 0 0 8px 8px;">
        <p style="color: #787571; font-size: 13px; margin: 0;">
          Sent via <a href="https://www.volunteerready.org" style="color: #1B3C2A; text-decoration: none; font-weight: 500;">VolunteerReady</a>
        </p>
      </div>
    </div>
  `;
}
