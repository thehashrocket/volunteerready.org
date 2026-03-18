/**
 * Service-level tests for waitlist features in shiftSignupService.
 *
 * Tests the auto-promote-from-waitlist flow, joinWaitlist, and leaveWaitlist.
 * Domain validation logic is tested in shift-templates-waitlist.test.ts;
 * these tests verify Prisma wiring, audit logging, and notification dispatch.
 */

const mocks = vi.hoisted(() => ({
	getShiftById: vi.fn(),
	getSignupsByShift: vi.fn(),
	getSignupByShiftAndUser: vi.fn(),
	getConfirmedShiftsForUser: vi.fn(),
	createWaitlistEntry: vi.fn(),
	updateSignupStatus: vi.fn(),
	writeAuditLogTx: vi.fn(),
	tryNotify: vi.fn(),
	shiftSignupFindMany: vi.fn(),
	shiftUpdate: vi.fn(),
}));

vi.mock('@/server/repositories/shiftRepo', () => ({
	getShiftById: mocks.getShiftById,
}));

vi.mock('@/server/repositories/shiftSignupRepo', () => ({
	getSignupsByShift: mocks.getSignupsByShift,
	getSignupByShiftAndUser: mocks.getSignupByShiftAndUser,
	getConfirmedShiftsForUser: mocks.getConfirmedShiftsForUser,
	createSignup: vi.fn(),
	createWaitlistEntry: mocks.createWaitlistEntry,
	updateSignupStatus: mocks.updateSignupStatus,
	getUpcomingSignupsForUser: vi.fn(),
	getUpcomingSignupsForUserIncludingWaitlist: vi.fn(),
	getWaitlistForShift: vi.fn(),
	deleteSignup: vi.fn(),
}));

vi.mock('@/server/repositories/auditRepo', () => ({
	writeAuditLogTx: mocks.writeAuditLogTx,
}));

vi.mock('@/server/services/notificationService', () => ({
	tryNotify: mocks.tryNotify,
}));

vi.mock('@/server/services/tenureBadgeService', () => ({
	checkAndIssueTenureBadges: vi.fn(),
}));

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		$transaction: vi.fn(async (cb: (tx: unknown) => unknown) => {
			const tx = {
				shiftSignup: { findMany: mocks.shiftSignupFindMany },
				shift: { update: mocks.shiftUpdate },
			};
			return cb(tx);
		}),
	},
}));

import {
	cancelSignup,
	joinWaitlist,
	leaveWaitlist,
} from '../shiftSignupService';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ORG_ID = 'org-1';
const SHIFT_ID = 'shift-1';
const USER_A = 'user-a';
const USER_B = 'user-b';
const USER_C = 'user-c';

function makeShift(overrides: Record<string, unknown> = {}) {
	return {
		id: SHIFT_ID,
		title: 'Morning Shift',
		orgId: ORG_ID,
		startTime: new Date('2026-04-01T09:00:00Z'),
		endTime: new Date('2026-04-01T12:00:00Z'),
		capacity: 2,
		status: 'FULL',
		location: 'Library',
		isRemote: false,
		...overrides,
	};
}

function makeSignup(
	userId: string,
	status: string,
	createdAt = new Date(),
	id?: string,
) {
	return {
		id: id ?? `signup-${userId}`,
		shiftId: SHIFT_ID,
		userId,
		status,
		createdAt,
	};
}

// ---------------------------------------------------------------------------
// cancelSignup — auto-promote from waitlist
// ---------------------------------------------------------------------------

