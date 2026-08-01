/**
 * Integration tests for the OrgVolunteer partial unique index (T2).
 *
 * Uses real Postgres. Requires DATABASE_URL to point at the dev/test database.
 * Run with: pnpm test:integration
 *
 * WHY THESE MUST BE INTEGRATION TESTS, NOT UNIT TESTS
 * ---------------------------------------------------
 * The uniqueness rule under test lives in a hand-written PARTIAL index
 * (`WHERE "deletedAt" IS NULL`), not in schema.prisma. Prisma cannot see it, so
 * a mocked Prisma client would happily accept every insert and prove nothing.
 * The whole point is that Postgres enforces it and Prisma still surfaces P2002.
 *
 * Behaviour pinned here:
 *   1. a live duplicate (orgId, userId) is REJECTED with P2002
 *   2. soft-deleting the first row lets the same pair be re-added
 *   3. two soft-deleted rows for the same pair can coexist
 *   4. the same user can be on TWO different orgs' rosters simultaneously
 *      — the shadow-user model depends on this
 */

import { afterEach, describe, expect, it } from 'vitest';
import type { SignupStatus } from '@/prisma/generated/client';
import { prisma } from '@/server/repositories/prisma';
import {
	countAttendedShiftsByUser,
	countOrgVolunteers,
	createOrgVolunteerBlock,
	deleteOrgVolunteerBlock,
	findLiveOrgVolunteer,
	findOrgVolunteerBlock,
	findOrgVolunteerRelationship,
	hasLeavableOrgRelationship,
	listAttendedShiftsForUserInOrg,
	listMyOrgRelationships,
	listOrgVolunteers,
	restoreOrgVolunteer,
	softDeleteOrgVolunteer,
	softDeleteOwnOrgVolunteerByOrg,
} from './orgVolunteerRepo';

const PREFIX = '__orgvolunteer_integration__';

async function makeOrg(suffix: string) {
	return prisma.organization.create({
		data: { name: `${PREFIX}${suffix}`, slug: `${PREFIX}${suffix}` },
	});
}

async function makeUser(suffix: string) {
	return prisma.user.create({
		data: { email: `${PREFIX}${suffix}@example.test`, name: `User ${suffix}` },
	});
}

function addRoster(
	orgId: string,
	userId: string,
	displayName = 'Ada Lovelace',
) {
	return prisma.orgVolunteer.create({ data: { orgId, userId, displayName } });
}

afterEach(async () => {
	// Delete children first — OrgVolunteer cascades from both sides, but being
	// explicit keeps a failed assertion from leaving orphans behind.
	await prisma.orgVolunteer.deleteMany({
		where: { organization: { slug: { startsWith: PREFIX } } },
	});
	// Blocks cascade from Organization too, but the block suite asserts on counts
	// and a leaked row from a failed assertion would poison the next run.
	await prisma.orgVolunteerBlock.deleteMany({
		where: { organization: { slug: { startsWith: PREFIX } } },
	});
	await prisma.organization.deleteMany({
		where: { slug: { startsWith: PREFIX } },
	});
	await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
});

describe('OrgVolunteer partial unique index', () => {
	it('rejects a second LIVE row for the same (orgId, userId) with P2002', async () => {
		const [org, user] = await Promise.all([makeOrg('a'), makeUser('a')]);
		await addRoster(org.id, user.id);

		await expect(addRoster(org.id, user.id)).rejects.toMatchObject({
			code: 'P2002',
		});
	});

	it('allows re-adding a volunteer after a soft delete', async () => {
		const [org, user] = await Promise.all([makeOrg('b'), makeUser('b')]);
		const first = await addRoster(org.id, user.id, 'Original Name');

		// Soft delete — the row stays, so any ShiftSignup rows it relates to are
		// untouched and the org keeps the hours it recorded.
		await prisma.orgVolunteer.update({
			where: { id: first.id },
			data: { deletedAt: new Date() },
		});

		const second = await addRoster(org.id, user.id, 'Re-added Name');
		expect(second.id).not.toBe(first.id);

		// Both rows coexist: one dead, one live.
		const all = await prisma.orgVolunteer.findMany({
			where: { orgId: org.id, userId: user.id },
		});
		expect(all).toHaveLength(2);
		expect(all.filter((r) => r.deletedAt === null)).toHaveLength(1);
	});

	it('allows MANY soft-deleted rows for the same pair', async () => {
		const [org, user] = await Promise.all([makeOrg('c'), makeUser('c')]);

		// add → remove, three times over. A plain @@unique would fail on the
		// second create; the partial predicate makes the dead rows invisible.
		for (let i = 0; i < 3; i++) {
			const row = await addRoster(org.id, user.id, `Cycle ${i}`);
			await prisma.orgVolunteer.update({
				where: { id: row.id },
				data: { deletedAt: new Date() },
			});
		}

		const dead = await prisma.orgVolunteer.count({
			where: { orgId: org.id, userId: user.id, deletedAt: { not: null } },
		});
		expect(dead).toBe(3);

		// And a fresh live row is still allowed on top of them.
		await expect(addRoster(org.id, user.id)).resolves.toBeTruthy();
	});

	it('SECURITY: lets one user sit on two different orgs rosters at once', async () => {
		// The shadow-user model shares a single User row across orgs by email.
		// If the index were scoped to userId alone, org B could not add someone
		// org A already had — which would leak org A's roster by rejection.
		const [orgA, orgB, user] = await Promise.all([
			makeOrg('d1'),
			makeOrg('d2'),
			makeUser('d'),
		]);

		await expect(addRoster(orgA.id, user.id)).resolves.toBeTruthy();
		await expect(addRoster(orgB.id, user.id)).resolves.toBeTruthy();
	});

	it('defaults accountState to ACTIVE and leaves claimedAt null', async () => {
		const user = await makeUser('e');
		expect(user.accountState).toBe('ACTIVE');
		expect(user.claimedAt).toBeNull();
	});

	it('defaults OrgVolunteer.source to STAFF_ADDED', async () => {
		const [org, user] = await Promise.all([makeOrg('f'), makeUser('f')]);
		const row = await addRoster(org.id, user.id);
		expect(row.source).toBe('STAFF_ADDED');
		expect(row.deletedAt).toBeNull();
	});

	it('keeps the roster row when the adding coordinator is deleted (SetNull)', async () => {
		const [org, user, coordinator] = await Promise.all([
			makeOrg('g'),
			makeUser('g'),
			makeUser('g-coordinator'),
		]);
		const row = await prisma.orgVolunteer.create({
			data: {
				orgId: org.id,
				userId: user.id,
				displayName: 'Kept Row',
				addedByUserId: coordinator.id,
			},
		});

		await prisma.user.delete({ where: { id: coordinator.id } });

		// Cascade here would destroy the org's own roster data because a staff
		// member left. SetNull keeps the row and drops only the attribution.
		const after = await prisma.orgVolunteer.findUnique({
			where: { id: row.id },
		});
		expect(after).not.toBeNull();
		expect(after?.addedByUserId).toBeNull();
	});
});

