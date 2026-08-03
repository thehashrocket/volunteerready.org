import type {
	OrgVolunteerSource,
	PrismaClient,
} from '@/prisma/generated/client';
import {
	ASSIGN_PICKER_LIMIT,
	MY_MEMBERSHIPS_CAP,
	type MyOrgRelationshipReason,
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

/** One org on the volunteer's own list, whatever edge put it there. */
export type MyOrgRelationship = {
	orgId: string;
	organization: { name: string; slug: string };
	reason: MyOrgRelationshipReason;
	/** When the edge that put this org on the list was created. */
	since: Date;
	/** True when a live roster row exists — false for application/shift-only. */
	onRoster: boolean;
	/** True when the caller is ALSO staff at this org (see the D3 note below). */
	isStaff: boolean;
};

/**
 * Every org that can currently act on ONE person, across every org.
 *
 * Replaces the roster-row-only read behind the Organizations section on
 * `/app/profile` (`listOrgVolunteersByUser`, deleted in v0.37.0.0 rather than
 * left as dead code). That version listed live `OrgVolunteer` rows and nothing
 * else, which meant an org could DENY the
 * remedy entirely: remove the volunteer from its roster, and the row vanished
 * from this list along with the Leave button — while the `VolunteerApplication`
 * or `ShiftSignup` it holds kept satisfying `findOrgVolunteerRelationship`, and
 * with it `credentials.issue` and `backgroundChecks.initiate`. The org that saw
 * a departure coming could pre-empt it. This list is therefore keyed on the
 * ACCESS, not on the roster.
 *
 * The three sources mirror the accepted kinds in `findOrgVolunteerRelationship`
 * minus the two that must not appear:
 *   - `ORG_MEMBER` is staff membership, not a volunteer relationship, and is not
 *     what leaving revokes. It is surfaced as `isStaff` so the UI can be honest
 *     that leaving changes nothing for that person, but it never PUTS an org on
 *     this list on its own.
 *   - `EXISTING_CREDENTIAL` is opt-in and reachable only by `revokeCredential`.
 *
 * Already-blocked orgs are excluded: the volunteer has already acted, there is
 * nothing left to do, and listing them would offer a button that throws.
 *
 * Four queries plus a membership probe rather than a UNION, deliberately. A raw
 * `$queryRaw` union here would need `Prisma.sql` composition, which Turbopack
 * dev breaks by duplicating the generated `Sql` class across module graphs (see
 * the raw-SQL rule in CLAUDE.md) — and this list is capped at
 * MY_MEMBERSHIPS_CAP rows, so merging in JS costs nothing worth that risk.
 *
 * `organization.id` IS projected now, unlike the old read which deliberately
 * withheld it. It has to be: an org with no roster row has no `OrgVolunteer.id`
 * to identify it by, so `orgId` is the only stable handle the client can send
 * back. That is not a disclosure — it is the volunteer's own relationship, and
 * the org's `slug` (already projected, already public) identifies it anyway.
 */
export async function listMyOrgRelationships(
	userId: string,
): Promise<MyOrgRelationship[]> {
	const [rosterRows, applications, signups, blocks] = await Promise.all([
		prisma.orgVolunteer.findMany({
			where: { userId, deletedAt: null },
			take: MY_MEMBERSHIPS_CAP,
			orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
			select: {
				orgId: true,
				source: true,
				createdAt: true,
				organization: { select: { name: true, slug: true } },
			},
		}),
		// `distinct` on orgId: someone may have applied to the same org many
		// times, and this list has one row per ORG, not per application.
		prisma.volunteerApplication.findMany({
			where: { submittedByUserId: userId },
			take: MY_MEMBERSHIPS_CAP,
			distinct: ['orgId'],
			orderBy: [{ submittedAt: 'desc' }],
			select: {
				orgId: true,
				submittedAt: true,
				organization: { select: { name: true, slug: true } },
			},
		}),
		// Joined THROUGH Shift.orgId, never off the signup alone — same rule as
		// countAttendedShiftsByUser. Any status counts: a CANCELLED signup still
		// satisfies the relationship probe, so it must still be leavable.
		prisma.shiftSignup.findMany({
			where: { userId },
			take: MY_MEMBERSHIPS_CAP,
			distinct: ['shiftId'],
			orderBy: [{ createdAt: 'desc' }],
			select: {
				createdAt: true,
				shift: {
					select: {
						orgId: true,
						organization: { select: { name: true, slug: true } },
					},
				},
			},
		}),
		prisma.orgVolunteerBlock.findMany({
			where: { userId },
			select: { orgId: true },
		}),
	]);

	const blocked = new Set(blocks.map((b) => b.orgId));
	const byOrg = new Map<string, MyOrgRelationship>();

	// Insertion order is the precedence order: a roster row is the most specific
	// answer to "why is this org here?", an application next, a shift last. The
	// `has` check keeps the first (most specific) writer.
	for (const row of rosterRows) {
		if (blocked.has(row.orgId)) continue;
		byOrg.set(row.orgId, {
			orgId: row.orgId,
			organization: row.organization,
			reason: row.source,
			since: row.createdAt,
			onRoster: true,
			isStaff: false,
		});
	}
	for (const app of applications) {
		if (blocked.has(app.orgId) || byOrg.has(app.orgId)) continue;
		byOrg.set(app.orgId, {
			orgId: app.orgId,
			organization: app.organization,
			reason: 'APPLICATION_ONLY',
			since: app.submittedAt,
			onRoster: false,
			isStaff: false,
		});
	}
	for (const signup of signups) {
		const orgId = signup.shift.orgId;
		if (blocked.has(orgId) || byOrg.has(orgId)) continue;
		byOrg.set(orgId, {
			orgId,
			organization: signup.shift.organization,
			reason: 'SHIFT_ONLY',
			since: signup.createdAt,
			onRoster: false,
			isStaff: false,
		});
	}

	const rows = [...byOrg.values()]
		.sort((a, b) => b.since.getTime() - a.since.getTime())
		.slice(0, MY_MEMBERSHIPS_CAP);

	// D3: leaving does not revoke a staff member's own access to their own org
	// (`findOrgVolunteerRelationship` exempts ORG_MEMBER), so the UI must not
	// promise it does. One query for the whole page rather than per row.
	if (rows.length > 0) {
		const memberships = await prisma.organizationMember.findMany({
			where: { userId, organizationId: { in: rows.map((r) => r.orgId) } },
			select: { organizationId: true },
		});
		const staffAt = new Set(memberships.map((m) => m.organizationId));
		for (const row of rows) row.isStaff = staffAt.has(row.orgId);
	}

	return rows;
}

/**
 * Does this person have an edge that makes an org leavable?
 *
 * The precondition on writing a block. Without it any authenticated user could
 * POST an arbitrary `orgId` and mint block rows against orgs they have never
 * interacted with — junk data, and a way to pre-emptively lock an org out of a
 * relationship that has not started yet.
 *
 * Deliberately NOT `findOrgVolunteerRelationship`: that function now consults
 * blocks and returns null once one exists, so using it here would make leaving
 * un-idempotent in the wrong direction — the second call could not tell "no
 * relationship" from "already blocked". It also accepts `ORG_MEMBER`, which
 * must not by itself make an org leavable.
 */
export async function hasLeavableOrgRelationship(
	tx: TxClient,
	orgId: string,
	userId: string,
): Promise<boolean> {
	const id = { id: true } as const;

	const roster = await tx.orgVolunteer.findFirst({
		where: { orgId, userId, deletedAt: null },
		select: id,
	});
	if (roster) return true;

	const application = await tx.volunteerApplication.findFirst({
		where: { orgId, submittedByUserId: userId },
		select: id,
	});
	if (application) return true;

	const signup = await tx.shiftSignup.findFirst({
		where: { userId, shift: { orgId } },
		select: id,
	});
	return signup !== null;
}

/**
 * Soft-delete the caller's live roster row at an org, if they have one.
 *
 * Replaced `softDeleteOwnOrgVolunteer` (deleted). Leaving is now
 * addressed by `orgId` rather than by `OrgVolunteer.id`, because an org holding
 * only an application or a shift signup has no roster row to name — and those
 * orgs must be leavable too.
 *
 * SECURITY: `userId` is inside the WHERE, so a crafted `orgId` can only ever
 * reach the CALLER'S OWN row at that org. This is structurally safer than the
 * id-keyed version it replaces, where a crafted id could name a stranger's row
 * and the `userId` clause was the only thing stopping it.
 *
 * Returns the row id when one was soft-deleted (for the audit entry), or null
 * when there was nothing to delete — which is a normal outcome here, not an
 * error: application-only and shift-only orgs have no roster row by definition.
 */
export async function softDeleteOwnOrgVolunteerByOrg(
	tx: TxClient,
	userId: string,
	orgId: string,
): Promise<string | null> {
	const row = await tx.orgVolunteer.findFirst({
		where: { orgId, userId, deletedAt: null },
		select: { id: true },
	});
	if (!row) return null;

	const { count } = await tx.orgVolunteer.updateMany({
		where: { id: row.id, userId, deletedAt: null },
		data: { deletedAt: new Date() },
	});

	return count === 1 ? row.id : null;
}

/**
 * Record that this volunteer refuses this org's access.
 *
 * Idempotent by upsert on the compound unique. The case that needs it is a
 * SECOND leave: staff re-added the volunteer before this feature existed (or
 * the volunteer rejoined and left again), so a block row may already be there.
 * An `update: {}` rather than a create-and-catch because swallowing P2002
 * inside `prisma.$transaction` poisons the transaction — the same Postgres
 * behaviour that forced `createOrgVolunteerIfAbsent` onto
 * `createMany({ skipDuplicates })` in the E1a roster-convergence ship.
 */
export async function createOrgVolunteerBlock(
	tx: TxClient,
	orgId: string,
	userId: string,
) {
	return tx.orgVolunteerBlock.upsert({
		where: { orgId_userId: { orgId, userId } },
		create: { orgId, userId },
		update: {},
		select: { id: true },
	});
}

/**
 * Lift a block because the volunteer re-engaged with the org of their own
 * accord — applied, claimed an application, or signed up for a shift.
 *
 * `deleteMany`, not `delete`: the overwhelmingly common case is that no block
 * exists, and `delete` throws P2025 on a missing row. Every caller is a
 * fire-and-forget step inside someone else's transaction, so a throw there would
 * roll back an application submission to undo a block that was never there.
 *
 * Returns the number of rows removed so callers can decide whether an
 * `ORG_ACCESS_RESTORED` audit row is warranted — writing one unconditionally
 * would stamp an audit entry on every shift signup in the system.
 */
export async function deleteOrgVolunteerBlock(
	tx: TxClient,
	orgId: string,
	userId: string,
): Promise<number> {
	const { count } = await tx.orgVolunteerBlock.deleteMany({
		where: { orgId, userId },
	});
	return count;
}

/**
 * Does this volunteer refuse this org's access?
 *
 * Read by the four paths that can put a live roster row in front of staff, plus
 * `findOrgVolunteerRelationship` itself. They refuse in three DIFFERENT shapes
 * on purpose, which is why this stays a plain read and each caller decides:
 *
 *   `addVolunteer`            → FORBIDDEN (staff typed an address; tell them)
 *   `restoreVolunteer`        → FORBIDDEN (same, via the Undo toast)
 *   `ensureAppliedRosterRow`  → returns false (an approval must not fail)
 *   `assignVolunteerToShift`  → NOT_FOUND (matches its roster-miss answer)
 *
 * The point of refusing at all is that a roster row the guard treats as inert —
 * a live row on the roster page that cannot be scheduled, credentialed, or
 * background-checked — is a worse outcome than an error.
 */
export async function findOrgVolunteerBlock(
	orgId: string,
	userId: string,
	tx: TxClient | typeof prisma = prisma,
) {
	return tx.orgVolunteerBlock.findUnique({
		where: { orgId_userId: { orgId, userId } },
		select: { id: true },
	});
}

/**
 * Find a SOFT-DELETED roster row by id, scoped to the org that owns it.
 *
 * Exists so `restoreVolunteer` can learn the row's `userId` before restoring
 * it, which it needs in order to check for a block. Nothing on `OrgVolunteer`
 * records WHO soft-deleted a row, so a staff removal and a volunteer's own
 * departure are indistinguishable here — the block is the only thing that tells
 * them apart, and reading it requires the userId this returns.
 */
export function findRemovedOrgVolunteer(
	tx: TxClient,
	orgId: string,
	id: string,
) {
	return tx.orgVolunteer.findFirst({
		where: { id, orgId, deletedAt: { not: null } },
		select: { id: true, userId: true },
	});
}

/**
 * Undo a removal by clearing deletedAt on the SAME row, which preserves
 * `addedByUserId` and `createdAt` provenance that a re-add would lose.
 *
 * Can legitimately fail: if the volunteer was re-added between the removal and
 * the undo, a live row already exists and restoring this one violates the
 * partial unique index (P2002). The caller must treat that as "already back"
 * rather than an error.
 *
 * SECURITY: this restores ANY soft-deleted row for the org, and the `where`
 * cannot distinguish a staff removal from a volunteer's own departure. The
 * block check therefore lives in `restoreVolunteer`, NOT here — see the note
 * there. Do not call this without one.
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
 * SECURITY: the ONE definition of "an attended shift, at this org".
 *
 * Scoped through `shift.orgId`, NOT off the user — `ShiftSignup` has no `orgId`
 * column at all, so the join is the only way to express it. A User row is
 * shared between orgs by email (that is the whole premise of the shadow-user
 * model), so reading a volunteer's ShiftSignup rows without joining through
 * Shift shows org A what that person did for org B. Same bug class as
 * v0.29.2.0 / v0.29.3.0.
 *
 * Shared by the count below and the history listing beneath it because the two
 * are the same fact at two resolutions: the roster row's `Shifts` cell is the
 * count, and the detail dialog behind that cell is the list. Two hand-written
 * copies of this filter would let them disagree, and the visible symptom is a
 * row that says 12 opening a dialog that shows 9.
 *
 * Deliberately NOT exported. The unscoped cross-org read is a separate,
 * legitimate function (`getAttendedShiftsForUser` in `shiftSignupRepo.ts`,
 * which feeds a volunteer's own platform-wide profile); nothing outside this
 * pair should be assembling its own org-scoped variant.
 *
 * Returns the COMPLETE `where`, and takes the user predicate as a parameter,
 * rather than returning a fragment for callers to spread. A spread puts the
 * tenancy key at the mercy of key order: `{ ...filter(orgId), shift: { … } }`
 * compiles, typechecks, and silently drops the org join — which is the exact
 * leak this helper exists to prevent. Both call sites happened to spread it
 * last; that is a property of today's code, not of the helper.
 */
function attendedShiftWhere(
	orgId: string,
	user: { userId: string } | { userId: { in: string[] } },
) {
	return { ...user, status: 'ATTENDED' as const, shift: { orgId } };
}

/**
 * Attended-shift counts for the roster's `Shifts` column, one grouped query per
 * page rather than an N+1.
 */
export async function countAttendedShiftsByUser(
	orgId: string,
	userIds: string[],
): Promise<Map<string, number>> {
	if (userIds.length === 0) return new Map();

	const rows = await prisma.shiftSignup.groupBy({
		by: ['userId'],
		where: attendedShiftWhere(orgId, { userId: { in: userIds } }),
		_count: { _all: true },
	});

	return new Map(rows.map((r) => [r.userId, r._count._all]));
}

/**
 * One volunteer's attended-shift history at ONE org, newest first — the
 * drill-down behind the `Shifts` count above, sharing its filter so the two
 * cannot report different sets.
 *
 * Uncapped on purpose, and that is load-bearing rather than an oversight: the
 * total hours and the "N attended" figure are computed from these exact rows,
 * so a `take` here would silently under-report both and contradict the count in
 * the roster row the coordinator just clicked.
 *
 * The cap that DOES exist is on what crosses the wire — `getVolunteerDetail`
 * sums across everything this returns and sends only `SHIFT_HISTORY_WIRE_CAP`
 * of them. Reading ~1800 indexed rows inside the datacenter is cheap;
 * serializing them to a browser to paint fifty is not. Keep the two caps
 * straight: capping HERE breaks the totals, capping nowhere breaks the payload.
 */
export async function listAttendedShiftsForUserInOrg(
	orgId: string,
	userId: string,
): Promise<
	{ shiftId: string; title: string; startTime: Date; endTime: Date }[]
> {
	const rows = await prisma.shiftSignup.findMany({
		where: attendedShiftWhere(orgId, { userId }),
		select: {
			shift: {
				select: { id: true, title: true, startTime: true, endTime: true },
			},
		},
		orderBy: { shift: { startTime: 'desc' } },
	});

	return rows.map((r) => ({
		shiftId: r.shift.id,
		title: r.shift.title,
		startTime: r.shift.startTime,
		endTime: r.shift.endTime,
	}));
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
 * anyone whose email they know, then act on them) is inherent to that feature.
 * `OrgVolunteerBlock` is the volunteer's answer to it — see below.
 *
 * Probes are sequential and short-circuit. `APPLICATION` leads because it is
 * the overwhelmingly common case — the roster table is new and near-empty for
 * existing orgs, and `ORG_MEMBER` is a staff table a volunteer rarely appears
 * in. Only the rejection path pays for all four.
 *
 * BLOCKS. A volunteer who leaves a roster writes an `OrgVolunteerBlock`, and it
 * overrides every kind above except `ORG_MEMBER`. Three things about where that
 * check sits:
 *
 * 1. It runs AFTER the probes, not before. A block is rare, so checking first
 *    would add a query to every call to save one on almost none. Running it
 *    only once a relationship was actually found means the rejection path —
 *    already the expensive one at four queries — is unchanged, and the accept
 *    path pays a single indexed lookup on a unique key.
 * 2. `ORG_MEMBER` is exempt, and is therefore also allowed to short-circuit
 *    before the block lookup. Staff membership is not a volunteer relationship
 *    and is not what leaving a roster revokes; without the exemption, a person
 *    who is both a coordinator at an org and on its volunteer roster would lock
 *    themselves out of their own organization by leaving that roster.
 * 3. When a block suppresses a volunteer-side kind, we re-probe for
 *    `ORG_MEMBER` rather than returning null outright — otherwise that same
 *    staff-and-volunteer person loses their membership access purely because
 *    `APPLICATION` happened to be found first.
 * 4. `EXISTING_CREDENTIAL` is ALSO exempt. Suppressing it looked right —
 *    a blocked org should not act on you — but it recreates the exact dead end
 *    `acceptExistingCredential` was added to prevent: `listOrgCredentials`
 *    filters on `orgId` alone, so the credential stays visible and permanently
 *    unrevokable, and only the volunteer can lift a block, so "later" may be
 *    never. The kind is opt-in and reached by `revokeCredential` alone, which
 *    is strictly narrowing — it cannot mint privilege or disclose anything, so
 *    there is nothing for a block to protect against here.
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
	const relationship = await probeOrgRelationship(orgId, userId, opts);

	// Nothing to suppress, or the two kinds a block does not reach. All skip the
	// block lookup entirely — see notes 1, 2 and 4 on this function.
	if (
		relationship === null ||
		relationship === 'ORG_MEMBER' ||
		relationship === 'EXISTING_CREDENTIAL'
	) {
		return relationship;
	}

	// Via the shared helper rather than an inline findUnique: this read is
	// authorization-critical and having two copies of it in one file is how the
	// two drift when the block model grows a column.
	const blocked = await findOrgVolunteerBlock(orgId, userId);
	if (!blocked) return relationship;

	// Blocked, but staff membership survives it — note 3. Re-probed rather than
	// reused from above because the probe short-circuits: a blocked coordinator
	// with an application on file returns `APPLICATION` there and never reaches
	// the `ORG_MEMBER` check.
	const member = await prisma.organizationMember.findUnique({
		where: { organizationId_userId: { organizationId: orgId, userId } },
		select: { id: true },
	});
	return member ? 'ORG_MEMBER' : null;
}

