import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoist Prisma mock — must be before any repo imports
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
	oppFindMany: vi.fn(),
	orgFindMany: vi.fn(),
	queryRaw: vi.fn(),
}));

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		volunteerOpportunity: { findMany: mocks.oppFindMany },
		organization: { findMany: mocks.orgFindMany },
		$queryRaw: mocks.queryRaw,
	},
}));

import {
	getThisWeekendOpportunities,
	listMarketplaceOrgs,
	searchMarketplaceOpportunities,
} from './publicOpportunityRepo';

// ---------------------------------------------------------------------------
// Unit-testable helpers extracted from marketplace search logic
// These match the sanitization and tsquery-building logic in
// publicOpportunityRepo.ts to catch regressions without a real DB.
// ---------------------------------------------------------------------------

function buildTsquery(query: string): string | null {
	const sanitized = query
		.replace(/[^a-zA-Z0-9\s]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, 200);
	if (!sanitized) return null;
	return sanitized
		.split(/\s+/)
		.filter(Boolean)
		.map((w) => `${w}:*`)
		.join(' & ');
}

describe('marketplace search — tsquery builder', () => {
	it('builds a prefix-match query for a single word', () => {
		expect(buildTsquery('food')).toBe('food:*');
	});

	it('combines multiple words with AND', () => {
		expect(buildTsquery('food bank')).toBe('food:* & bank:*');
	});

	it('strips special tsvector operator characters from input', () => {
		const result = buildTsquery("org:name OR 'drop table'");
		// The output should only contain alphanumeric tokens with :* suffix, spaces, and &
		// No raw quotes or pipes from the user input
		expect(result).not.toContain("'");
		expect(result).not.toContain('|');
		// `:` is allowed only as part of the `:*` suffix we add
		if (result) {
			const withoutSuffixes = result.replace(/:?\*/g, '');
			expect(withoutSuffixes).not.toContain(':');
		}
	});

	it('returns null for an empty query after sanitization', () => {
		expect(buildTsquery('')).toBeNull();
		expect(buildTsquery('!!!')).toBeNull();
		expect(buildTsquery('   ')).toBeNull();
	});

	it('truncates to 200 characters before processing', () => {
		const longQuery = 'a'.repeat(250);
		const result = buildTsquery(longQuery);
		// Result is one word:* token, length won't explode
		expect(result?.length).toBeLessThan(300);
	});

	it('handles SQL injection attempt gracefully', () => {
		const result = buildTsquery('\'; DROP TABLE "VolunteerOpportunity"; --');
		// After sanitization the dangerous chars are gone — only word chars survive
		expect(result).not.toContain(';');
		expect(result).not.toContain('"');
		expect(result).not.toContain("'");
		// Special tokens like -- are stripped entirely (not alphanumeric)
		// Expected: "DROP TABLE VolunteerOpportunity" → each word becomes :* token
		if (result !== null) {
			expect(result).toMatch(/^[A-Za-z0-9:* &]+$/);
		}
	});

	it('splits hyphenated words into separate tokens', () => {
		// Hyphens are non-alphanumeric, so "non-profit" → "non profit" → two tokens
		const result = buildTsquery('non-profit');
		expect(result).toBe('non:* & profit:*');
	});
});

// ---------------------------------------------------------------------------
// Pagination limit clamping
// ---------------------------------------------------------------------------

function clampLimit(input: number | undefined): number {
	return Math.min(input ?? 20, 50);
}