/**
 * These exercise orgVolunteerRepo itself against real Postgres.
 *
 * Added after a ship coverage audit found the repo had ZERO executed lines:
 * the tests above drove `prisma.orgVolunteer.*` directly while the service
 * tests mocked the whole repo module. That combination proves the service
 * handles a `count === 0`, but proves nothing about the `where: { id, orgId }`
 * clause that makes the count 0 for a foreign org in the first place.
 */
describe('orgVolunteerRepo — org scoping', () => {
	it('SECURITY: counts attended shifts for the CALLING org only', async () => {
		// A User row is shared across orgs by email — that is the premise of the
		// shadow-user model. Counting ShiftSignup off the user without joining
		// through Shift.orgId shows org A how much work someone did for org B.
		// Same bug class as v0.29.2.0 / v0.29.3.0.
		const [orgA, orgB, user] = await Promise.all([
			makeOrg('count-a'),
			makeOrg('count-b'),
			makeUser('count'),
		]);

		async function attendShift(orgId: string, suffix: string) {
			const shift = await prisma.shift.create({
				data: {
					orgId,
					title: `${PREFIX}${suffix}`,
					startTime: new Date('2026-03-01T10:00:00Z'),
					endTime: new Date('2026-03-01T12:00:00Z'),
					capacity: 5,
				},
			});
			await prisma.shiftSignup.create({
				data: { shiftId: shift.id, userId: user.id, status: 'ATTENDED' },
			});
		}

		// 2 shifts for org A, 3 for org B.
		await attendShift(orgA.id, 'a1');
		await attendShift(orgA.id, 'a2');
		await attendShift(orgB.id, 'b1');
		await attendShift(orgB.id, 'b2');
		await attendShift(orgB.id, 'b3');

		const forA = await countAttendedShiftsByUser(orgA.id, [user.id]);
		const forB = await countAttendedShiftsByUser(orgB.id, [user.id]);

		expect(forA.get(user.id)).toBe(2);
		expect(forB.get(user.id)).toBe(3);
	});

	it('counts only ATTENDED, not CONFIRMED signups', async () => {
		// The roster header pairs this count with recorded hours. Counting
		// CONFIRMED would show "6 shifts" next to zero hours — a support ticket.
		const [org, user] = await Promise.all([
			makeOrg('status'),
			makeUser('status'),
		]);
		const shift = await prisma.shift.create({
			data: {
				orgId: org.id,
				title: `${PREFIX}status`,
				startTime: new Date('2026-03-01T10:00:00Z'),
				endTime: new Date('2026-03-01T12:00:00Z'),
				capacity: 5,
			},
		});
		await prisma.shiftSignup.create({
			data: { shiftId: shift.id, userId: user.id, status: 'CONFIRMED' },
		});

		const counts = await countAttendedShiftsByUser(org.id, [user.id]);
		expect(counts.get(user.id)).toBeUndefined();
	});

	it('returns an empty map for no user ids without querying', async () => {
		const counts = await countAttendedShiftsByUser('any-org', []);
		expect(counts.size).toBe(0);
	});

	it('SECURITY: a volunteer on two rosters shows each org only its own shift history', async () => {
		// The count above leaks a NUMBER without the shift.orgId join; this leaks
		// the rows themselves — titles and dates of work done for another
		// organisation — so it is the same bug class one resolution worse. T27's
		// detail dialog was specified against the cross-org
		// `getAttendedShiftsForUser`, which is exactly what this guards against.
		const [orgA, orgB, user] = await Promise.all([
			makeOrg('hist-a'),
			makeOrg('hist-b'),
			makeUser('hist'),
		]);

		async function attendShift(
			orgId: string,
			suffix: string,
			startIso: string,
			endIso: string,
		) {
			const shift = await prisma.shift.create({
				data: {
					orgId,
					title: `${PREFIX}${suffix}`,
					startTime: new Date(startIso),
					endTime: new Date(endIso),
					capacity: 5,
				},
			});
			await prisma.shiftSignup.create({
				data: { shiftId: shift.id, userId: user.id, status: 'ATTENDED' },
			});
		}

		await attendShift(
			orgA.id,
			'hist-a1',
			'2026-03-01T10:00:00Z',
			'2026-03-01T12:00:00Z',
		);
		await attendShift(
			orgA.id,
			'hist-a2',
			'2026-03-05T10:00:00Z',
			'2026-03-05T13:00:00Z',
		);
		await attendShift(
			orgB.id,
			'hist-b1',
			'2026-03-03T10:00:00Z',
			'2026-03-03T12:00:00Z',
		);

		const forA = await listAttendedShiftsForUserInOrg(orgA.id, user.id);
		const forB = await listAttendedShiftsForUserInOrg(orgB.id, user.id);

		expect(forA.map((s) => s.title)).toEqual([
			// Newest first — the dialog reads as a history, not a backlog.
			`${PREFIX}hist-a2`,
			`${PREFIX}hist-a1`,
		]);
		expect(forB.map((s) => s.title)).toEqual([`${PREFIX}hist-b1`]);
	});

	it('SECURITY: shows one volunteer only their OWN shifts at this org', async () => {
		// The cross-org test above varies the ORG but uses a single user, so it
		// leaves the `userId` half of the WHERE unexercised: dropping it kept the
		// whole suite green while every volunteer's dialog would have listed every
		// other volunteer's shifts at that org. Same mutation-verification bar the
		// leave path is held to.
		const [org, mine, theirs] = await Promise.all([
			makeOrg('hist-own'),
			makeUser('hist-own-mine'),
			makeUser('hist-own-theirs'),
		]);

		async function attend(user: { id: string }, suffix: string) {
			const shift = await prisma.shift.create({
				data: {
					orgId: org.id,
					title: `${PREFIX}${suffix}`,
					startTime: new Date('2026-03-01T10:00:00Z'),
					endTime: new Date('2026-03-01T12:00:00Z'),
					capacity: 5,
				},
			});
			await prisma.shiftSignup.create({
				data: { shiftId: shift.id, userId: user.id, status: 'ATTENDED' },
			});
		}

		await attend(mine, 'hist-own-mine');
		await attend(theirs, 'hist-own-theirs');

		const rows = await listAttendedShiftsForUserInOrg(org.id, mine.id);

		expect(rows.map((s) => s.title)).toEqual([`${PREFIX}hist-own-mine`]);
	});

	it('lists only ATTENDED shifts, matching the count beside it', async () => {
		// The dialog's hours are summed from these rows and sit under a roster
		// cell showing countAttendedShiftsByUser. If this listing admitted a
		// CONFIRMED signup the two would disagree on screen, which is the whole
		// reason both go through one shared filter.
		const [org, user] = await Promise.all([
			makeOrg('hist-status'),
			makeUser('hist-status'),
		]);

		async function signUp(suffix: string, status: SignupStatus) {
			const shift = await prisma.shift.create({
				data: {
					orgId: org.id,
					title: `${PREFIX}${suffix}`,
					startTime: new Date('2026-03-01T10:00:00Z'),
					endTime: new Date('2026-03-01T12:00:00Z'),
					capacity: 5,
				},
			});
			await prisma.shiftSignup.create({
				data: { shiftId: shift.id, userId: user.id, status },
			});
		}

		await signUp('hist-attended', 'ATTENDED');
		await signUp('hist-confirmed', 'CONFIRMED');
		await signUp('hist-noshow', 'NO_SHOW');

		const history = await listAttendedShiftsForUserInOrg(org.id, user.id);
		const counts = await countAttendedShiftsByUser(org.id, [user.id]);

		expect(history.map((s) => s.title)).toEqual([`${PREFIX}hist-attended`]);
		expect(counts.get(user.id)).toBe(history.length);
	});

	it('SECURITY: softDelete refuses a row belonging to another org', async () => {
		const [orgA, orgB, user] = await Promise.all([
			makeOrg('del-a'),
			makeOrg('del-b'),
			makeUser('del'),
		]);
		const row = await addRoster(orgA.id, user.id);

		// orgB tries to delete orgA's row using a known id.
		const wrongOrg = await prisma.$transaction((tx) =>
			softDeleteOrgVolunteer(tx, orgB.id, row.id),
		);
		expect(wrongOrg).toBe(0);

		const stillLive = await findLiveOrgVolunteer(orgA.id, user.id);
		expect(stillLive).not.toBeNull();

		const rightOrg = await prisma.$transaction((tx) =>
			softDeleteOrgVolunteer(tx, orgA.id, row.id),
		);
		expect(rightOrg).toBe(1);
		expect(await findLiveOrgVolunteer(orgA.id, user.id)).toBeNull();
	});

	it('SECURITY: restore refuses a row belonging to another org', async () => {
		const [orgA, orgB, user] = await Promise.all([
			makeOrg('res-a'),
			makeOrg('res-b'),
			makeUser('res'),
		]);
		const row = await addRoster(orgA.id, user.id);
		await prisma.$transaction((tx) =>
			softDeleteOrgVolunteer(tx, orgA.id, row.id),
		);

		expect(
			await prisma.$transaction((tx) =>
				restoreOrgVolunteer(tx, orgB.id, row.id),
			),
		).toBe(0);
		expect(
			await prisma.$transaction((tx) =>
				restoreOrgVolunteer(tx, orgA.id, row.id),
			),
		).toBe(1);
		expect(await findLiveOrgVolunteer(orgA.id, user.id)).not.toBeNull();
	});

	it('SECURITY: list and count return only the calling org rows', async () => {
		const [orgA, orgB, u1, u2] = await Promise.all([
			makeOrg('list-a'),
			makeOrg('list-b'),
			makeUser('list1'),
			makeUser('list2'),
		]);
		await addRoster(orgA.id, u1.id, 'Only A');
		await addRoster(orgB.id, u2.id, 'Only B');

		const listA = await listOrgVolunteers({ orgId: orgA.id });
		expect(listA.volunteers.map((v) => v.displayName)).toEqual(['Only A']);
		expect(await countOrgVolunteers(orgA.id)).toBe(1);
	});

	it('excludes soft-deleted rows from list and count', async () => {
		const [org, user] = await Promise.all([makeOrg('sd'), makeUser('sd')]);
		const row = await addRoster(org.id, user.id);
		expect(await countOrgVolunteers(org.id)).toBe(1);

		await prisma.$transaction((tx) =>
			softDeleteOrgVolunteer(tx, org.id, row.id),
		);

		expect(await countOrgVolunteers(org.id)).toBe(0);
		expect(
			(await listOrgVolunteers({ orgId: org.id })).volunteers,
		).toHaveLength(0);
	});

	it('paginates by cursor without dropping or repeating a row', async () => {
		// Offset pagination silently skips or duplicates rows when a concierge
		// import writes to the table mid-scroll. Cursor pagination must not.
		const org = await makeOrg('page');
		const users = await Promise.all(
			Array.from({ length: 5 }, (_, i) => makeUser(`page${i}`)),
		);
		for (const [i, u] of users.entries()) {
			await addRoster(org.id, u.id, `Person ${i}`);
		}

		const first = await listOrgVolunteers({ orgId: org.id, limit: 2 });
		expect(first.volunteers).toHaveLength(2);
		expect(first.nextCursor).not.toBeNull();

		const second = await listOrgVolunteers({
			orgId: org.id,
			limit: 2,
			cursor: first.nextCursor,
		});
		const firstIds = first.volunteers.map((v) => v.id);
		const secondIds = second.volunteers.map((v) => v.id);
		expect(secondIds).toHaveLength(2);
		// No overlap between pages — the `skip: 1` past the cursor is what does it.
		expect(firstIds.filter((id) => secondIds.includes(id))).toHaveLength(0);

		const last = await listOrgVolunteers({
			orgId: org.id,
			limit: 2,
			cursor: second.nextCursor,
		});
		expect(last.volunteers).toHaveLength(1);
		expect(last.nextCursor).toBeNull();
	});

	it('searches case-insensitively across BOTH name and email', async () => {
		const [org, u1, u2] = await Promise.all([
			makeOrg('search'),
			makeUser('needle'),
			makeUser('other'),
		]);
		await addRoster(org.id, u1.id, 'Zebediah Match');
		await addRoster(org.id, u2.id, 'Someone Else');

		const byName = await listOrgVolunteers({
			orgId: org.id,
			search: 'zebediah',
		});
		expect(byName.volunteers).toHaveLength(1);

		const byEmail = await listOrgVolunteers({
			orgId: org.id,
			search: 'NEEDLE',
		});
		expect(byEmail.volunteers).toHaveLength(1);

		// Whitespace-only search must behave as "no filter", not "match nothing".
		const blank = await listOrgVolunteers({ orgId: org.id, search: '   ' });
		expect(blank.volunteers).toHaveLength(2);
	});
});

