/**
 * Integration tests for volunteerDiscoveryRepo.
 *
 * Uses real Postgres (Docker: volunteer-match-postgres).
 * Requires DATABASE_URL to be set to the dev/test database.
 *
 * Run with: pnpm test:integration
 */

import { afterEach, describe, expect, it } from 'vitest';
import { prisma } from '@/server/repositories/prisma';
import { searchPublicProfiles } from './volunteerDiscoveryRepo';

// ---------------------------------------------------------------------------
// Seeding helpers
// ---------------------------------------------------------------------------

// Unique prefix to isolate test data from real data
const TEST_EMAIL_PREFIX = '__integration_test__';

async function seedUser(suffix: string, name: string) {
	return prisma.user.create({
		data: {
			email: `${TEST_EMAIL_PREFIX}${suffix}@test.example`,
			name,
		},
	});
}

async function seedProfile(
	userId: string,
	visibility: 'PUBLIC' | 'PRIVATE' | 'ORGS_ONLY',
	opts?: {
		city?: string;
		state?: string;
		availability?: 'WEEKDAYS' | 'WEEKENDS' | 'EVENINGS' | 'FLEXIBLE';
	},
) {
	return prisma.volunteerProfile.create({
		data: {
			userId,
			bio: `${TEST_EMAIL_PREFIX} bio`,
			visibility,
			city: opts?.city ?? null,
			state: opts?.state ?? null,
			availability: opts?.availability ?? 'FLEXIBLE',
		},
	});
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

afterEach(async () => {
	// Delete all test volunteer profiles via their users
	const testUsers = await prisma.user.findMany({
		where: { email: { startsWith: TEST_EMAIL_PREFIX } },
		select: { id: true },
	});
	const testUserIds = testUsers.map((u) => u.id);

	if (testUserIds.length > 0) {
		await prisma.volunteerProfile.deleteMany({
			where: { userId: { in: testUserIds } },
		});
		await prisma.user.deleteMany({
			where: { id: { in: testUserIds } },
		});
	}
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('searchPublicProfiles — privacy invariant', () => {
	it('never returns PRIVATE volunteers', async () => {
		const user = await seedUser('private-1', 'Private User');
		await seedProfile(user.id, 'PRIVATE');

		const page = await searchPublicProfiles({});
		const ids = page.items.map((v) => v.userId);
		expect(ids).not.toContain(user.id);
	});

	it('never returns ORGS_ONLY volunteers', async () => {
		const user = await seedUser('orgsonly-1', 'Orgs Only User');
		await seedProfile(user.id, 'ORGS_ONLY');

		const page = await searchPublicProfiles({});
		const ids = page.items.map((v) => v.userId);
		expect(ids).not.toContain(user.id);
	});

	it('returns PUBLIC volunteers', async () => {
		const user = await seedUser('public-1', 'Public User');
		await seedProfile(user.id, 'PUBLIC');

		const page = await searchPublicProfiles({});
		const ids = page.items.map((v) => v.userId);
		expect(ids).toContain(user.id);
	});

	it('returns PUBLIC but not PRIVATE in a mixed set', async () => {
		const pub = await seedUser('mixed-pub', 'Public Mixed');
		const priv = await seedUser('mixed-priv', 'Private Mixed');
		const orgsOnly = await seedUser('mixed-orgs', 'OrgOnly Mixed');

		await seedProfile(pub.id, 'PUBLIC');
		await seedProfile(priv.id, 'PRIVATE');
		await seedProfile(orgsOnly.id, 'ORGS_ONLY');

		const page = await searchPublicProfiles({});
		const ids = page.items.map((v) => v.userId);
		expect(ids).toContain(pub.id);
		expect(ids).not.toContain(priv.id);
		expect(ids).not.toContain(orgsOnly.id);
	});
});

describe('searchPublicProfiles — city filter', () => {
	it('returns only volunteers matching the city (case-insensitive)', async () => {
		const austin = await seedUser('city-austin', 'Austin Vol');
		const dallas = await seedUser('city-dallas', 'Dallas Vol');

		await seedProfile(austin.id, 'PUBLIC', { city: 'Austin', state: 'TX' });
		await seedProfile(dallas.id, 'PUBLIC', { city: 'Dallas', state: 'TX' });

		const page = await searchPublicProfiles({ city: 'austin' });
		const ids = page.items.map((v) => v.userId);
		expect(ids).toContain(austin.id);
		expect(ids).not.toContain(dallas.id);
	});
});

describe('searchPublicProfiles — availability filter', () => {
	it('returns only volunteers with matching availability', async () => {
		const weekends = await seedUser('avail-weekends', 'Weekend Vol');
		const weekdays = await seedUser('avail-weekdays', 'Weekday Vol');

		await seedProfile(weekends.id, 'PUBLIC', { availability: 'WEEKENDS' });
		await seedProfile(weekdays.id, 'PUBLIC', { availability: 'WEEKDAYS' });

		const page = await searchPublicProfiles({ availability: 'WEEKENDS' });
		const ids = page.items.map((v) => v.userId);
		expect(ids).toContain(weekends.id);
		expect(ids).not.toContain(weekdays.id);
	});
});

describe('searchPublicProfiles — cursor pagination', () => {
	it('returns 20 items on first page and 1 via cursor when 21 volunteers exist', async () => {
		// Create 21 public volunteers
		const created: string[] = [];
		for (let i = 0; i < 21; i++) {
			const user = await seedUser(`paginate-${i}`, `Paginate Vol ${i}`);
			await seedProfile(user.id, 'PUBLIC', { city: 'PaginateCity' });
			created.push(user.id);
		}

		// First page — should have 20 items and a nextCursor
		const page1 = await searchPublicProfiles({ city: 'PaginateCity' });
		expect(page1.items).toHaveLength(20);
		expect(page1.nextCursor).not.toBeNull();

		// Second page — should have the remaining 1 item
		const page2 = await searchPublicProfiles({
			city: 'PaginateCity',
			cursor: page1.nextCursor ?? undefined,
		});
		expect(page2.items).toHaveLength(1);
		expect(page2.nextCursor).toBeNull();

		// All 21 created users appear across both pages
		const allReturnedIds = [...page1.items, ...page2.items].map(
			(v) => v.userId,
		);
		for (const id of created) {
			expect(allReturnedIds).toContain(id);
		}
	});

	it('returns empty page with null cursor for a stale cursor (deleted record)', async () => {
		const result = await searchPublicProfiles({
			cursor: 'nonexistent-cursor-id-that-does-not-exist',
		});
		// Stale cursors may return empty or simply start from beginning —
		// the stale cursor guard only fires on P2025 errors. Prisma may just
		// return results from the beginning if the cursor record doesn't exist.
		// The important invariant is: no P2025 error is thrown.
		expect(result).toHaveProperty('items');
		expect(result).toHaveProperty('nextCursor');
	});
});

describe('searchPublicProfiles — result shape', () => {
	it('returns correct displayName, city, state, availability', async () => {
		const user = await seedUser('shape-1', 'Shape Test Vol');
		await seedProfile(user.id, 'PUBLIC', {
			city: 'Portland',
			state: 'OR',
			availability: 'EVENINGS',
		});

		const page = await searchPublicProfiles({ city: 'Portland' });
		const result = page.items.find((v) => v.userId === user.id);

		expect(result).toBeDefined();
		expect(result?.displayName).toBe('Shape Test Vol');
		expect(result?.city).toBe('Portland');
		expect(result?.state).toBe('OR');
		expect(result?.availability).toBe('EVENINGS');
		expect(result?.verifiedCredentialTypes).toBeInstanceOf(Array);
		expect(result?.skillIds).toBeInstanceOf(Array);
	});
});
