/**
 * Integration tests for org scoping on the shift surface. Real Postgres.
 * Run with: pnpm test:integration
 *
 * WHY THESE MUST BE INTEGRATION TESTS
 * -----------------------------------
 * The unit tests in `__tests__/shiftOrgScoping.test.ts` mock `getShiftById`, so
 * they prove the guard is *called* — not that it actually prevents a write. Two
 * things only a real database can settle:
 *
 *   1. `completeShift` enforces ownership inside the WHERE clause of an
 *      `updateMany` rather than via a preceding read (deliberately, to keep the
 *      statement atomic). A mocked `updateMany` returns whatever count the test
 *      tells it to, so a mock can assert the clause was *passed* but never that
 *      Postgres honours it. Here we assert the victim row is untouched.
 *   2. `removeShift` cascades to `ShiftSignup`. The blast radius of getting this
 *      wrong is deleted attendance history, which no mock can demonstrate.
 *
 * Each test sets up two orgs and drives the service as org B against org A's
 * shift, then asserts org A's data is byte-for-byte unchanged.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { prisma } from '@/server/repositories/prisma';
import {
	cancelShift,
	completeShift,
	getShiftDetail,
	removeShift,
	updateExistingShift,
} from '@/server/services/shiftService';
import {
	getShiftSignups,
	getShiftWaitlist,
} from '@/server/services/shiftSignupService';
import {
	removeTemplate,
	updateExistingTemplate,
} from '@/server/services/shiftTemplateService';

const PREFIX = '__shiftscope_integration__';

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

async function makeShift(orgId: string, title = 'Victim Shift') {
	return prisma.shift.create({
		data: {
			orgId,
			title,
			startTime: new Date('2026-09-01T09:00:00Z'),
			endTime: new Date('2026-09-01T12:00:00Z'),
			capacity: 5,
			status: 'OPEN',
		},
	});
}

/** Org A owns a shift with one confirmed signup; org B is the attacker. */
async function setupTwoOrgs() {
	const [victimOrg, attackerOrg, volunteer] = await Promise.all([
		makeOrg('victim'),
		makeOrg('attacker'),
		makeUser('vol'),
	]);
	const shift = await makeShift(victimOrg.id);
	await prisma.shiftSignup.create({
		data: { shiftId: shift.id, userId: volunteer.id, status: 'CONFIRMED' },
	});
	return { victimOrg, attackerOrg, volunteer, shift };
}

async function makeTemplate(orgId: string, title = 'Victim Template') {
	return prisma.shiftTemplate.create({
		data: {
			orgId,
			title,
			dayOfWeek: 1,
			startHour: 9,
			startMinute: 0,
			endHour: 12,
			endMinute: 0,
			capacity: 5,
		},
	});
}

afterEach(async () => {
	await prisma.shiftSignup.deleteMany({
		where: { shift: { organization: { slug: { startsWith: PREFIX } } } },
	});
	await prisma.shiftTemplate.deleteMany({
		where: { organization: { slug: { startsWith: PREFIX } } },
	});
	await prisma.auditLog.deleteMany({
		where: { organization: { slug: { startsWith: PREFIX } } },
	});
	await prisma.shift.deleteMany({
		where: { organization: { slug: { startsWith: PREFIX } } },
	});
	await prisma.user.deleteMany({
		where: { email: { startsWith: PREFIX } },
	});
	await prisma.organization.deleteMany({
		where: { slug: { startsWith: PREFIX } },
	});
});

describe('reads', () => {
	it('SECURITY: getShiftSignups refuses another org, returns the roster to the owner', async () => {
		const { victimOrg, attackerOrg, shift } = await setupTwoOrgs();

		await expect(
			getShiftSignups(shift.id, attackerOrg.id),
		).rejects.toMatchObject({ code: 'NOT_FOUND' });

		const owned = await getShiftSignups(shift.id, victimOrg.id);
		expect(owned).toHaveLength(1);
	});

	it('SECURITY: getShiftWaitlist refuses another org', async () => {
		const { attackerOrg, shift } = await setupTwoOrgs();

		await expect(
			getShiftWaitlist(shift.id, attackerOrg.id),
		).rejects.toMatchObject({ code: 'NOT_FOUND' });
	});

	it('SECURITY: getShiftDetail hides another org’s roster, shows the owner’s', async () => {
		const { victimOrg, attackerOrg, shift } = await setupTwoOrgs();

		expect(await getShiftDetail(shift.id, attackerOrg.id)).toBeNull();

		const owned = await getShiftDetail(shift.id, victimOrg.id);
		expect(owned?.signups).toHaveLength(1);
	});
});