/**
 * T32 — the volunteer's own exit.
 *
 * These MUST be integration tests. The authorization rule is a `userId` clause
 * inside a Prisma WHERE; a mocked client returns whatever the mock was told to
 * and would pass with the clause deleted. Only Postgres can answer "did that
 * row actually survive?".
 */
describe('leaving your own roster (softDeleteOwnOrgVolunteerByOrg)', () => {
	it('soft-deletes the caller own edge and returns the row id', async () => {
		const [org, user] = await Promise.all([
			makeOrg('leave'),
			makeUser('leave'),
		]);
		const row = await addRoster(org.id, user.id);

		const deletedId = await softDeleteOwnOrgVolunteerByOrg(
			prisma,
			user.id,
			org.id,
		);

		expect(deletedId).toBe(row.id);
		// Soft, not hard: the row survives so ShiftSignup rows and recorded hours
		// are untouched, exactly as for a staff-side removal.
		const after = await prisma.orgVolunteer.findUnique({
			where: { id: row.id },
			select: { deletedAt: true },
		});
		expect(after?.deletedAt).not.toBeNull();
	});

	it("SECURITY: cannot leave a roster on someone else's behalf", async () => {
		const [org, victim, attacker] = await Promise.all([
			makeOrg('leave-sec'),
			makeUser('leave-victim'),
			makeUser('leave-attacker'),
		]);
		const victimRow = await addRoster(org.id, victim.id);

		// The attacker names the victim's ORG — not a secret, and since v0.37.0.0
		// the org id IS the handle the profile page puts on the wire. The userId in
		// the WHERE is the only thing standing between them and the victim's row.
		const result = await softDeleteOwnOrgVolunteerByOrg(
			prisma,
			attacker.id,
			org.id,
		);

		expect(result).toBeNull();
		const after = await prisma.orgVolunteer.findUnique({
			where: { id: victimRow.id },
			select: { deletedAt: true },
		});
		// The victim's row is UNTOUCHED. Under the org-keyed form this matters MORE
		// than it did under the id-keyed one: every caller now supplies an org id
		// that legitimately belongs to someone else's row too, so the userId clause
		// is the whole guard rather than a second line of defence.
		expect(after?.deletedAt).toBeNull();
	});

	it('a second leave of the same org returns null rather than re-deleting', async () => {
		const [org, user] = await Promise.all([
			makeOrg('leave-twice'),
			makeUser('leave-twice'),
		]);
		const row = await addRoster(org.id, user.id);

		const first = await softDeleteOwnOrgVolunteerByOrg(prisma, user.id, org.id);
		const second = await softDeleteOwnOrgVolunteerByOrg(
			prisma,
			user.id,
			org.id,
		);

		expect(first).toBe(row.id);
		// Null means "no roster row to delete". The service no longer treats that
		// as a refusal — an application-only org has no row either — so what stops
		// a second VOLUNTEER_LEFT audit row is now the block check, tested below.
		expect(second).toBeNull();
	});

	it('leaving one org leaves the other rosters alone', async () => {
		const [orgA, orgB, user] = await Promise.all([
			makeOrg('leave-multi-a'),
			makeOrg('leave-multi-b'),
			makeUser('leave-multi'),
		]);
		await addRoster(orgA.id, user.id);
		await addRoster(orgB.id, user.id);

		await softDeleteOwnOrgVolunteerByOrg(prisma, user.id, orgA.id);

		const remaining = await listMyOrgRelationships(user.id);
		expect(remaining).toHaveLength(1);
		expect(remaining[0]?.organization.slug).toBe(`${PREFIX}leave-multi-b`);
	});
});

