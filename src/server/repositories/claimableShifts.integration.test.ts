/**
 * Integration tests for listClaimableShiftsForUser: which open shifts a
 * volunteer is shown to pick from. The relation filters (roster row live,
 * no block, org not suspended) are the authorization, so they are tested
 * against real Postgres rather than a mocked `where`.
 *
 * Run with: pnpm test:integration
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ShiftStatus } from '@/prisma/generated/client';
import { prisma } from '@/server/repositories/prisma';
import { listClaimableShiftsForUser } from './shiftRepo';

const PREFIX = '__claimable_shifts__';
const NOW = new Date('2030-03-01T12:00:00Z');
const LATER = new Date('2030-03-08T16:00:00Z');
const EARLIER = new Date('2030-02-20T16:00:00Z');

const created = { orgIds: [] as string[], userIds: [] as string[] };

async function org(suffix: string, opts?: { suspended?: boolean }) {
	const o = await prisma.organization.create({
		data: {
			name: `${PREFIX}${suffix}`,
			slug: `${PREFIX}${suffix}`.toLowerCase().replace(/[^a-z0-9]/g, '-'),
			suspendedAt: opts?.suspended ? NOW : null,
		},
	});
	created.orgIds.push(o.id);
	return o;
}

async function user(suffix: string) {
	const u = await prisma.user.create({
		data: { email: `${PREFIX}${suffix}@test.example`, name: suffix },
	});
	created.userIds.push(u.id);
	return u;
}

async function roster(
	orgId: string,
	userId: string,
	opts?: { deleted?: boolean },
) {
	return prisma.orgVolunteer.create({
		data: {
			orgId,
			userId,
			displayName: 'Vol',
			source: 'APPLIED',
			deletedAt: opts?.deleted ? NOW : null,
		},
	});
}

async function shift(
	orgId: string,
	title: string,
	opts?: { start?: Date; status?: ShiftStatus; capacity?: number },
) {
	const start = opts?.start ?? LATER;
	return prisma.shift.create({
		data: {
			orgId,
			title: `${PREFIX}${title}`,
			startTime: start,
			endTime: new Date(start.getTime() + 3 * 60 * 60 * 1000),
			capacity: opts?.capacity ?? 5,
			status: opts?.status ?? 'OPEN',
		},
	});
}

const titles = (rows: { title: string }[]) =>
	rows.map((r) => r.title.replace(PREFIX, '')).sort();

let maya: { id: string };
let other: { id: string };

beforeAll(async () => {
	maya = await user('maya');
	other = await user('other');

	const mine = await org('mine');
	await roster(mine.id, maya.id);
	await shift(mine.id, 'open');
	await shift(mine.id, 'full', { status: 'FULL' });
	await shift(mine.id, 'cancelled', { status: 'CANCELLED' });
	await shift(mine.id, 'completed', { status: 'COMPLETED' });
	await shift(mine.id, 'past', { start: EARLIER });
	const signedUp = await shift(mine.id, 'signed-up');
	await prisma.shiftSignup.create({
		data: { shiftId: signedUp.id, userId: maya.id, status: 'CONFIRMED' },
	});
	// someone else's confirmed seat counts toward capacity but is not "mine"
	await prisma.shiftSignup.create({
		data: { shiftId: signedUp.id, userId: other.id, status: 'CONFIRMED' },
	});

	const stranger = await org('stranger');
	await shift(stranger.id, 'stranger-shift');

	const left = await org('left');
	await roster(left.id, maya.id, { deleted: true });
	await shift(left.id, 'left-shift');

	const blocked = await org('blocked');
	await roster(blocked.id, maya.id);
	await prisma.orgVolunteerBlock.create({
		data: { orgId: blocked.id, userId: maya.id },
	});
	await shift(blocked.id, 'blocked-shift');

	const suspended = await org('suspended', { suspended: true });
	await roster(suspended.id, maya.id);
	await shift(suspended.id, 'suspended-shift');
});

afterAll(async () => {
	await prisma.organization.deleteMany({
		where: { id: { in: created.orgIds } },
	});
	await prisma.user.deleteMany({ where: { id: { in: created.userIds } } });
});

describe('listClaimableShiftsForUser', () => {
	it('lists only upcoming OPEN/FULL shifts at orgs with a live roster row', async () => {
		const rows = await listClaimableShiftsForUser(maya.id, NOW);
		expect(titles(rows)).toEqual(['full', 'open', 'signed-up']);
	});

	it('never shows a stranger, a left, a blocked or a suspended org', async () => {
		const rows = await listClaimableShiftsForUser(maya.id, NOW);
		for (const hidden of [
			'stranger-shift',
			'left-shift',
			'blocked-shift',
			'suspended-shift',
		]) {
			expect(titles(rows)).not.toContain(hidden);
		}
	});

	it('returns only the caller’s own signup and an aggregate seat count', async () => {
		const rows = await listClaimableShiftsForUser(maya.id, NOW);
		const signedUp = rows.find((r) => r.title.endsWith('signed-up'));
		expect(signedUp?.signups).toEqual([{ status: 'CONFIRMED' }]);
		expect(signedUp?._count.signups).toBe(2);
		const open = rows.find((r) => r.title.endsWith('open'));
		expect(open?.signups).toEqual([]);
	});

	it('shows nothing to someone on no roster', async () => {
		expect(await listClaimableShiftsForUser(other.id, NOW)).toEqual([]);
	});
});
