import type {
	OrgVolunteerSource,
	PrismaClient,
} from '@/prisma/generated/client';
import {
	ASSIGN_PICKER_LIMIT,
	ROSTER_PAGE_SIZE,
} from '@/server/domain/org-volunteer';
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

/**
 * Find a LIVE roster row by its own id, scoped to the org that owns it.
 *
 * `orgId` is part of the WHERE, not checked afterwards: `OrgVolunteer.id` is the
 * handle the assign picker puts on the wire, so without it a crafted id from
 * another org would resolve to that org's volunteer and let staff schedule a
 * stranger. Scoping here is also what lets `assignVolunteerToShift` skip
 * `requireOrgVolunteerRelationship` — a live roster row IS the `ORG_VOLUNTEER`
 * relationship that guard would look for.
 */
export function findOrgVolunteerById(
	orgId: string,
	id: string,
	tx: TxClient | typeof prisma = prisma,
) {
	return tx.orgVolunteer.findFirst({
		where: { id, orgId, deletedAt: null },
		select: rosterSelect,
	});
}

/**
 * Insert a roster edge, doing nothing if a LIVE one already exists.
 *
 * Returns true when a row was inserted, false when one was already there.
 *
 * Why not `findLiveOrgVolunteer` then `createOrgVolunteer` with a P2002 catch —
 * the shape `addVolunteer` uses and the shape the design doc prescribes for E1a?
 * Because E1a runs inside a transaction that must COMMIT (the application
 * approval, or the claim and its audit row), and in Postgres a failed statement
 * poisons the whole transaction: verified against this database, swallowing a
 * P2002 inside `prisma.$transaction` and issuing any further statement fails
 * with `current transaction is aborted, commands ignored until end of
 * transaction block`. So a concurrent roster race would roll back the approval
 * itself. `createMany({ skipDuplicates: true })` compiles to
 * `ON CONFLICT DO NOTHING`, which the server resolves without raising, so the
 * enclosing transaction survives.
 *
 * `addVolunteer` keeps its catch-outside-the-transaction shape because there the
 * duplicate IS the answer the coordinator needs ("Already on your roster"); here
 * it is a no-op we want to absorb silently.
 *
 * Verified that `ON CONFLICT DO NOTHING` honours the PARTIAL index: a
 * soft-deleted row does not block a fresh insert, so a re-approved volunteer who
 * was previously removed is re-added rather than silently skipped.
 */