describe('listMyOrgRelationships', () => {
	it('returns live memberships across orgs and hides soft-deleted ones', async () => {
		const [orgA, orgB, user, stranger] = await Promise.all([
			makeOrg('mine-a'),
			makeOrg('mine-b'),
			makeUser('mine'),
			makeUser('mine-stranger'),
		]);
		await addRoster(orgA.id, user.id);
		await addRoster(orgB.id, user.id);
		// Another person on the same org roster must not appear in this list.
		await addRoster(orgA.id, stranger.id);

		await softDeleteOwnOrgVolunteerByOrg(prisma, user.id, orgA.id);

		const rows = await listMyOrgRelationships(user.id);

		expect(rows).toHaveLength(1);
		expect(rows[0]?.organization.name).toBe(`${PREFIX}mine-b`);
	});

	it('returns the newest membership first, with a deterministic tie-break', async () => {
		// The three rows are created back to back, so several can land in the same
		// millisecond — which is exactly why the orderBy carries an `id` tie-break
		// after `createdAt`. Without an assertion here the whole orderBy could be
		// dropped and the profile list would silently reorder between loads.
		const user = await makeUser('order');
		const orgs = [
			await makeOrg('order-1'),
			await makeOrg('order-2'),
			await makeOrg('order-3'),
		];
		for (const o of orgs) await addRoster(o.id, user.id);

		const rows = await listMyOrgRelationships(user.id);

		expect(rows).toHaveLength(3);
		const times = rows.map((r) => r.since.getTime());
		expect(times).toEqual([...times].sort((a, b) => b - a));
		// Stable across calls even when `since` ties. The final ordering is now a
		// JS sort over the merged set rather than a single ORDER BY, so stability
		// rests on Array.prototype.sort being stable AND on each source query
		// keeping its own deterministic tie-break.
		const again = await listMyOrgRelationships(user.id);
		expect(again.map((r) => r.orgId)).toEqual(rows.map((r) => r.orgId));
	});

	it('DOES project the org id — it is the only handle for a rowless org', async () => {
		// Inverted in v0.37.0.0. The old read deliberately withheld the org id
		// because `OrgVolunteer.id` was the client's handle and an org id bought
		// the page nothing. Now an org can appear here with NO roster row at all
		// (application-only, shift-only), so there is no row id to name it by and
		// `orgId` is the only stable handle. Not a disclosure: it is the
		// volunteer's own relationship, and the org slug beside it is already
		// public.
		const [org, user] = await Promise.all([
			makeOrg('mine-proj'),
			makeUser('mine-proj'),
		]);
		await addRoster(org.id, user.id);

		const [row] = await listMyOrgRelationships(user.id);

		expect(row?.orgId).toBe(org.id);
		expect(row?.organization.name).toBe(`${PREFIX}mine-proj`);
		// The nested organization object still stays minimal.
		expect(row?.organization).not.toHaveProperty('id');
	});
});

