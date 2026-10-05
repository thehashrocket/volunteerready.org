// Value: protects=only a survey link we sent moves its token into an httpOnly
// cookie scoped to that survey, and the visitor lands on a token-free URL;
// fails_when=the redirect keeps the token, the cookie loses httpOnly/path, or
// an unverified link gets a cookie; why_new=new route; seam=none
import { beforeEach, describe, expect, it, vi } from 'vitest';

const survey = vi.hoisted(() => ({ findSurveyOrg: vi.fn() }));
vi.mock('@/server/services/org-feedback-service', () => survey);

import { GET } from '../route';

const TOKEN = 'a'.repeat(64);

function start(query: string, origin = 'https://volunteerready.org') {
	return GET(new Request(`${origin}/screening/feedback/start?${query}`));
}

beforeEach(() => {
	survey.findSurveyOrg.mockReset();
	survey.findSurveyOrg.mockResolvedValue({ id: 'org-1' });
});

describe('GET /screening/feedback/start', () => {
	it('moves a verified token into a survey cookie and redirects without it', async () => {
		const res = await start(`org=riverside&type=DAY_7&token=${TOKEN}`);

		expect(survey.findSurveyOrg).toHaveBeenCalledWith({
			orgSlug: 'riverside',
			type: 'DAY_7',
			token: TOKEN,
		});
		expect(res.status).toBe(303);
		const location = new URL(res.headers.get('location') ?? '');
		expect(location.pathname).toBe('/screening/feedback');
		expect(location.searchParams.get('org')).toBe('riverside');
		expect(location.searchParams.get('type')).toBe('DAY_7');
		expect(location.search).not.toContain(TOKEN);

		const cookie = res.headers.get('set-cookie') ?? '';
		expect(cookie).toContain(`org-feedback-token-DAY_7-riverside=${TOKEN}`);
		expect(cookie).toMatch(/HttpOnly/i);
		expect(cookie).toMatch(/Path=\/screening\/feedback/);
		expect(cookie).toMatch(/SameSite=lax/i);
		expect(cookie).toMatch(/Secure/i);
		expect(res.headers.get('referrer-policy')).toBe('no-referrer');
	});

	it('sets no cookie for a link that does not verify', async () => {
		survey.findSurveyOrg.mockResolvedValue(null);

		const res = await start(`org=made-up-org&type=DAY_7&token=${TOKEN}`);

		expect(res.status).toBe(303);
		expect(res.headers.get('set-cookie')).toBeNull();
	});

	it('sets no cookie when the link has no token', async () => {
		const res = await start('org=riverside&type=DAY_7');

		expect(res.headers.get('set-cookie')).toBeNull();
		expect(survey.findSurveyOrg).not.toHaveBeenCalled();
	});

	it('sends a link with an unknown survey type to the bare survey page', async () => {
		const res = await start(`org=riverside&type=DAY_99&token=${TOKEN}`);

		const location = new URL(res.headers.get('location') ?? '');
		expect(location.pathname).toBe('/screening/feedback');
		expect(location.search).toBe('');
		expect(res.headers.get('set-cookie')).toBeNull();
	});

	it('keeps the redirect on the same origin', async () => {
		const res = await start(
			`org=${encodeURIComponent('//evil.example')}&type=DAY_7&token=${TOKEN}`,
		);

		expect(new URL(res.headers.get('location') ?? '').origin).toBe(
			'https://volunteerready.org',
		);
	});

	it('keeps each org and survey type in its own cookie', async () => {
		const day30 = await start(`org=riverside&type=DAY_30&token=${TOKEN}`);
		const otherOrg = await start(`org=hillside&type=DAY_7&token=${TOKEN}`);

		expect(day30.headers.get('set-cookie')).toContain(
			'org-feedback-token-DAY_30-riverside=',
		);
		expect(otherOrg.headers.get('set-cookie')).toContain(
			'org-feedback-token-DAY_7-hillside=',
		);
	});
});
