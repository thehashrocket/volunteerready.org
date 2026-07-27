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
import { prisma } from '@/server/repositories/prisma';
import {
	countAttendedShiftsByUser,
	countOrgVolunteers,
	findLiveOrgVolunteer,
	listOrgVolunteers,
	restoreOrgVolunteer,
	softDeleteOrgVolunteer,
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
