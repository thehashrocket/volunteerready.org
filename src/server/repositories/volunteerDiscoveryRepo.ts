/**
 * Volunteer Discovery Repository — volunteer search for org staff.
 *
 * PRIVACY INVARIANT: visibility = 'PUBLIC' is ALWAYS applied as a
 * structural WHERE clause. This is not caller-supplied and cannot be
 * bypassed. Any volunteer with PRIVATE or ORGS_ONLY visibility is
 * never returned, regardless of filters.
 *
 * ┌─────────────────────────────────────────────────────────┐
 * │  searchPublicProfiles(filters)                          │
 * │    WHERE visibility = 'PUBLIC'   ← hardcoded invariant  │
 * │    AND   skill filter            ← optional             │
 * │    AND   credentialType filter   ← optional             │
 * │    AND   city / state filter     ← optional             │
 * │    AND   availability filter     ← optional             │
 * │    ORDER BY updatedAt DESC       ← cursor-compatible    │
 * │    TAKE 20                       ← enforced in repo     │
 * └─────────────────────────────────────────────────────────┘
 */

import { Prisma } from '@/prisma/generated/client';
import { prisma } from './prisma';

export interface DiscoveryFilters {
	skillIds?: string[];
	credentialTypes?: string[];
	city?: string;
	state?: string;
	availability?: string;
	cursor?: string;
}

export interface VolunteerSearchResult {
	userId: string;
	displayName: string;
	city: string | null;
	state: string | null;
	availability: string | null;
	verifiedCredentialTypes: string[];
	skillIds: string[];
	updatedAt: Date;
}

export interface SearchPage {
	items: VolunteerSearchResult[];
	nextCursor: string | null;
}

const PAGE_SIZE = 20;

export async function searchPublicProfiles(
	filters: DiscoveryFilters,
): Promise<SearchPage> {
	// biome-ignore lint/suspicious/noExplicitAny: Prisma where clause built dynamically
	const where: any = {
		// PRIVACY INVARIANT — hardcoded, never caller-supplied
		visibility: 'PUBLIC',
	};

	if (filters.skillIds?.length) {
		where.user = {
			...where.user,
			volunteerSkills: {
				some: { skillId: { in: filters.skillIds } },
			},
		};
	}

	if (filters.credentialTypes?.length) {
		where.user = {
			...where.user,
			credentials: {
				some: {
					type: { in: filters.credentialTypes },
					status: 'VERIFIED',
				},
			},
		};
	}

	if (filters.city) {
		where.city = { equals: filters.city, mode: 'insensitive' };
	}

	if (filters.state) {
		where.state = { equals: filters.state, mode: 'insensitive' };
	}

	if (filters.availability) {
		where.availability = filters.availability;
	}

	try {
		const results = await prisma.volunteerProfile.findMany({
			where,
			...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
			take: PAGE_SIZE + 1,
			orderBy: { updatedAt: 'desc' },
			include: {
				user: {
					select: {
						name: true,
						credentials: {
							where: { status: 'VERIFIED' },
							select: { type: true },
						},
						volunteerSkills: {
							select: { skillId: true },
						},
					},
				},
			},
		});

		const hasNextPage = results.length === PAGE_SIZE + 1;
		const items = hasNextPage ? results.slice(0, PAGE_SIZE) : results;
		const nextCursor = hasNextPage ? (items[PAGE_SIZE - 1]?.id ?? null) : null;

		return {
			items: items.map((profile) => ({
				userId: profile.userId,
				displayName: profile.user.name ?? 'Volunteer',
				city: profile.city,
				state: profile.state,
				availability: profile.availability,
				verifiedCredentialTypes: profile.user.credentials.map((c) => c.type),
				skillIds: profile.user.volunteerSkills.map((s) => s.skillId),
				updatedAt: profile.updatedAt,
			})),
			nextCursor,
		};
	} catch (err) {
		// Stale cursor guard — if cursor record was deleted, return empty page
		const isPrismaNotFound =
			err instanceof Prisma.PrismaClientKnownRequestError &&
			err.code === 'P2025';
		if (isPrismaNotFound) {
			return { items: [], nextCursor: null };
		}
		throw err;
	}
}
