// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
	findUnique: vi.fn(
		async () => ({ name: 'Named Org' }) as { name: string } | null,
	),
}));
vi.mock('@/server/repositories/prisma', () => ({
	prisma: { organization: { findUnique: db.findUnique } },
}));
const history = vi.hoisted(() => ({
	findCurrentSlugByHistory: vi.fn(
		async (_slug: string) => null as string | null,
	),
}));
vi.mock('@/server/repositories/orgRepo', () => history);
vi.mock('@/components/tracked-link', () => ({
	TrackedLink: ({ children }: { children: React.ReactNode }) => (
		<a href="/">{children}</a>
	),
}));

import { PLATFORM_ORG_SLUG } from '@/server/domain/reference-data';
import ReferralPage from '../page';

beforeEach(() => {
	vi.clearAllMocks();
	db.findUnique.mockResolvedValue({ name: 'Named Org' });
	history.findCurrentSlugByHistory.mockReset();
	history.findCurrentSlugByHistory.mockResolvedValue(null);
});

describe('referral page', () => {
	it('names the referring org', async () => {
		render(
			await ReferralPage({ searchParams: Promise.resolve({ from: 'named' }) }),
		);
		expect(screen.getAllByText(/Named Org/).length).toBeGreaterThan(0);
	});

	// Value: protects=the internal platform org is never shown as a referrer;
	// fails_when=getReferringOrgName stops excluding the platform slug;
	// why_new=the page had no tests; seam=none
	it('never names the platform org', async () => {
		render(
			await ReferralPage({
				searchParams: Promise.resolve({ from: PLATFORM_ORG_SLUG }),
			}),
		);
		expect(screen.queryByText(/Named Org/)).toBeNull();
		expect(db.findUnique).not.toHaveBeenCalled();
	});

	it('never names the platform org through an old slug either', async () => {
		db.findUnique.mockImplementation((async (args: {
			where: { slug: string };
		}) =>
			args.where.slug === PLATFORM_ORG_SLUG
				? { name: 'Platform' }
				: null) as never);
		history.findCurrentSlugByHistory.mockResolvedValue(PLATFORM_ORG_SLUG);

		render(
			await ReferralPage({
				searchParams: Promise.resolve({ from: 'old-slug' }),
			}),
		);

		expect(screen.queryByText(/Platform/)).toBeNull();
	});
});