describe('cancelSignup', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getShiftById.mockResolvedValue(makeShift());
		mocks.updateSignupStatus.mockResolvedValue({ id: 'updated' });
	});

	it('promotes the earliest waitlisted volunteer when a confirmed user cancels', async () => {
		const signupA = makeSignup(USER_A, 'CONFIRMED');
		mocks.getSignupByShiftAndUser.mockResolvedValue(signupA);

		// After cancellation, transaction fetches all signups
		const waitlisted1 = makeSignup(
			USER_B,
			'WAITLISTED',
			new Date('2026-03-20T10:00:00Z'),
		);
		const waitlisted2 = makeSignup(
			USER_C,
			'WAITLISTED',
			new Date('2026-03-20T11:00:00Z'),
		);
		mocks.shiftSignupFindMany.mockResolvedValue([
			makeSignup(USER_A, 'CANCELLED'),
			waitlisted1,
			waitlisted2,
		]);

		await cancelSignup(SHIFT_ID, USER_A);

		// First call: cancel USER_A
		expect(mocks.updateSignupStatus).toHaveBeenCalledWith(
			expect.anything(),
			SHIFT_ID,
			USER_A,
			'CANCELLED',
		);
		// Second call: promote USER_B (earliest waitlisted)
		expect(mocks.updateSignupStatus).toHaveBeenCalledWith(
			expect.anything(),
			SHIFT_ID,
			USER_B,
			'CONFIRMED',
		);
		expect(mocks.updateSignupStatus).toHaveBeenCalledTimes(2);

		// Audit log for promotion
		expect(mocks.writeAuditLogTx).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				action: 'shift.waitlist.promoted',
				metadata: expect.objectContaining({ promotedUserId: USER_B }),
			}),
		);

		// Notification sent to promoted user
		expect(mocks.tryNotify).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: USER_B,
				type: 'WAITLIST_PROMOTED',
			}),
		);
	});

	it('re-opens shift to OPEN when no waitlisted volunteers exist', async () => {
		mocks.getSignupByShiftAndUser.mockResolvedValue(
			makeSignup(USER_A, 'CONFIRMED'),
		);
		mocks.shiftSignupFindMany.mockResolvedValue([
			makeSignup(USER_A, 'CANCELLED'),
		]);

		await cancelSignup(SHIFT_ID, USER_A);

		expect(mocks.shiftUpdate).toHaveBeenCalledWith({
			where: { id: SHIFT_ID },
			data: { status: 'OPEN' },
		});
		expect(mocks.tryNotify).not.toHaveBeenCalled();
	});

	it('does NOT auto-promote when a waitlisted user cancels', async () => {
		mocks.getSignupByShiftAndUser.mockResolvedValue(
			makeSignup(USER_B, 'WAITLISTED'),
		);

		await cancelSignup(SHIFT_ID, USER_B);

		// Only one updateSignupStatus call (the cancel itself)
		expect(mocks.updateSignupStatus).toHaveBeenCalledTimes(1);
		expect(mocks.shiftSignupFindMany).not.toHaveBeenCalled();
		expect(mocks.tryNotify).not.toHaveBeenCalled();
	});

	it('throws when no active signup exists', async () => {
		mocks.getSignupByShiftAndUser.mockResolvedValue(null);

		await expect(cancelSignup(SHIFT_ID, USER_A)).rejects.toThrow(
			'No active signup found',
		);
	});
});

// ---------------------------------------------------------------------------
// joinWaitlist
// ---------------------------------------------------------------------------

describe('joinWaitlist', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getShiftById.mockResolvedValue(makeShift({ status: 'FULL' }));
		mocks.createWaitlistEntry.mockResolvedValue({
			id: 'waitlist-entry-1',
			shiftId: SHIFT_ID,
			userId: USER_B,
			status: 'WAITLISTED',
		});
	});

	it('creates a WAITLISTED entry and audit log for a full shift', async () => {
		mocks.getSignupsByShift.mockResolvedValue([
			makeSignup(USER_A, 'CONFIRMED'),
			makeSignup(USER_C, 'CONFIRMED'),
		]);

		const result = await joinWaitlist(SHIFT_ID, USER_B);

		expect(result.status).toBe('WAITLISTED');
		expect(mocks.createWaitlistEntry).toHaveBeenCalledWith(expect.anything(), {
			shiftId: SHIFT_ID,
			userId: USER_B,
		});
		expect(mocks.writeAuditLogTx).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				action: 'shift.waitlist.joined',
			}),
		);
	});

	it('rejects when shift has open spots', async () => {
		mocks.getShiftById.mockResolvedValue(makeShift({ status: 'OPEN' }));
		mocks.getSignupsByShift.mockResolvedValue([
			makeSignup(USER_A, 'CONFIRMED'),
		]);

		await expect(joinWaitlist(SHIFT_ID, USER_B)).rejects.toThrow();
	});

	it('throws when shift does not exist', async () => {
		mocks.getShiftById.mockResolvedValue(null);

		await expect(joinWaitlist(SHIFT_ID, USER_B)).rejects.toThrow(
			'Shift not found',
		);
	});
});

// ---------------------------------------------------------------------------
// leaveWaitlist
// ---------------------------------------------------------------------------

describe('leaveWaitlist', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getShiftById.mockResolvedValue(makeShift());
		mocks.updateSignupStatus.mockResolvedValue({ id: 'updated' });
	});

	it('cancels a WAITLISTED signup and writes audit log', async () => {
		mocks.getSignupByShiftAndUser.mockResolvedValue(
			makeSignup(USER_B, 'WAITLISTED'),
		);

		await leaveWaitlist(SHIFT_ID, USER_B);

		expect(mocks.updateSignupStatus).toHaveBeenCalledWith(
			expect.anything(),
			SHIFT_ID,
			USER_B,
			'CANCELLED',
		);
		expect(mocks.writeAuditLogTx).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				action: 'shift.waitlist.left',
			}),
		);
	});

	it('throws when user is not on the waitlist', async () => {
		mocks.getSignupByShiftAndUser.mockResolvedValue(
			makeSignup(USER_B, 'CONFIRMED'),
		);

		await expect(leaveWaitlist(SHIFT_ID, USER_B)).rejects.toThrow(
			'not on the waitlist',
		);
	});

	it('throws when no signup exists', async () => {
		mocks.getSignupByShiftAndUser.mockResolvedValue(null);

		await expect(leaveWaitlist(SHIFT_ID, USER_B)).rejects.toThrow(
			'not on the waitlist',
		);
	});
});
