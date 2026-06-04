import {
	GeocodeStatus,
	OpportunityStatus,
	Prisma,
} from '@/prisma/generated/client';
import { prisma } from '@/server/repositories/prisma';

const requirementSelect = {
	id: true,
	skillId: true,
	familyId: true,
	level: true,
	skill: { select: { id: true, name: true } },
	family: {
		select: {
			id: true,
			name: true,
			skills: { select: { id: true } },
		},
	},
} as const;

export async function getPublishedOpportunityById(
	orgSlug: string,
	opportunityId: string,
) {
	const org = await prisma.organization.findUnique({
		where: { slug: orgSlug },
		select: { id: true },
	});
	if (!org) return null;

	return prisma.volunteerOpportunity.findFirst({
		where: {
			id: opportunityId,
			orgId: org.id,
			status: OpportunityStatus.PUBLISHED,
		},
		select: {
			id: true,
			title: true,
			location: true,
			isRemote: true,
			startDate: true,
			endDate: true,
			commitmentHours: true,
		},
	});
}

export async function listPublishedOpportunities(orgSlug: string) {
	const org = await prisma.organization.findUnique({
		where: { slug: orgSlug },
		select: { id: true, name: true, slug: true },
	});

	if (!org) return null;

	const opportunities = await prisma.volunteerOpportunity.findMany({
		where: { orgId: org.id, status: OpportunityStatus.PUBLISHED },
		select: {
			id: true,
			title: true,
			description: true,
			location: true,
			lat: true,
			lng: true,
			geocodeStatus: true,
			isRemote: true,
			startDate: true,
			endDate: true,
			commitmentHours: true,
			capacity: true,
			tags: { select: { id: true, name: true } },
			requirements: { select: requirementSelect },
		},
		orderBy: { createdAt: 'desc' },
	});

	return { org, opportunities };
}

/**
 * List all geocoded published opportunities for the public /map page.
 * Only returns opportunities with geocodeStatus SUCCESS and valid lat/lng.
 */
export async function listForMap() {
	return prisma.volunteerOpportunity.findMany({
		where: {
			status: OpportunityStatus.PUBLISHED,
			geocodeStatus: GeocodeStatus.SUCCESS,
			lat: { not: null },
			lng: { not: null },
			organization: { suspendedAt: null },
		},
		select: {
			id: true,
			title: true,
			location: true,
			lat: true,
			lng: true,
			tags: { select: { id: true, name: true } },
			organization: { select: { name: true, slug: true } },
		},
		orderBy: { organization: { name: 'asc' } },
	});
}

/**
 * List published marketplace opportunities for the authenticated browse page.
 * Capped at 200 to prevent SSR OOM as the marketplace grows. Long-term: move
 * skill-match ranking server-side so this can be replaced with cursor pagination.
 */
export async function listAllPublishedOpportunities() {
	return prisma.volunteerOpportunity.findMany({
		where: {
			status: OpportunityStatus.PUBLISHED,
			organization: { marketplaceVisible: true, suspendedAt: null },
		},
		take: 200,
		select: {
			id: true,
			title: true,
			description: true,
			location: true,
			isRemote: true,
			startDate: true,
			endDate: true,
			commitmentHours: true,
			capacity: true,
			tags: { select: { id: true, name: true } },
			requirements: { select: requirementSelect },
			organization: { select: { id: true, name: true, slug: true } },
		},
		orderBy: { createdAt: 'desc' },
	});
}

// ---------------------------------------------------------------------------
// Phase 11 — Marketplace search + org discovery
// ---------------------------------------------------------------------------

function paginateCursor<T extends { id: string }>(
	items: T[],
	limit: number,
): { items: T[]; nextCursor: string | null } {
	const hasMore = items.length > limit;
	const page = hasMore ? items.slice(0, limit) : items;
	return { items: page, nextCursor: hasMore ? page[page.length - 1].id : null };
}

const marketplaceOpportunitySelect = {
	id: true,
	title: true,
	description: true,
	location: true,
	isRemote: true,
	startDate: true,
	endDate: true,
	commitmentHours: true,
	capacity: true,
	createdAt: true,
	tags: { select: { id: true, name: true } },
	requirements: { select: requirementSelect },
	organization: {
		select: { id: true, name: true, slug: true, logoUrl: true, verified: true },
	},
} as const;

export type MarketplaceOpportunity = Awaited<
	ReturnType<typeof searchMarketplaceOpportunities>
>['items'][number];

/**
 * Search published opportunities across marketplace-visible orgs.
 * Uses tsvector full-text search when a query string is provided.
 * Falls back to a plain cursor-paginated query when no query is given.
 */
export async function searchMarketplaceOpportunities(input: {
	query?: string;
	cursor?: string;
	isRemote?: boolean;
	limit?: number;
}) {
	const limit = Math.min(input.limit ?? 20, 50);

	if (input.query && input.query.trim().length > 0) {
		return searchWithTsvector(
			input.query.trim(),
			input.cursor,
			input.isRemote,
			limit,
		);
	}

	return browseMarketplace(input.cursor, input.isRemote, limit);
}