/**
 * OrgVolunteerBlock — the P1 from the T32 ship, proven against real Postgres.
 *
 * WHY INTEGRATION AND NOT UNIT. The unit suite mocks Prisma, so it can prove
 * that `findOrgVolunteerRelationship` consults the block and how it branches —
 * but not that a block written by one statement is seen by another, and not
 * that the surviving edges are really the ones the attack chain used. The whole
 * finding was that `SHIFT_SIGNUP` has no status filter and outlives the roster
 * row, which is a fact about rows in a database, not about call order.
 *
 * The chain reproduced below is the one from docs/TODOS.md:
 *   1. staff add a stranger by email (no consent required, by design)
 *   2. staff assign them to a shift  → SHIFT_SIGNUP edge, staff-minted
 *   3. the stranger follows the T12 email and leaves
 *   4. before this fix, SHIFT_SIGNUP still satisfied the guard — and that guard
 *      is the ONLY thing gating `backgroundChecks.initiate`, which takes
 *      staff-supplied SSN and date of birth and calls a paid third party.
 */
describe('OrgVolunteerBlock — leaving actually revokes', () => {
	async function addSignup(
		orgId: string,
		userId: string,
		status: SignupStatus,
	) {
		const shift = await prisma.shift.create({
			data: {
				orgId,
				title: `${PREFIX}shift`,
				startTime: new Date('2026-01-01T10:00:00Z'),
				endTime: new Date('2026-01-01T12:00:00Z'),
				capacity: 5,
			},
		});
		return prisma.shiftSignup.create({
			data: { shiftId: shift.id, userId, status },
		});
	}

	it('SECURITY: a staff-minted SHIFT_SIGNUP no longer survives the volunteer leaving', async () => {
		const [org, user] = await Promise.all([
			makeOrg('block-signup'),
			makeUser('block-signup'),
		]);
		await addRoster(org.id, user.id);
		await addSignup(org.id, user.id, 'CONFIRMED');

		// Sanity: before leaving, the org legitimately has a relationship.
		expect(await findOrgVolunteerRelationship(org.id, user.id)).not.toBeNull();

		await prisma.$transaction(async (tx) => {
			await softDeleteOwnOrgVolunteerByOrg(tx, user.id, org.id);
			await createOrgVolunteerBlock(tx, org.id, user.id);
		});

		// The signup row is deliberately still THERE — recorded hours must not
		// vanish, and the confirm copy promises they do not. What changed is that
		// it no longer authorizes anything.
		const signups = await prisma.shiftSignup.count({
			where: { userId: user.id, shift: { orgId: org.id } },
		});
		expect(signups).toBe(1);
		expect(await findOrgVolunteerRelationship(org.id, user.id)).toBeNull();
	});

	it('SECURITY: a CANCELLED signup does not authorize either', async () => {
		// Cancelling was the "fix" that option (a) in TODOS.md would have relied
		// on, and CANCELLED matched the unfiltered probe just as well as CONFIRMED.
		const [org, user] = await Promise.all([
			makeOrg('block-cancelled'),
			makeUser('block-cancelled'),
		]);
		await addRoster(org.id, user.id);
		await addSignup(org.id, user.id, 'CANCELLED');

		await prisma.$transaction(async (tx) => {
			await softDeleteOwnOrgVolunteerByOrg(tx, user.id, org.id);
			await createOrgVolunteerBlock(tx, org.id, user.id);
		});

		expect(await findOrgVolunteerRelationship(org.id, user.id)).toBeNull();
	});

	it('SECURITY: an APPLICATION the volunteer sent does not survive it either', async () => {
		const [org, user] = await Promise.all([
			makeOrg('block-app'),
			makeUser('block-app'),
		]);
		await prisma.volunteerApplication.create({
			data: {
				orgId: org.id,
				submittedByUserId: user.id,
				submittedByEmail: `${PREFIX}block-app@example.test`,
				status: 'APPROVED',
			},
		});
		await addRoster(org.id, user.id);

		await prisma.$transaction(async (tx) => {
			await softDeleteOwnOrgVolunteerByOrg(tx, user.id, org.id);
			await createOrgVolunteerBlock(tx, org.id, user.id);
		});

		// The application row itself is untouched — "your application stays with
		// them" is the promise on the APPLIED confirm. It just stops being a key.
		const apps = await prisma.volunteerApplication.count({
			where: { orgId: org.id, submittedByUserId: user.id },
		});
		expect(apps).toBe(1);
		expect(await findOrgVolunteerRelationship(org.id, user.id)).toBeNull();
	});

	it('findOrgVolunteerBlock reads the pair, and only that pair', async () => {
		// The read `addVolunteer`, `ensureAppliedRosterRow` and
		// `assignVolunteerToShift` all refuse on. Each of those refusals is unit
		// tested against a MOCKED repo, so nothing else proves this function
		// actually sees a row `createOrgVolunteerBlock` wrote — or that it stays
		// scoped, which is what keeps one org's refusal from blocking a second.
		const [orgA, orgB, user, other] = await Promise.all([
			makeOrg('block-find-a'),
			makeOrg('block-find-b'),
			makeUser('block-find'),
			makeUser('block-find-other'),
		]);
		await createOrgVolunteerBlock(prisma, orgA.id, user.id);

		expect(await findOrgVolunteerBlock(orgA.id, user.id)).toBeTruthy();
		expect(await findOrgVolunteerBlock(orgB.id, user.id)).toBeNull();
		expect(await findOrgVolunteerBlock(orgA.id, other.id)).toBeNull();
	});

	it('a block against one org does not revoke another', async () => {
		const [orgA, orgB, user] = await Promise.all([
			makeOrg('block-scope-a'),
			makeOrg('block-scope-b'),
			makeUser('block-scope'),
		]);
		await addRoster(orgA.id, user.id);
		await addRoster(orgB.id, user.id);
		await createOrgVolunteerBlock(prisma, orgA.id, user.id);

		expect(await findOrgVolunteerRelationship(orgA.id, user.id)).toBeNull();
		expect(await findOrgVolunteerRelationship(orgB.id, user.id)).toBe(
			'ORG_VOLUNTEER',
		);
	});

	it('ORG_MEMBER survives a block, so staff cannot lock themselves out', async () => {
		const [org, user] = await Promise.all([
			makeOrg('block-member'),
			makeUser('block-member'),
		]);
		await prisma.organizationMember.create({
			data: { organizationId: org.id, userId: user.id, role: 'ADMIN' },
		});
		// The application is load-bearing, not scenery. Without it the probe falls
		// straight through to ORG_MEMBER, short-circuits, and never consults the
		// block at all — so this test would pass even with the re-probe deleted,
		// which is exactly the vacuous pass it exists to avoid. With it, the probe
		// stops at APPLICATION and only the re-probe can produce ORG_MEMBER.
		await prisma.volunteerApplication.create({
			data: {
				orgId: org.id,
				submittedByUserId: user.id,
				submittedByEmail: `${PREFIX}block-member@example.test`,
				status: 'APPROVED',
			},
		});
		await addRoster(org.id, user.id);

		await prisma.$transaction(async (tx) => {
			await softDeleteOwnOrgVolunteerByOrg(tx, user.id, org.id);
			await createOrgVolunteerBlock(tx, org.id, user.id);
		});

		// A coordinator who is also on their own org's volunteer roster keeps their
		// staff access. Leaving a roster revokes a VOLUNTEER relationship; it is
		// not a resignation.
		expect(await findOrgVolunteerRelationship(org.id, user.id)).toBe(
			'ORG_MEMBER',
		);
	});

	it('is idempotent: leaving twice does not raise P2002', async () => {
		const [org, user] = await Promise.all([
			makeOrg('block-twice'),
			makeUser('block-twice'),
		]);
		await addRoster(org.id, user.id);

		await createOrgVolunteerBlock(prisma, org.id, user.id);
		// Reachable for real: staff re-add before the block existed, or two tabs.
		// A create-and-catch here would poison the enclosing transaction.
		await expect(
			createOrgVolunteerBlock(prisma, org.id, user.id),
		).resolves.toBeTruthy();

		expect(
			await prisma.orgVolunteerBlock.count({
				where: { orgId: org.id, userId: user.id },
			}),
		).toBe(1);
	});

	it('lifting restores the relationship, and lifting nothing is a no-op', async () => {
		const [org, user] = await Promise.all([
			makeOrg('block-lift'),
			makeUser('block-lift'),
		]);
		await addRoster(org.id, user.id);
		await createOrgVolunteerBlock(prisma, org.id, user.id);

		expect(await deleteOrgVolunteerBlock(prisma, org.id, user.id)).toBe(1);
		expect(await findOrgVolunteerRelationship(org.id, user.id)).toBe(
			'ORG_VOLUNTEER',
		);

		// deleteMany, not delete: every caller runs unconditionally inside someone
		// else's transaction, and P2025 on a missing row would roll back the
		// application submission or shift signup that triggered the lift.
		expect(await deleteOrgVolunteerBlock(prisma, org.id, user.id)).toBe(0);
	});
});

