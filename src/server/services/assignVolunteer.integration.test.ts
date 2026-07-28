/**
 * Integration tests for `assignVolunteerToShift` (T8/T24).
 *
 * Uses real Postgres. Requires DATABASE_URL. Run with: pnpm test:integration
 *
 * WHY THESE MUST BE INTEGRATION TESTS
 * -----------------------------------
 * The service tests mock the repository layer, so they prove the branching is
 * right but assert nothing about what the database actually permits. Three
 * claims here are properties of the schema, and each one is a claim the design
 * doc got wrong:
 *
 *   1. **Over capacity really is possible.** `Shift.capacity` is an ordinary
 *      integer column with no CHECK constraint and no trigger behind it, so
 *      `allowOverCapacity` is enforceable purely in the domain. If a constraint
 *      were ever added, the D11 override would start 500-ing and only this test
 *      would notice.
 *
 *   2. **Reassignment is NOT free.** The doc claimed
 *      `@@unique([shiftId, userId])` made this idempotent. It does the exact
 *      opposite: a second `create` for a pair that already has a CANCELLED row
 *      raises P2002. The service therefore updates rather than creates, and the
 *      first test below reproduces the raw failure so the reason is recorded.
 *
 *   3. **`listAssignableVolunteers` excludes on the right axis.** The exclusion
 *      is a nested `none` over a relation, which is exactly the kind of filter a
 *      mock cannot check — and getting it backwards would either hide the whole
 *      roster or offer people who are already on the shift.
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
	findOrgVolunteerById,
	listAssignableVolunteers,
} from '@/server/repositories/orgVolunteerRepo';
import { prisma } from '@/server/repositories/prisma';
import { assignVolunteerToShift } from '@/server/services/shiftSignupService';

const PREFIX = '__assignvolunteer_integration__';

const createdOrgIds: string[] = [];
const createdUserIds: string[] = [];

async function fixture(suffix: string, capacity = 1) {
	const org = await prisma.organization.create({
		data: { name: `${PREFIX}${suffix}`, slug: `${PREFIX}${suffix}` },
	});
	createdOrgIds.push(org.id);

	const staff = await prisma.user.create({
		data: { email: `${PREFIX}${suffix}-staff@example.test` },
	});
	createdUserIds.push(staff.id);

	const shift = await prisma.shift.create({
		data: {
			orgId: org.id,
			title: `${PREFIX}${suffix}`,
			startTime: new Date('2027-01-02T09:00:00Z'),
			endTime: new Date('2027-01-02T12:00:00Z'),
			capacity,
		},
	});

	return { org, staff, shift };
}

async function roster(orgId: string, suffix: string) {
	const user = await prisma.user.create({
		data: {
			email: `${PREFIX}${suffix}@example.test`,
			accountState: 'UNCLAIMED',
		},
	});
	createdUserIds.push(user.id);

	const volunteer = await prisma.orgVolunteer.create({
		data: {
			orgId,
			userId: user.id,
			displayName: `Volunteer ${suffix}`,
			source: 'STAFF_ADDED',
		},
	});

	return { user, volunteer };
}

// Deletes ONLY the ids this file created — never an unscoped prefix sweep,
// which could catch a sibling worker's live rows (CLAUDE.md).
afterEach(async () => {
	if (createdOrgIds.length > 0) {
		await prisma.shiftSignup.deleteMany({
			where: { shift: { orgId: { in: createdOrgIds } } },
		});
		await prisma.shift.deleteMany({ where: { orgId: { in: createdOrgIds } } });
		await prisma.auditLog.deleteMany({
			where: { orgId: { in: createdOrgIds } },
		});
		await prisma.orgVolunteer.deleteMany({
			where: { orgId: { in: createdOrgIds } },
		});
		await prisma.organization.deleteMany({
			where: { id: { in: createdOrgIds } },
		});
		createdOrgIds.length = 0;
	}
	if (createdUserIds.length > 0) {
		await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
		createdUserIds.length = 0;
	}
});

describe('the unique index the design doc misread', () => {
	it('a second create for the same (shift, user) raises P2002 even when the first is CANCELLED', async () => {
		const { org, shift } = await fixture('p2002');
		const { user } = await roster(org.id, 'p2002');

		await prisma.shiftSignup.create({
			data: { shiftId: shift.id, userId: user.id, status: 'CANCELLED' },
		});

		// This is what "reassignment is idempotent" would have shipped as: a
		// coordinator re-adding someone who cancelled gets a 500.
		await expect(
			prisma.shiftSignup.create({
				data: { shiftId: shift.id, userId: user.id, status: 'CONFIRMED' },
			}),
		).rejects.toMatchObject({ code: 'P2002' });
	});

	it('assignVolunteerToShift revives that row instead, preserving its id', async () => {
		const { org, staff, shift } = await fixture('revive');
		const { user, volunteer } = await roster(org.id, 'revive');

		const cancelled = await prisma.shiftSignup.create({
			data: { shiftId: shift.id, userId: user.id, status: 'CANCELLED' },
		});

		const result = await assignVolunteerToShift({
			shiftId: shift.id,
			volunteerId: volunteer.id,
			orgId: org.id,
			actorId: staff.id,
		});

		expect(result.signupId).toBe(cancelled.id);
		const rows = await prisma.shiftSignup.findMany({
			where: { shiftId: shift.id },
		});
		expect(rows).toHaveLength(1);
		expect(rows[0].status).toBe('CONFIRMED');
	});
});

describe('over capacity', () => {
	it('is refused by default', async () => {
		const { org, staff, shift } = await fixture('refuse', 1);
		const { volunteer: first } = await roster(org.id, 'refuse-a');
		const { volunteer: second } = await roster(org.id, 'refuse-b');

		await assignVolunteerToShift({
			shiftId: shift.id,
			volunteerId: first.id,
			orgId: org.id,
			actorId: staff.id,
		});

		await expect(
			assignVolunteerToShift({
				shiftId: shift.id,
				volunteerId: second.id,
				orgId: org.id,
				actorId: staff.id,
			}),
		).rejects.toMatchObject({ code: 'CONFLICT' });
	});

	it('actually lands in the database when the coordinator overrides', async () => {
		const { org, staff, shift } = await fixture('over', 1);
		const { volunteer: first } = await roster(org.id, 'over-a');
		const { volunteer: second } = await roster(org.id, 'over-b');

		await assignVolunteerToShift({
			shiftId: shift.id,
			volunteerId: first.id,
			orgId: org.id,
			actorId: staff.id,
		});
		const result = await assignVolunteerToShift({
			shiftId: shift.id,
			volunteerId: second.id,
			orgId: org.id,
			actorId: staff.id,
			allowOverCapacity: true,
		});

		expect(result.overCapacity).toBe(true);
		// 2 of 1 — nothing in the schema stops this, which is what makes the
		// override a pure domain decision.
		const confirmed = await prisma.shiftSignup.count({
			where: { shiftId: shift.id, status: 'CONFIRMED' },
		});
		expect(confirmed).toBe(2);

		const audit = await prisma.auditLog.findFirst({
			where: { orgId: org.id, action: 'shift.volunteer.assigned' },
			orderBy: { createdAt: 'desc' },
		});
		expect(audit?.metadata).toMatchObject({ overCapacity: true });
	});
});

describe('SECURITY: org scoping', () => {
	it('refuses a volunteer from another org roster', async () => {
		const { org, staff, shift } = await fixture('scope-a');
		const other = await fixture('scope-b');
		const { volunteer: foreign } = await roster(other.org.id, 'scope-foreign');

		await expect(
			assignVolunteerToShift({
				shiftId: shift.id,
				volunteerId: foreign.id,
				orgId: org.id,
				actorId: staff.id,
			}),
		).rejects.toMatchObject({ code: 'NOT_FOUND' });

		expect(await findOrgVolunteerById(org.id, foreign.id)).toBeNull();
		expect(
			await prisma.shiftSignup.count({ where: { shiftId: shift.id } }),
		).toBe(0);
	});

	it('refuses a shift belonging to another org', async () => {
		const { org, staff } = await fixture('shift-a');
		const other = await fixture('shift-b');
		const { volunteer } = await roster(org.id, 'shift-vol');

		await expect(
			assignVolunteerToShift({
				shiftId: other.shift.id,
				volunteerId: volunteer.id,
				orgId: org.id,
				actorId: staff.id,
			}),
		).rejects.toMatchObject({ code: 'NOT_FOUND' });
	});
});

describe('listAssignableVolunteers', () => {
	it('excludes live signups, keeps cancelled ones, and honours soft deletes', async () => {
		const { org, shift } = await fixture('list', 10);
		const available = await roster(org.id, 'list-free');
		const onShift = await roster(org.id, 'list-taken');
		const cancelled = await roster(org.id, 'list-cancelled');
		const removed = await roster(org.id, 'list-removed');

		await prisma.shiftSignup.createMany({
			data: [
				{ shiftId: shift.id, userId: onShift.user.id, status: 'CONFIRMED' },
				{
					shiftId: shift.id,
					userId: cancelled.user.id,
					status: 'CANCELLED',
				},
			],
		});
		await prisma.orgVolunteer.update({
			where: { id: removed.volunteer.id },
			data: { deletedAt: new Date() },
		});

		const rows = await listAssignableVolunteers({
			orgId: org.id,
			shiftId: shift.id,
		});
		const ids = rows.map((r) => r.id);

		expect(ids).toContain(available.volunteer.id);
		// Re-adding someone who cancelled is ordinary, so they stay offerable.
		expect(ids).toContain(cancelled.volunteer.id);
		expect(ids).not.toContain(onShift.volunteer.id);
		expect(ids).not.toContain(removed.volunteer.id);
	});

	it('SECURITY: never returns another org roster', async () => {
		const { org, shift } = await fixture('list-scope-a', 10);
		const other = await fixture('list-scope-b');
		const foreign = await roster(other.org.id, 'list-scope-foreign');

		const rows = await listAssignableVolunteers({
			orgId: org.id,
			shiftId: shift.id,
		});

		expect(rows.map((r) => r.id)).not.toContain(foreign.volunteer.id);
	});
});
