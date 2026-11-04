/**
 * `listClaimableShifts` — the projection behind the volunteer's "Open shifts"
 * list. Which shifts appear is decided in the repository (and tested against
 * Postgres in claimableShifts.integration.test.ts); this pins what the
 * volunteer is told about each one.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	listClaimableShiftsForUser: vi.fn(),
}));

vi.mock('@/server/repositories/shiftRepo', () => ({
	getShiftById: vi.fn(),
	listClaimableShiftsForUser: mocks.listClaimableShiftsForUser,
}));
vi.mock('@/server/repositories/prisma', () => ({ prisma: {} }));

import { listClaimableShifts } from '../shiftSignupService';

function row(overrides: Record<string, unknown> = {}) {
	return {
		id: 'shift-1',
		title: 'Saturday Food Sort',
		startTime: new Date('2030-03-08T16:00:00Z'),
		endTime: new Date('2030-03-08T19:00:00Z'),
		location: '1200 Main St',
		isRemote: false,
		capacity: 10,
		status: 'OPEN',
		organization: { id: 'org-1', name: 'Helping Hands' },
		opportunity: { title: 'Weekly Sorting' },
		_count: { signups: 4 },
		signups: [],
		...overrides,
	};
}

beforeEach(() => {
	mocks.listClaimableShiftsForUser.mockReset();
});

describe('listClaimableShifts', () => {
	it('passes the caller and the clock to the repository', async () => {
		mocks.listClaimableShiftsForUser.mockResolvedValue([]);
		const now = new Date('2030-03-01T12:00:00Z');
		await listClaimableShifts('user-1', now);
		expect(mocks.listClaimableShiftsForUser).toHaveBeenCalledWith(
			'user-1',
			now,
		);
	});

	it('reports seats left and no signup of my own', async () => {
		mocks.listClaimableShiftsForUser.mockResolvedValue([row()]);
		const [shift] = await listClaimableShifts('user-1');
		expect(shift).toMatchObject({
			id: 'shift-1',
			orgName: 'Helping Hands',
			opportunityTitle: 'Weekly Sorting',
			seatsLeft: 6,
			isFull: false,
			myStatus: null,
		});
	});

	it('treats a FULL status or a filled capacity as full, never negative seats', async () => {
		mocks.listClaimableShiftsForUser.mockResolvedValue([
			row({ id: 'a', status: 'FULL', _count: { signups: 9 } }),
			row({ id: 'b', status: 'OPEN', _count: { signups: 12 } }),
		]);
		const [a, b] = await listClaimableShifts('user-1');
		expect(a.isFull).toBe(true);
		expect(b.isFull).toBe(true);
		expect(b.seatsLeft).toBe(0);
	});

	it("surfaces the caller's own confirmed or waitlisted signup", async () => {
		mocks.listClaimableShiftsForUser.mockResolvedValue([
			row({ id: 'a', signups: [{ status: 'CONFIRMED' }] }),
			row({ id: 'b', signups: [{ status: 'WAITLISTED' }] }),
		]);
		const [a, b] = await listClaimableShifts('user-1');
		expect(a.myStatus).toBe('CONFIRMED');
		expect(b.myStatus).toBe('WAITLISTED');
	});

	it('does not expose other volunteers or the org id', async () => {
		mocks.listClaimableShiftsForUser.mockResolvedValue([row()]);
		const [shift] = await listClaimableShifts('user-1');
		expect(Object.keys(shift).sort()).toEqual(
			[
				'capacity',
				'endTime',
				'id',
				'isFull',
				'isRemote',
				'location',
				'myStatus',
				'opportunityTitle',
				'orgName',
				'seatsLeft',
				'startTime',
				'title',
			].sort(),
		);
	});
});