/**
 * listMyOrgRelationships — the D1 widening, proven against real Postgres.
 *
 * The listing stopped being "roster rows" in v0.37.0.0 because listing only
 * roster rows let an org DENY the remedy: remove the volunteer, and the row
 * vanished from their list along with the Leave button — while the application
 * or shift signup the org still held kept satisfying
 * `findOrgVolunteerRelationship`, and with it `credentials.issue` and
 * `backgroundChecks.initiate`. These have to be integration tests: the merge
 * spans three tables, and a mocked client would return whatever it was told.
 */
describe('listMyOrgRelationships — orgs with no roster row', () => {
	it('lists an org that holds only an APPLICATION', async () => {
		const [org, user] = await Promise.all([
			makeOrg('rel-app'),
			makeUser('rel-app'),
		]);
		await prisma.volunteerApplication.create({
			data: {
				orgId: org.id,
				submittedByUserId: user.id,
				submittedByEmail: `${PREFIX}rel-app@example.test`,
				status: 'APPROVED',
			},
		});

		const rows = await listMyOrgRelationships(user.id);

		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			orgId: org.id,
			reason: 'APPLICATION_ONLY',
			onRoster: false,
		});
	});

	it('lists an org that holds only a SHIFT_SIGNUP, cancelled included', async () => {
		const [org, user] = await Promise.all([
			makeOrg('rel-shift'),
			makeUser('rel-shift'),
		]);
		const shift = await prisma.shift.create({
			data: {
				orgId: org.id,
				title: `${PREFIX}shift`,
				startTime: new Date('2026-01-01T10:00:00Z'),
				endTime: new Date('2026-01-01T12:00:00Z'),
				capacity: 5,
			},
		});
		// CANCELLED on purpose: it still satisfies the relationship probe, so it
		// must still be leavable. A status filter here would reopen the hole.
		await prisma.shiftSignup.create({
			data: { shiftId: shift.id, userId: user.id, status: 'CANCELLED' },
		});

		const rows = await listMyOrgRelationships(user.id);

		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			orgId: org.id,
			reason: 'SHIFT_ONLY',
			onRoster: false,
		});
	});

	it('SECURITY: a staff removal no longer hides the org from its volunteer', async () => {
		// The exact denial-of-remedy chain: staff add a stranger, assign them to a
		// shift, then remove them from the roster. Under the roster-row-only
		// listing the volunteer saw nothing and had no way to revoke, while the
		// SHIFT_SIGNUP kept the org's access alive indefinitely.
		const [org, user] = await Promise.all([
			makeOrg('rel-removed'),
			makeUser('rel-removed'),
		]);
		const row = await addRoster(org.id, user.id);
		const shift = await prisma.shift.create({
			data: {
				orgId: org.id,
				title: `${PREFIX}shift-removed`,
				startTime: new Date('2026-01-01T10:00:00Z'),
				endTime: new Date('2026-01-01T12:00:00Z'),
				capacity: 5,
			},
		});
		await prisma.shiftSignup.create({
			data: { shiftId: shift.id, userId: user.id, status: 'CONFIRMED' },
		});

		// Staff remove them.
		await softDeleteOrgVolunteer(prisma, org.id, row.id);

		const rows = await listMyOrgRelationships(user.id);

		// Still listed, still leavable — via the surviving signup.
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ orgId: org.id, reason: 'SHIFT_ONLY' });
		// And the org genuinely still had access at this point, which is why it
		// has to be listed.
		expect(await findOrgVolunteerRelationship(org.id, user.id)).toBe(
			'SHIFT_SIGNUP',
		);
	});

	it('prefers the roster row when several edges exist for one org', async () => {
		const [org, user] = await Promise.all([
			makeOrg('rel-precedence'),
			makeUser('rel-precedence'),
		]);
		await prisma.volunteerApplication.create({
			data: {
				orgId: org.id,
				submittedByUserId: user.id,
				submittedByEmail: `${PREFIX}rel-precedence@example.test`,
				status: 'APPROVED',
			},
		});
		await addRoster(org.id, user.id);

		const rows = await listMyOrgRelationships(user.id);

		// One row per ORG, not per edge, and the most specific answer to "why is
		// this org here?" wins.
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			reason: 'STAFF_ADDED',
			onRoster: true,
		});
	});

	it('hides an org the volunteer has already blocked', async () => {
		const [org, user] = await Promise.all([
			makeOrg('rel-blocked'),
			makeUser('rel-blocked'),
		]);
		await addRoster(org.id, user.id);
		await createOrgVolunteerBlock(prisma, org.id, user.id);

		// Nothing left to do there, and listing it would offer a button that throws.
		expect(await listMyOrgRelationships(user.id)).toHaveLength(0);
	});

	it('flags staff membership without listing the org on its own', async () => {
		const [orgStaffOnly, orgBoth, user] = await Promise.all([
			makeOrg('rel-staff-only'),
			makeOrg('rel-staff-both'),
			makeUser('rel-staff'),
		]);
		await prisma.organizationMember.createMany({
			data: [
				{ organizationId: orgStaffOnly.id, userId: user.id, role: 'ADMIN' },
				{ organizationId: orgBoth.id, userId: user.id, role: 'ADMIN' },
			],
		});
		await addRoster(orgBoth.id, user.id);

		const rows = await listMyOrgRelationships(user.id);

		// Staff membership alone is NOT a volunteer relationship and must not put
		// an org on this list — leaving would revoke nothing for it.
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ orgId: orgBoth.id, isStaff: true });
	});

	it('SECURITY: hasLeavableOrgRelationship refuses an unrelated org', async () => {
		const [org, stranger] = await Promise.all([
			makeOrg('rel-guard'),
			makeUser('rel-guard-stranger'),
		]);

		// orgId is caller-supplied on the leave mutation now, so without this
		// precondition any authenticated user could mint blocks against orgs they
		// have never interacted with.
		expect(await hasLeavableOrgRelationship(prisma, org.id, stranger.id)).toBe(
			false,
		);
	});

	it('hasLeavableOrgRelationship accepts each of the three edges', async () => {
		const [orgRoster, orgApp, orgShift, user] = await Promise.all([
			makeOrg('rel-any-roster'),
			makeOrg('rel-any-app'),
			makeOrg('rel-any-shift'),
			makeUser('rel-any'),
		]);
		await addRoster(orgRoster.id, user.id);
		await prisma.volunteerApplication.create({
			data: {
				orgId: orgApp.id,
				submittedByUserId: user.id,
				submittedByEmail: `${PREFIX}rel-any@example.test`,
				status: 'SUBMITTED',
			},
		});
		const shift = await prisma.shift.create({
			data: {
				orgId: orgShift.id,
				title: `${PREFIX}rel-any-shift`,
				startTime: new Date('2026-01-01T10:00:00Z'),
				endTime: new Date('2026-01-01T12:00:00Z'),
				capacity: 5,
			},
		});
		await prisma.shiftSignup.create({
			data: { shiftId: shift.id, userId: user.id, status: 'CONFIRMED' },
		});

		for (const orgId of [orgRoster.id, orgApp.id, orgShift.id]) {
			expect(await hasLeavableOrgRelationship(prisma, orgId, user.id)).toBe(
				true,
			);
		}
	});
});
