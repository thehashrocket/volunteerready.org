import { describe, expect, it } from 'vitest';
import { buildMagicLinkEmail } from '@/lib/email/auth';

describe('buildMagicLinkEmail', () => {
	const url = 'https://volunteerready.org/api/auth/callback/email?token=abc123';

	it('returns correct subject line with VolunteerReady brand', () => {
		const { subject } = buildMagicLinkEmail(url);
		expect(subject).toBe('Sign in to VolunteerReady');
	});

	it('does not reference VolunteerMatch', () => {
		const { subject, html } = buildMagicLinkEmail(url);
		expect(subject).not.toContain('VolunteerMatch');
		expect(html).not.toContain('VolunteerMatch');
	});

	it('includes the sign-in URL in the CTA link', () => {
		const { html } = buildMagicLinkEmail(url);
		expect(html).toContain(`href="${url}"`);
	});

	it('uses DESIGN.md forest green for the CTA button', () => {
		const { html } = buildMagicLinkEmail(url);
		expect(html).toContain('background: #1B3C2A');
	});

	it('includes safety disclaimer text', () => {
		const { html } = buildMagicLinkEmail(url);
		expect(html).toContain('If you did not request this email');
	});

	it('returns inner HTML only (no wrapper — sendEmail wraps it)', () => {
		const { html } = buildMagicLinkEmail(url);
		// Should NOT contain the branded header/footer — that's added by buildEmailHtml()
		expect(html).not.toContain('VolunteerReady</span>');
		expect(html).not.toContain('#F5F4F0'); // sand footer color
	});
});
