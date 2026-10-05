// @vitest-environment jsdom
// Value: protects=the survey form only renders for a link we sent, posts no
// token of its own, and the page is never indexed; fails_when=the page stops
// validating the cookie token or drops noindex; why_new=the page had no
// tests; seam=none
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/repositories/prisma', () => ({ prisma: {} }));
const survey = vi.hoisted(() => ({ findSurveyOrg: vi.fn() }));
vi.mock('@/server/services/org-feedback-service', async (importOriginal) => ({
	...(await importOriginal<object>()),
	findSurveyOrg: survey.findSurveyOrg,
}));
const jar = vi.hoisted(() => ({ token: undefined as string | undefined }));
vi.mock('next/headers', () => ({
	cookies: async () => ({
		get: (name: string) =>
			name === 'org-feedback-token-DAY_7-riverside' && jar.token !== undefined
				? { name, value: jar.token }
				: undefined,
	}),
}));

import FeedbackPage, { generateMetadata } from '../page';

function page(params: { org?: string; type?: string }) {
	return FeedbackPage({ searchParams: Promise.resolve(params) });
}

beforeEach(() => {
	survey.findSurveyOrg.mockReset();
	survey.findSurveyOrg.mockResolvedValue({ id: 'org-1' });
	jar.token = 'a'.repeat(64);
});

describe('feedback survey page', () => {
	it('renders the survey for a valid link, with no token in the form', async () => {
		const { container } = render(
			await page({ org: 'riverside', type: 'DAY_7' }),
		);

		const form = container.querySelector('form');
		expect(form).not.toBeNull();
		const data = new FormData(form as HTMLFormElement);
		expect(data.get('orgSlug')).toBe('riverside');
		expect(data.get('type')).toBe('DAY_7');
		expect(data.get('token')).toBeNull();
		expect(container.innerHTML).not.toContain(jar.token);
		expect(survey.findSurveyOrg).toHaveBeenCalledWith({
			orgSlug: 'riverside',
			type: 'DAY_7',
			token: jar.token,
		});
	});

	it('shows the invalid-link page when there is no survey cookie', async () => {
		jar.token = undefined;

		const { container } = render(
			await page({ org: 'riverside', type: 'DAY_7' }),
		);

		expect(screen.getByText('Invalid feedback link')).toBeInTheDocument();
		expect(container.querySelector('form')).toBeNull();
	});

	it('shows the invalid-link page when the token does not match', async () => {
		survey.findSurveyOrg.mockResolvedValue(null);

		const { container } = render(
			await page({ org: 'riverside', type: 'DAY_7' }),
		);

		expect(screen.getByText('Invalid feedback link')).toBeInTheDocument();
		expect(container.querySelector('form')).toBeNull();
	});

	it('is never indexed', async () => {
		expect(await generateMetadata()).toMatchObject({
			robots: { index: false },
		});
	});

	it('shows the invalid-link page for a repeated org parameter', async () => {
		const { container } = render(
			await FeedbackPage({
				searchParams: Promise.resolve({
					org: ['riverside', 'hillside'],
					type: 'DAY_7',
				}),
			}),
		);

		expect(screen.getByText('Invalid feedback link')).toBeInTheDocument();
		expect(container.querySelector('form')).toBeNull();
	});
});
