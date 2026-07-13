/**
 * Unit tests for orgRepo slug-history lookup (issue #127, decision 4A).
 * findCurrentSlugByHistory backs the /apply/{oldSlug} redirect.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockHistoryFindFirst = vi.fn();
const mockOrgFindUnique = vi.fn();

vi.mock('./prisma', () => ({
	prisma: {
		orgSlugHistory: {
			findFirst: (...args: unknown[]) => mockHistoryFindFirst(...args),
		},
		organization: {
			findUnique: (...args: unknown[]) => mockOrgFindUnique(...args),
		},
	},
}));

import { findCurrentSlugByHistory, getOrgProfile } from './orgRepo';

beforeEach(() => {
	vi.clearAllMocks();
});

describe('findCurrentSlugByHistory', () => {
	it('returns the current slug for a renamed org', async () => {
		mockHistoryFindFirst.mockResolvedValue({
			organization: { slug: 'new-slug', suspendedAt: null },
		});
		await expect(findCurrentSlugByHistory('old-slug')).resolves.toBe(
			'new-slug',
		);
		expect(mockHistoryFindFirst).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { oldSlug: 'old-slug' },
				orderBy: { createdAt: 'desc' },
			}),
		);
	});

	it('returns null when no history row matches', async () => {
		mockHistoryFindFirst.mockResolvedValue(null);
		await expect(findCurrentSlugByHistory('never-existed')).resolves.toBeNull();
	});

	it('returns null when the org is suspended — no redirect to frozen tenants', async () => {
		mockHistoryFindFirst.mockResolvedValue({
			organization: { slug: 'new-slug', suspendedAt: new Date('2026-01-01') },
		});
		await expect(findCurrentSlugByHistory('old-slug')).resolves.toBeNull();
	});
});

describe('getOrgProfile', () => {
	it('selects only id, name, and slug', async () => {
		mockOrgFindUnique.mockResolvedValue({
			id: 'org1',
			name: 'Org',
			slug: 'org',
		});
		await expect(getOrgProfile('org1')).resolves.toEqual({
			id: 'org1',
			name: 'Org',
			slug: 'org',
		});
		expect(mockOrgFindUnique).toHaveBeenCalledWith({
			where: { id: 'org1' },
			select: { id: true, name: true, slug: true },
		});
	});
});