export async function createOrgVolunteerIfAbsent(
	tx: TxClient,
	data: {
		orgId: string;
		userId: string;
		displayName: string;
		phone?: string | null;
		source?: OrgVolunteerSource;
		addedByUserId?: string | null;
	},
): Promise<boolean> {
	const { count } = await tx.orgVolunteer.createMany({
		data: [
			{
				orgId: data.orgId,
				userId: data.userId,
				displayName: data.displayName,
				phone: data.phone ?? null,
				source: data.source ?? 'STAFF_ADDED',
				addedByUserId: data.addedByUserId ?? null,
			},
		],
		skipDuplicates: true,
	});

	return count > 0;
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

/**
 * Roster rows the coordinator can still put on `shiftId`, newest first.
 *
 * Excludes anyone with a live signup on that shift — CONFIRMED, WAITLISTED,
 * ATTENDED or NO_SHOW. CANCELLED is deliberately NOT excluded: re-adding
 * someone who cancelled is an ordinary thing to do, and `assignVolunteerToShift`
 * handles it by reviving the existing row.
 *
 * The exclusion has to happen here rather than in the component. The roster is
 * keyed by `OrgVolunteer.id` and signups by `User.id`, and `getRoster`
 * deliberately withholds `userId` from the client (it is a cross-tenant
 * correlation handle — see the note on the roster projection), so a client-side
 * filter has no join key to work with. Offering a volunteer whose selection is
 * guaranteed to fail is worse than not offering them.
 *
 * Not paginated: the picker is a search box over a roster the coordinator is
 * typing into, so a bounded `take` with a "keep typing" empty state is the
 * right shape. `ASSIGN_PICKER_LIMIT` is small enough that the list stays
 * scannable and large enough that a short roster fits in one page.
 */
export async function listAssignableVolunteers(options: {
	orgId: string;
	shiftId: string;
	search?: string | null;
	limit?: number;
}) {
	const search = options.search?.trim();

	return prisma.orgVolunteer.findMany({
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
			user: {
				shiftSignups: {
					none: {
						shiftId: options.shiftId,
						status: { not: 'CANCELLED' },
					},
				},
			},
		},
		take: options.limit ?? ASSIGN_PICKER_LIMIT,
		orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
		select: rosterSelect,
	});
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

/**
 * The ways a User can be legitimately tied to an Organization, in the order
 * this module probes for them.
 */
export type OrgRelationshipKind =
	| 'APPLICATION'
	| 'ORG_VOLUNTEER'
	| 'SHIFT_SIGNUP'
	| 'ORG_MEMBER'
	/**
	 * Opt-in only — never probed unless `acceptExistingCredential` is set.
	 * See the option's docs on `findOrgVolunteerRelationship`.
	 */
	| 'EXISTING_CREDENTIAL';

/**
 * Find any relationship tying `userId` to `orgId`, or null if there is none.
 *
 * This is the read behind `requireOrgVolunteerRelationship`, which is what
 * stands between a staff user and an arbitrary `userId` typed into a form.
 *
 * The governing rule for membership of this set: **a relationship that staff
 * can mint unilaterally against a stranger cannot authorize a sensitive
 * action**, or the guard is a speed bump — one extra call and the caller has
 * manufactured their own permission. That rule excludes:
 *
 * - `VolunteerCredential` and `BackgroundCheckRequest`. They are the rows
 *   `issueCredential` and `initiateBackgroundCheck` create, so admitting them
 *   is directly circular: the first illegitimate write mints the relationship
 *   that justifies the next one.
 * - `VolunteerInvitation`. An invitation is an *outbound solicitation*, not a
 *   relationship — the volunteer has not answered it. `discovery.inviteToApply`
 *   is a plain `staffProcedure` over a cross-org public directory, so any staff
 *   user can create one against any volunteer in the system and thereby
 *   authorize themselves. If the volunteer does respond they produce a
 *   `VolunteerApplication`, which IS in the set.
 * - `OpportunityInterest`. A heart-click on the public cross-org marketplace,
 *   available to any signed-in user against any org; admitting it voids the
 *   guard entirely.
 *
 * `ORG_VOLUNTEER` is the one staff-mintable kind kept, because it is the roster
 * itself: the premise of the staff-created-volunteer feature is that a roster
 * row IS the org's assertion of a relationship, and dropping it would make
 * staff-added volunteers unschedulable. The residual risk (staff can roster
 * anyone whose email they know, then act on them) is inherent to that feature
 * and tracked in docs/TODOS.md.
 *
 * Probes are sequential and short-circuit. `APPLICATION` leads because it is
 * the overwhelmingly common case — the roster table is new and near-empty for
 * existing orgs, and `ORG_MEMBER` is a staff table a volunteer rarely appears
 * in. Only the rejection path pays for all four.
 */
export async function findOrgVolunteerRelationship(
	orgId: string,
	userId: string,
	opts?: {
		/**
		 * Also accept "this org already issued this user a credential".
		 *
		 * Off by default, because for `issueCredential` this is the circular
		 * case above. It is safe — and necessary — for **revocation only**,
		 * which is strictly narrowing: revoking can downgrade an existing row
		 * but can never mint privilege, so it cannot bootstrap itself.
		 *
		 * Necessary because `listOrgCredentials` filters on `orgId` alone. Once
		 * a volunteer is removed from the roster (`deletedAt` set) their
		 * credential is still listed, and without this the Revoke button beside
		 * it would throw NOT_FOUND forever — staff able to see a credential
		 * they cannot revoke, which is exactly when revoking matters most.
		 */
		acceptExistingCredential?: boolean;
	},
): Promise<OrgRelationshipKind | null> {
	const id = { id: true } as const;

	// Any status counts, REJECTED and WITHDRAWN included: staff still open those
	// records on the applications page, and gating a security primitive on a
	// status matrix invites drift every time the enum grows.
	const application = await prisma.volunteerApplication.findFirst({
		where: { orgId, submittedByUserId: userId },
		select: id,
	});
	if (application) return 'APPLICATION';

	const orgVolunteer = await prisma.orgVolunteer.findFirst({
		where: { orgId, userId, deletedAt: null },
		select: id,
	});
	if (orgVolunteer) return 'ORG_VOLUNTEER';

	// Joined through Shift.orgId, never off the signup alone — see the SECURITY
	// note on countAttendedShiftsByUser above.
	const signup = await prisma.shiftSignup.findFirst({
		where: { userId, shift: { orgId } },
		select: id,
	});
	if (signup) return 'SHIFT_SIGNUP';

	const member = await prisma.organizationMember.findUnique({
		where: { organizationId_userId: { organizationId: orgId, userId } },
		select: id,
	});
	if (member) return 'ORG_MEMBER';

	// Last, and only when the caller opts in — see `acceptExistingCredential`.
	if (opts?.acceptExistingCredential) {
		const credential = await prisma.volunteerCredential.findFirst({
			where: { orgId, userId },
			select: id,
		});
		if (credential) return 'EXISTING_CREDENTIAL';
	}

	return null;
}
