import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		organization: { findMany: vi.fn(async () => []) },
	},
}));

import { prisma } from '@/server/repositories/prisma';
import sitemap from '../sitemap';

describe('sitemap()', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('includes all static routes', async () => {
		const result = await sitemap();
		const urls = result.map((r) => r.url);
		expect(urls).toContain('https://www.volunteerready.org');
		expect(urls).toContain('https://www.volunteerready.org/about');
		expect(urls).toContain('https://www.volunteerready.org/how-it-works');
		expect(urls).toContain('https://www.volunteerready.org/pricing');
		expect(urls).toContain('https://www.volunteerready.org/screening');
		expect(urls).toContain('https://www.volunteerready.org/privacy');
		expect(urls).toContain('https://www.volunteerready.org/terms');
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

	it('returns empty dynamic routes when no orgs exist', async () => {
		const result = await sitemap();
		// Should only have static routes (11 total)
		expect(result.length).toBe(11);
	});
});