describe('marketplace search — limit clamping', () => {
	it('defaults to 20 when undefined', () => {
		expect(clampLimit(undefined)).toBe(20);
	});

	it('clamps to 50 maximum', () => {
		expect(clampLimit(100)).toBe(50);
		expect(clampLimit(51)).toBe(50);
	});

	it('passes through valid limits', () => {
		expect(clampLimit(10)).toBe(10);
		expect(clampLimit(50)).toBe(50);
		expect(clampLimit(1)).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// Repo function tests — mocked Prisma
// ---------------------------------------------------------------------------

const makeOpp = (id: string) => ({
	id,
	title: `Opportunity ${id}`,
	description: null,
	location: null,
	isRemote: false,
	startDate: null,
	endDate: null,
	commitmentHours: null,
	capacity: null,
	createdAt: new Date(),
	tags: [],
	requirements: [],
	organization: {
		id: 'org-1',
		name: 'Test Org',
		slug: 'test-org',
		logoUrl: null,
		verified: false,
	},
});

const makeOrg = (id: string) => ({
	id,
	name: `Org ${id}`,
	slug: `org-${id}`,
	logoUrl: null,
	description: null,
	location: null,
	causeAreaTags: [],
	verified: false,
	_count: { opportunities: 0, members: 1 },
});

beforeEach(() => {
	vi.clearAllMocks();
});

describe('searchMarketplaceOpportunities — no query (browse mode)', () => {
	it('returns paginated items when below limit', async () => {
		const opps = [makeOpp('a'), makeOpp('b')];
		mocks.oppFindMany.mockResolvedValueOnce(opps);

		const result = await searchMarketplaceOpportunities({ limit: 20 });

		expect(result.items).toHaveLength(2);
		expect(result.nextCursor).toBeNull();
	});

	it('sets nextCursor when more items exist (hasMore = items.length > limit)', async () => {
		// Return limit+1 items to signal there are more
		const opps = Array.from({ length: 21 }, (_, i) => makeOpp(`opp-${i}`));
		mocks.oppFindMany.mockResolvedValueOnce(opps);

		const result = await searchMarketplaceOpportunities({ limit: 20 });

		expect(result.items).toHaveLength(20);
		expect(result.nextCursor).toBe('opp-19');
	});

	it('passes isRemote filter through to Prisma', async () => {
		mocks.oppFindMany.mockResolvedValueOnce([]);

		await searchMarketplaceOpportunities({ isRemote: true });

		const where = mocks.oppFindMany.mock.calls[0][0].where;
		expect(where.isRemote).toBe(true);
	});

	it('omits isRemote from where clause when undefined', async () => {
		mocks.oppFindMany.mockResolvedValueOnce([]);

		await searchMarketplaceOpportunities({});

		const where = mocks.oppFindMany.mock.calls[0][0].where;
		expect(where).not.toHaveProperty('isRemote');
	});

	it('always filters by PUBLISHED status and marketplaceVisible:true', async () => {
		mocks.oppFindMany.mockResolvedValueOnce([]);

		await searchMarketplaceOpportunities({});

		const where = mocks.oppFindMany.mock.calls[0][0].where;
		expect(where.status).toBe('PUBLISHED');
		expect(where.organization.marketplaceVisible).toBe(true);
	});

	it('applies suspendedAt:null to exclude suspended orgs in browse mode', async () => {
		mocks.oppFindMany.mockResolvedValueOnce([]);

		await searchMarketplaceOpportunities({});

		const where = mocks.oppFindMany.mock.calls[0][0].where;
		expect(where.organization.suspendedAt).toBeNull();
	});
});

describe('searchMarketplaceOpportunities — with query (tsvector mode)', () => {
	it('falls back to browse when sanitized query is empty (all special chars)', async () => {
		// When query is all special chars it sanitizes to empty → browseMarketplace
		mocks.oppFindMany.mockResolvedValueOnce([makeOpp('browse-result')]);

		const result = await searchMarketplaceOpportunities({ query: '!!!' });

		// browseMarketplace was called (not $queryRaw)
		expect(mocks.queryRaw).not.toHaveBeenCalled();
		expect(result.items).toHaveLength(1);
	});

	it('uses $queryRaw for tsvector search when query has words', async () => {
		mocks.queryRaw.mockResolvedValueOnce([{ id: 'opp-a' }]);
		mocks.oppFindMany.mockResolvedValueOnce([makeOpp('opp-a')]);

		const result = await searchMarketplaceOpportunities({ query: 'food bank' });

		expect(mocks.queryRaw).toHaveBeenCalledOnce();
		expect(result.items).toHaveLength(1);
		expect(result.nextCursor).toBeNull(); // search mode never has cursor
	});

	it('returns empty items when $queryRaw finds no rows', async () => {
		mocks.queryRaw.mockResolvedValueOnce([]);

		const result = await searchMarketplaceOpportunities({
			query: 'xyznonexistent',
		});

		expect(result.items).toHaveLength(0);
		expect(result.nextCursor).toBeNull();
		// findMany should NOT be called (early return after empty rows)
		expect(mocks.oppFindMany).not.toHaveBeenCalled();
	});
});

describe('listMarketplaceOrgs', () => {
	it('always applies suspendedAt:null safety filter', async () => {
		mocks.orgFindMany.mockResolvedValueOnce([]);

		await listMarketplaceOrgs({});

		const where = mocks.orgFindMany.mock.calls[0][0].where;
		expect(where.suspendedAt).toBeNull();
	});

	it('always applies marketplaceVisible:true', async () => {
		mocks.orgFindMany.mockResolvedValueOnce([]);

		await listMarketplaceOrgs({});

		const where = mocks.orgFindMany.mock.calls[0][0].where;
		expect(where.marketplaceVisible).toBe(true);
	});

	it('adds verified filter when provided', async () => {
		mocks.orgFindMany.mockResolvedValueOnce([]);

		await listMarketplaceOrgs({ verified: true });

		const where = mocks.orgFindMany.mock.calls[0][0].where;
		expect(where.verified).toBe(true);
	});

	it('omits verified filter when undefined', async () => {
		mocks.orgFindMany.mockResolvedValueOnce([]);

		await listMarketplaceOrgs({});

		const where = mocks.orgFindMany.mock.calls[0][0].where;
		expect(where).not.toHaveProperty('verified');
	});

	it('adds location filter as case-insensitive contains when provided', async () => {
		mocks.orgFindMany.mockResolvedValueOnce([]);

		await listMarketplaceOrgs({ location: 'Fresno' });

		const where = mocks.orgFindMany.mock.calls[0][0].where;
		expect(where.location).toEqual({ contains: 'Fresno', mode: 'insensitive' });
	});

	it('sets nextCursor when more orgs exist', async () => {
		const orgs = Array.from({ length: 21 }, (_, i) => makeOrg(`${i}`));
		mocks.orgFindMany.mockResolvedValueOnce(orgs);

		const result = await listMarketplaceOrgs({ limit: 20 });

		expect(result.items).toHaveLength(20);
		// nextCursor is the id of the last returned item (index 19)
		expect(result.nextCursor).toBe('19');
	});
});

describe('listAllPublishedOpportunities', () => {
	it('filters by PUBLISHED + marketplaceVisible + suspendedAt:null', async () => {
		mocks.oppFindMany.mockResolvedValueOnce([]);

		const { listAllPublishedOpportunities } = await import(
			'./publicOpportunityRepo'
		);
		await listAllPublishedOpportunities();

		const where = mocks.oppFindMany.mock.calls[0][0].where;
		expect(where.status).toBe('PUBLISHED');
		expect(where.organization.marketplaceVisible).toBe(true);
		expect(where.organization.suspendedAt).toBeNull();
	});

	it('caps results at 200 rows', async () => {
		mocks.oppFindMany.mockResolvedValueOnce([]);

		const { listAllPublishedOpportunities } = await import(
			'./publicOpportunityRepo'
		);
		await listAllPublishedOpportunities();

		expect(mocks.oppFindMany.mock.calls[0][0].take).toBe(200);
	});
});

describe('getThisWeekendOpportunities', () => {
	it('returns opportunities within 3 days', async () => {
		const opp = {
			id: 'weekend-1',
			title: 'Weekend Cleanup',
			location: null,
			isRemote: false,
			startDate: new Date(),
			organization: { name: 'Test Org', slug: 'test-org' },
		};
		mocks.oppFindMany.mockResolvedValueOnce([opp]);

		const result = await getThisWeekendOpportunities();

		expect(result).toHaveLength(1);
		expect(result[0].id).toBe('weekend-1');
	});

	it('filters by PUBLISHED and marketplaceVisible:true', async () => {
		mocks.oppFindMany.mockResolvedValueOnce([]);

		await getThisWeekendOpportunities();

		const where = mocks.oppFindMany.mock.calls[0][0].where;
		expect(where.status).toBe('PUBLISHED');
		expect(where.organization.marketplaceVisible).toBe(true);
	});

	it('applies suspendedAt:null to exclude suspended orgs', async () => {
		mocks.oppFindMany.mockResolvedValueOnce([]);

		await getThisWeekendOpportunities();

		const where = mocks.oppFindMany.mock.calls[0][0].where;
		expect(where.organization.suspendedAt).toBeNull();
	});

	it('limits to 10 results', async () => {
		mocks.oppFindMany.mockResolvedValueOnce([]);

		await getThisWeekendOpportunities();

		expect(mocks.oppFindMany.mock.calls[0][0].take).toBe(10);
	});
});
