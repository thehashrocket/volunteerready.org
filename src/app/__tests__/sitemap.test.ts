import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		organization: { findMany: vi.fn(async () => []) },
	},
}));

import { getSitemapPages } from '@/lib/public-pages';
import { prisma } from '@/server/repositories/prisma';
import sitemap from '../sitemap';

describe('sitemap()', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('includes all static routes from registry', async () => {
		const result = await sitemap();
		const urls = result.map((r) => r.url);
		expect(result.length).toBeGreaterThanOrEqual(getSitemapPages().length);
		for (const page of getSitemapPages()) {
			const expectedUrl =
				page.href === '/'
					? 'https://www.volunteerready.org'
					: `https://www.volunteerready.org${page.href}`;
			expect(urls).toContain(expectedUrl);
		}
	});

	it('includes /search in sitemap', async () => {
		const result = await sitemap();
		const urls = result.map((r) => r.url);
		expect(urls).toContain('https://www.volunteerready.org/search');
	});

	it('includes dynamic org routes', async () => {
		vi.mocked(prisma.organization.findMany).mockResolvedValueOnce([
			{
				slug: 'test-org',
				updatedAt: new Date('2026-01-01'),
				consentToPublicize: false,
			},
		] as never);

		const result = await sitemap();
		const urls = result.map((r) => r.url);
		expect(urls).toContain('https://www.volunteerready.org/apply/test-org');
		expect(urls).toContain(
			'https://www.volunteerready.org/opportunities/test-org',
		);
	});

	it('only includes story routes for orgs with consent', async () => {
		vi.mocked(prisma.organization.findMany).mockResolvedValueOnce([
			{ slug: 'consented', updatedAt: new Date(), consentToPublicize: true },
			{ slug: 'no-consent', updatedAt: new Date(), consentToPublicize: false },
		] as never);

		const result = await sitemap();
		const urls = result.map((r) => r.url);
		expect(urls).toContain('https://www.volunteerready.org/stories/consented');
		expect(urls).not.toContain(
			'https://www.volunteerready.org/stories/no-consent',
		);
	});

	it('returns only static routes when no orgs exist', async () => {
		const result = await sitemap();
		expect(result.length).toBe(getSitemapPages().length);
	});
});