async function browseMarketplace(
	cursor: string | undefined,
	isRemote: boolean | undefined,
	limit: number,
) {
	const where: Prisma.VolunteerOpportunityWhereInput = {
		status: OpportunityStatus.PUBLISHED,
		organization: { marketplaceVisible: true, suspendedAt: null },
		...(isRemote !== undefined ? { isRemote } : {}),
	};

	const items = await prisma.volunteerOpportunity.findMany({
		where,
		select: marketplaceOpportunitySelect,
		orderBy: { createdAt: 'desc' },
		take: limit + 1,
		...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
	});

	return paginateCursor(items, limit);
}

async function searchWithTsvector(
	query: string,
	cursor: string | undefined,
	isRemote: boolean | undefined,
	limit: number,
) {
	// Sanitize: keep only alphanumeric and spaces (strips all tsvector operators)
	const sanitized = query
		.replace(/[^a-zA-Z0-9\s]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, 200);
	if (!sanitized) return browseMarketplace(cursor, isRemote, limit);

	// Build tsquery: each word becomes a prefix match (word:*)
	const tsquery = sanitized
		.split(/\s+/)
		.filter(Boolean)
		.map((w) => `${w}:*`)
		.join(' & ');

	type RawRow = { id: string };

	const remoteClause =
		isRemote !== undefined
			? Prisma.sql`AND o."isRemote" = ${isRemote}`
			: Prisma.empty;

	// Ranked search returns top results sorted by relevance. Cursor pagination is
	// incompatible with rank ordering, so we return all matching IDs up to `limit`
	// with no nextCursor. The UI hides "Load more" in search mode.
	const rows = await prisma.$queryRaw<RawRow[]>`
		SELECT o.id
		FROM "VolunteerOpportunity" o
		JOIN "Organization" org ON org.id = o."orgId"
		WHERE o.status = 'PUBLISHED'
		  AND org."marketplaceVisible" = true
		  AND org."suspendedAt" IS NULL
		  AND o."searchVector" @@ to_tsquery('english', ${tsquery})
		  ${remoteClause}
		ORDER BY ts_rank(o."searchVector", to_tsquery('english', ${tsquery})) DESC
		LIMIT ${limit}
	`;

	if (rows.length === 0) return { items: [], nextCursor: null };

	const ids = rows.map((r) => r.id);

	// Fetch full relations for the matching IDs, preserving rank order
	const full = await prisma.volunteerOpportunity.findMany({
		where: { id: { in: ids } },
		select: marketplaceOpportunitySelect,
	});

	const byId = Object.fromEntries(full.map((o) => [o.id, o]));
	const items = ids.map((id) => byId[id]).filter(Boolean);

	return { items, nextCursor: null };
}

/**
 * Opportunities with a startDate in the next 3 days (used for "This Weekend" section).
 */
export async function getThisWeekendOpportunities() {
	const now = new Date();
	const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

	return prisma.volunteerOpportunity.findMany({
		where: {
			status: OpportunityStatus.PUBLISHED,
			organization: { marketplaceVisible: true, suspendedAt: null },
			startDate: { gte: now, lte: in3Days },
		},
		select: {
			id: true,
			title: true,
			location: true,
			isRemote: true,
			startDate: true,
			organization: { select: { name: true, slug: true } },
		},
		orderBy: { startDate: 'asc' },
		take: 10,
	});
}

const marketplaceOrgSelect = {
	id: true,
	name: true,
	slug: true,
	logoUrl: true,
	description: true,
	location: true,
	causeAreaTags: true,
	verified: true,
	_count: {
		select: {
			opportunities: { where: { status: OpportunityStatus.PUBLISHED } },
			members: true,
		},
	},
} as const;

export type MarketplaceOrg = Awaited<
	ReturnType<typeof listMarketplaceOrgs>
>['items'][number];

/**
 * List organizations participating in the marketplace.
 * Cursor-paginated, sorted by opportunity count descending.
 */
export async function listMarketplaceOrgs(input: {
	cursor?: string;
	verified?: boolean;
	location?: string;
	limit?: number;
}) {
	const limit = Math.min(input.limit ?? 20, 50);

	const where: Prisma.OrganizationWhereInput = {
		marketplaceVisible: true,
		suspendedAt: null,
		...(input.verified !== undefined ? { verified: input.verified } : {}),
		...(input.location
			? { location: { contains: input.location, mode: 'insensitive' } }
			: {}),
	};

	const items = await prisma.organization.findMany({
		where,
		select: marketplaceOrgSelect,
		orderBy: [{ verified: 'desc' }, { name: 'asc' }, { id: 'asc' }],
		take: limit + 1,
		...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
	});

	return paginateCursor(items, limit);
}