/**
 * The four-and-a-bit relationship probes, with no block handling.
 *
 * Split out of `findOrgVolunteerRelationship` when blocks landed, purely so the
 * block logic reads as a distinct step rather than being threaded through five
 * early returns. NOT exported: calling this directly is calling the guard with
 * the volunteer's revocation ignored, which is the bug the split makes easy to
 * commit by accident. Everything outside this module goes through
 * `findOrgVolunteerRelationship`.
 */
async function probeOrgRelationship(
	orgId: string,
	userId: string,
	opts?: { acceptExistingCredential?: boolean },
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

/**
 * The subset of `emails` whose holder has revoked this org's access.
 *
 * Batched because its caller (`--notify-only`) classifies a whole CSV at once and
 * a per-address `findOrgVolunteerBlock` would be one round trip per row. Joins
 * through `User` so the caller can stay in address space — `OrgVolunteerBlock` is
 * keyed by `userId`, and the recovery mode only ever holds addresses (they come
 * off `AuditLog.metadata.email`).
 *
 * Addresses with no `User` row simply do not appear: nobody holds them, so
 * nobody can have blocked anything.
 */
export async function findBlockedEmailsForOrg(
	orgId: string,
	emails: readonly string[],
): Promise<Set<string>> {
	if (emails.length === 0) return new Set();

	const rows = await prisma.orgVolunteerBlock.findMany({
		where: { orgId, user: { email: { in: [...emails] } } },
		select: { user: { select: { email: true } } },
	});

	// `User.email` is nullable in the schema, but a row matched by the `in`
	// filter above necessarily has one — the narrowing is for the type checker.
	return new Set(
		rows
			.map((r) => r.user.email)
			.filter((email): email is string => email !== null),
	);
}