describe('writes', () => {
	it('SECURITY: updateExistingShift cannot edit another org’s shift', async () => {
		const { attackerOrg, shift } = await setupTwoOrgs();

		await expect(
			updateExistingShift(
				{ id: shift.id, title: 'Hijacked', capacity: 999 },
				attackerOrg.id,
				'actor-1',
			),
		).rejects.toMatchObject({ code: 'NOT_FOUND' });

		const after = await prisma.shift.findUniqueOrThrow({
			where: { id: shift.id },
		});
		expect(after.title).toBe('Victim Shift');
		expect(after.capacity).toBe(5);
	});

	it('SECURITY: cancelShift cannot cancel another org’s shift', async () => {
		const { attackerOrg, shift } = await setupTwoOrgs();

		await expect(
			cancelShift(shift.id, attackerOrg.id, 'actor-1'),
		).rejects.toMatchObject({ code: 'NOT_FOUND' });

		const after = await prisma.shift.findUniqueOrThrow({
			where: { id: shift.id },
		});
		expect(after.status).toBe('OPEN');
	});

	it('SECURITY: completeShift’s WHERE clause is honoured by Postgres', async () => {
		// The whole point: ownership is enforced in the UPDATE statement itself,
		// so only the database can prove it works.
		const { victimOrg, attackerOrg, volunteer, shift } = await setupTwoOrgs();

		expect(
			await completeShift(shift.id, attackerOrg.id, volunteer.id),
		).toBeNull();

		const untouched = await prisma.shift.findUniqueOrThrow({
			where: { id: shift.id },
		});
		expect(untouched.status).toBe('OPEN');

		// ...and the real owner can still complete it. This half also proves the
		// guard is not simply rejecting everything.
		const completed = await completeShift(shift.id, victimOrg.id, volunteer.id);
		expect(completed?.status).toBe('COMPLETED');
	});

	it('SECURITY: removeShift cannot delete another org’s shift or its attendance', async () => {
		const { attackerOrg, shift } = await setupTwoOrgs();

		await expect(
			removeShift(shift.id, attackerOrg.id, 'actor-1'),
		).rejects.toMatchObject({ code: 'NOT_FOUND' });

		// The shift survives — and so does the signup row it cascades to.
		expect(await prisma.shift.count({ where: { id: shift.id } })).toBe(1);
		expect(
			await prisma.shiftSignup.count({ where: { shiftId: shift.id } }),
		).toBe(1);
	});
});

describe('shift templates', () => {
	// Same omission as the shift writes, one service over: `orgId` reached
	// updateExistingTemplate/removeTemplate only as an audit-log field.
	it("SECURITY: cannot edit another org's template", async () => {
		const { attackerOrg, victimOrg } = await setupTwoOrgs();
		const template = await makeTemplate(victimOrg.id);

		await expect(
			updateExistingTemplate(
				{ id: template.id, title: 'Hijacked', capacity: 999 },
				attackerOrg.id,
				'actor-1',
			),
		).rejects.toMatchObject({ code: 'NOT_FOUND' });

		const after = await prisma.shiftTemplate.findUniqueOrThrow({
			where: { id: template.id },
		});
		expect(after.title).toBe('Victim Template');
		expect(after.capacity).toBe(5);
	});

	it("SECURITY: cannot delete another org's template", async () => {
		const { attackerOrg, victimOrg } = await setupTwoOrgs();
		const template = await makeTemplate(victimOrg.id);

		await expect(
			removeTemplate(template.id, attackerOrg.id, 'actor-1'),
		).rejects.toMatchObject({ code: 'NOT_FOUND' });

		expect(
			await prisma.shiftTemplate.count({ where: { id: template.id } }),
		).toBe(1);
	});

	it('the owning org can still edit its own template', async () => {
		// Proves the guard is not simply rejecting everything. Uses a real user id
		// because this path reaches the audit write, and AuditLog.actorId is an FK.
		const { victimOrg, volunteer } = await setupTwoOrgs();
		const template = await makeTemplate(victimOrg.id);

		await updateExistingTemplate(
			{ id: template.id, title: 'Renamed' },
			victimOrg.id,
			volunteer.id,
		);

		const after = await prisma.shiftTemplate.findUniqueOrThrow({
			where: { id: template.id },
		});
		expect(after.title).toBe('Renamed');
	});
});
