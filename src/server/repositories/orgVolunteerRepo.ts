import type {
	OrgVolunteerSource,
	PrismaClient,
} from '@/prisma/generated/client';
import { ROSTER_PAGE_SIZE } from '@/server/domain/org-volunteer';
import { prisma } from './prisma';

/** Works with both `prisma` and `prisma.$transaction(tx => …)`. */
type TxClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

/**
 * Roster row selection shared by list + detail so the two cannot drift.
 * `user.accountState` drives VolunteerStatusBadge; `user.email` is the identity
 * the coordinator recognises.
 */
const rosterSelect = {
	id: true,
	displayName: true,
	phone: true,
	source: true,
	createdAt: true,
	addedByUserId: true,
	userId: true,
	user: { select: { id: true, email: true, accountState: true } },
} as const;

/**
 * Find the LIVE roster edge for a pair, if any.
 *
 * Deliberately `findFirst`, not `findUnique`: uniqueness lives in a hand-written
 * PARTIAL index (`WHERE "deletedAt" IS NULL`), which Prisma cannot see, so the
 * generated compound-unique input does not exist and `findUnique`/`upsert` on
 * (orgId, userId) do not typecheck. That is by design — see the T2 migration.
 */
export function findLiveOrgVolunteer(
	orgId: string,
	userId: string,
	tx: TxClient | typeof prisma = prisma,
) {
	return tx.orgVolunteer.findFirst({
		where: { orgId, userId, deletedAt: null },
		select: rosterSelect,
	});
}

export function createOrgVolunteer(
	tx: TxClient,
	data: {
		orgId: string;
		userId: string;
		displayName: string;
		phone?: string | null;
		source?: OrgVolunteerSource;
		addedByUserId?: string | null;
	},
) {
	return tx.orgVolunteer.create({
		data: {
			orgId: data.orgId,
			userId: data.userId,
			displayName: data.displayName,
			phone: data.phone ?? null,
			source: data.source ?? 'STAFF_ADDED',
			addedByUserId: data.addedByUserId ?? null,
		},
		select: rosterSelect,
	});
}

/**
 * Soft delete. ShiftSignup rows are untouched, so the org keeps every hour it
 * recorded — that reassurance is what the removal toast promises the user.
 *
 * Scoped by orgId as well as id: without it, a crafted row id from another org
 * would remove that org's roster edge.
 */
export async function softDeleteOrgVolunteer(
	tx: TxClient,
	orgId: string,
	id: string,
) {
	const { count } = await tx.orgVolunteer.updateMany({
		where: { id, orgId, deletedAt: null },
		data: { deletedAt: new Date() },
	});
	return count;
}

/**
 * Undo a removal by clearing deletedAt on the SAME row, which preserves
 * `addedByUserId` and `createdAt` provenance that a re-add would lose.
 *
 * Can legitimately fail: if the volunteer was re-added between the removal and
 * the undo, a live row already exists and restoring this one violates the
 * partial unique index (P2002). The caller must treat that as "already back"
 * rather than an error.
 */
export async function restoreOrgVolunteer(
	tx: TxClient,
	orgId: string,
	id: string,
) {
	const { count } = await tx.orgVolunteer.updateMany({
		where: { id, orgId, deletedAt: { not: null } },
		data: { deletedAt: null },
	});
	return count;
}

/**
 * Cursor-paginated roster page. Never offset pagination: a concierge import may
 * be writing to this table while a coordinator pages through it, and offsets
 * silently skip or duplicate rows when the underlying set shifts.
 */
export async function listOrgVolunteers(options: {
	orgId: string;
	cursor?: string | null;
	limit?: number;
	search?: string | null;
}) {
	const take = options.limit ?? ROSTER_PAGE_SIZE;
	const search = options.search?.trim();

	const rows = await prisma.orgVolunteer.findMany({
		where: {
			orgId: options.orgId,
			deletedAt: null,
			...(search
				? {
						OR: [
							{ displayName: { contains: search, mode: 'insensitive' } },
							{ user: { email: { contains: search, mode: 'insensitive' } } },
						],
					}
				: {}),
		},
		take: take + 1,
		cursor: options.cursor ? { id: options.cursor } : undefined,
		skip: options.cursor ? 1 : 0,
		// Matches the @@index([orgId, createdAt]) added in the T2 migration.
		orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
		select: rosterSelect,
	});

	const hasMore = rows.length > take;
	const sliced = hasMore ? rows.slice(0, take) : rows;

	return {
		volunteers: sliced,
		nextCursor: hasMore ? (sliced[sliced.length - 1]?.id ?? null) : null,
	};
}

export function countOrgVolunteers(orgId: string) {
	return prisma.orgVolunteer.count({
		where: { orgId, deletedAt: null },
	});
}

/**
 * Attended-shift counts for the roster's `Shifts` column, one grouped query per
 * page rather than an N+1.
 *
 * SECURITY: the count is scoped through `shift.orgId`, NOT off the user. A User
 * row is shared between orgs by email — that is the whole premise of the
 * shadow-user model — so counting a volunteer's ShiftSignup rows without
 * joining through Shift would show org A how many shifts that person worked for
 * org B. Same bug class as v0.29.2.0 / v0.29.3.0.
 */
export async function countAttendedShiftsByUser(
	orgId: string,
	userIds: string[],
): Promise<Map<string, number>> {
	if (userIds.length === 0) return new Map();

	const rows = await prisma.shiftSignup.groupBy({
		by: ['userId'],
		where: {
			userId: { in: userIds },
			status: 'ATTENDED',
			shift: { orgId },
		},
		_count: { _all: true },
	});

	return new Map(rows.map((r) => [r.userId, r._count._all]));
}
