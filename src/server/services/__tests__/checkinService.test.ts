/**
 * Service-level tests for QR check-in features in shiftSignupService.
 *
 * Tests markAttendance with method metadata, idempotent check-in,
 * cancelled-user guard, and getCheckinStats.
 */

const mocks = vi.hoisted(() => ({
	getShiftById: vi.fn(),
	getSignupsByShift: vi.fn(),
	updateSignupStatus: vi.fn(),
	writeAuditLogTx: vi.fn(),
	txQueryRaw: vi.fn(),
}));

vi.mock('@/server/repositories/shiftRepo', () => ({
	getShiftById: mocks.getShiftById,
}));

vi.mock('@/server/repositories/shiftSignupRepo', () => ({
	getSignupsByShift: mocks.getSignupsByShift,
	getSignupByShiftAndUser: vi.fn(),
	getConfirmedShiftsForUser: vi.fn(),
	createSignup: vi.fn(),
	createWaitlistEntry: vi.fn(),
	updateSignupStatus: mocks.updateSignupStatus,
	getUpcomingSignupsForUser: vi.fn(),
	getUpcomingSignupsForUserIncludingWaitlist: vi.fn(),
	getWaitlistForShift: vi.fn(),
}));

vi.mock('@/server/repositories/auditRepo', () => ({
	writeAuditLogTx: mocks.writeAuditLogTx,
}));

vi.mock('@/server/services/notificationService', () => ({
	tryNotify: vi.fn(),
}));

vi.mock('@/server/services/tenureBadgeService', () => ({
	checkAndIssueTenureBadges: vi.fn(),
}));

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		$transaction: vi.fn(async (cb: (tx: unknown) => unknown) => {
			const tx = {
				$queryRaw: mocks.txQueryRaw,
				shiftSignup: { findMany: vi.fn() },
				shift: { update: vi.fn() },
			};
			return cb(tx);
		}),
	},
}));

import { getCheckinStats, markAttendance } from '../shiftSignupService';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ORG_ID = 'org-checkin';
const OTHER_ORG_ID = 'org-attacker';
const SHIFT_ID = 'shift-checkin';
const USER_ID = 'user-vol';
const ACTOR_ID = 'user-staff';

/** A coordinator at the org that owns the shift. */
const STAFF_AUTH = { by: 'staff', orgId: ORG_ID } as const;

function makeShift(overrides: Record<string, unknown> = {}) {
	return {
		id: SHIFT_ID,
		title: 'Morning Shift',
		orgId: ORG_ID,
		startTime: new Date('2026-04-01T09:00:00Z'),
		endTime: new Date('2026-04-01T12:00:00Z'),
		capacity: 10,
		status: 'OPEN',
		location: 'Library',
		isRemote: false,
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// markAttendance — QR check-in
// ---------------------------------------------------------------------------

describe('markAttendance', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getShiftById.mockResolvedValue(makeShift());
		mocks.updateSignupStatus.mockResolvedValue({
			id: 'signup-1',
			shiftId: SHIFT_ID,
			userId: USER_ID,
			status: 'ATTENDED',
		});
	});

	it('marks ATTENDED with method:qr and writes audit log', async () => {
		mocks.txQueryRaw.mockResolvedValue([
			{ id: 'signup-1', status: 'CONFIRMED' },
		]);

		const result = await markAttendance(
			SHIFT_ID,
			USER_ID,
			'ATTENDED',
			ACTOR_ID,
			STAFF_AUTH,
			'qr',
		);

		expect(result.alreadyCheckedIn).toBe(false);
		expect(mocks.updateSignupStatus).toHaveBeenCalledWith(
			expect.anything(),
			SHIFT_ID,
			USER_ID,
			'ATTENDED',
		);
		expect(mocks.writeAuditLogTx).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				action: 'shift.attendance.attended',
				metadata: expect.objectContaining({ method: 'qr' }),
			}),
		);
	});

	it('marks ATTENDED with method:geo', async () => {
		mocks.txQueryRaw.mockResolvedValue([
			{ id: 'signup-1', status: 'CONFIRMED' },
		]);

		await markAttendance(
			SHIFT_ID,
			USER_ID,
			'ATTENDED',
			ACTOR_ID,
			{ by: 'self', userId: USER_ID },
			'geo',
		);

		expect(mocks.writeAuditLogTx).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				metadata: expect.objectContaining({ method: 'geo' }),
			}),
		);
	});

	it('defaults method to manual when not specified', async () => {
		mocks.txQueryRaw.mockResolvedValue([
			{ id: 'signup-1', status: 'CONFIRMED' },
		]);

		await markAttendance(SHIFT_ID, USER_ID, 'ATTENDED', ACTOR_ID, STAFF_AUTH);

		expect(mocks.writeAuditLogTx).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				metadata: expect.objectContaining({ method: 'manual' }),
			}),
		);
	});

	it('returns alreadyCheckedIn:true for idempotent ATTENDED', async () => {
		mocks.txQueryRaw.mockResolvedValue([
			{ id: 'signup-1', status: 'ATTENDED' },
		]);

		const result = await markAttendance(
			SHIFT_ID,
			USER_ID,
			'ATTENDED',
			ACTOR_ID,
			STAFF_AUTH,
			'qr',
		);

		expect(result.alreadyCheckedIn).toBe(true);
		// Should NOT write a duplicate audit log
		expect(mocks.writeAuditLogTx).not.toHaveBeenCalled();
		// Should NOT call updateSignupStatus
		expect(mocks.updateSignupStatus).not.toHaveBeenCalled();
	});

	it('rejects check-in for CANCELLED signup', async () => {
		mocks.txQueryRaw.mockResolvedValue([
			{ id: 'signup-1', status: 'CANCELLED' },
		]);

		await expect(
			markAttendance(SHIFT_ID, USER_ID, 'ATTENDED', ACTOR_ID, STAFF_AUTH, 'qr'),
		).rejects.toThrow('Cannot mark attendance: signup is CANCELLED');
	});

	it('rejects check-in for WAITLISTED signup', async () => {
		mocks.txQueryRaw.mockResolvedValue([
			{ id: 'signup-1', status: 'WAITLISTED' },
		]);

		await expect(
			markAttendance(SHIFT_ID, USER_ID, 'ATTENDED', ACTOR_ID, STAFF_AUTH, 'qr'),
		).rejects.toThrow('Cannot mark attendance: signup is WAITLISTED');
	});

	it('allows NO_SHOW for any signup status', async () => {
		mocks.txQueryRaw.mockResolvedValue([
			{ id: 'signup-1', status: 'CONFIRMED' },
		]);

		const result = await markAttendance(
			SHIFT_ID,
			USER_ID,
			'NO_SHOW',
			ACTOR_ID,
			STAFF_AUTH,
		);

		expect(result.alreadyCheckedIn).toBe(false);
		expect(mocks.writeAuditLogTx).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				action: 'shift.attendance.no_show',
			}),
		);
	});

	it('throws when no signup exists', async () => {
		mocks.txQueryRaw.mockResolvedValue([]);

		await expect(
			markAttendance(SHIFT_ID, USER_ID, 'ATTENDED', ACTOR_ID, STAFF_AUTH),
		).rejects.toThrow('No signup found for this shift');
	});

	it('throws when shift not found', async () => {
		mocks.getShiftById.mockResolvedValue(null);

		await expect(
			markAttendance(SHIFT_ID, USER_ID, 'ATTENDED', ACTOR_ID, STAFF_AUTH),
		).rejects.toThrow('Shift not found');
	});

	// -------------------------------------------------------------------------
	// SECURITY: cross-tenant attendance writes
	// -------------------------------------------------------------------------

	it('SECURITY: staff at another org cannot write attendance', async () => {
		mocks.txQueryRaw.mockResolvedValue([
			{ id: 'signup-1', status: 'CONFIRMED' },
		]);

		await expect(
			markAttendance(SHIFT_ID, USER_ID, 'ATTENDED', ACTOR_ID, {
				by: 'staff',
				orgId: OTHER_ORG_ID,
			}),
		).rejects.toThrow('Shift not found');

		// The write must not happen, and no audit row may be filed against the
		// victim org.
		expect(mocks.updateSignupStatus).not.toHaveBeenCalled();
		expect(mocks.writeAuditLogTx).not.toHaveBeenCalled();
	});

	it('SECURITY: a foreign shift is indistinguishable from a missing one', async () => {
		// Same message for "exists elsewhere" and "does not exist", so an attacker
		// enumerating ids learns nothing about which shifts are real.
		mocks.getShiftById.mockResolvedValue(null);
		const missing = await markAttendance(
			SHIFT_ID,
			USER_ID,
			'ATTENDED',
			ACTOR_ID,
			STAFF_AUTH,
		).catch((e: Error) => e.message);

		mocks.getShiftById.mockResolvedValue(makeShift());
		const foreign = await markAttendance(
			SHIFT_ID,
			USER_ID,
			'ATTENDED',
			ACTOR_ID,
			{
				by: 'staff',
				orgId: OTHER_ORG_ID,
			},
		).catch((e: Error) => e.message);

		expect(foreign).toBe(missing);
	});

	it('SECURITY: a volunteer cannot self-check-in someone else', async () => {
		mocks.txQueryRaw.mockResolvedValue([
			{ id: 'signup-1', status: 'CONFIRMED' },
		]);

		await expect(
			markAttendance(SHIFT_ID, USER_ID, 'ATTENDED', 'user-other', {
				by: 'self',
				userId: 'user-other',
			}),
		).rejects.toThrow('You can only check yourself in.');

		expect(mocks.updateSignupStatus).not.toHaveBeenCalled();
	});

	it('self check-in succeeds for the volunteer themselves, with no org check', async () => {
		mocks.txQueryRaw.mockResolvedValue([
			{ id: 'signup-1', status: 'CONFIRMED' },
		]);

		const result = await markAttendance(
			SHIFT_ID,
			USER_ID,
			'ATTENDED',
			USER_ID,
			{ by: 'self', userId: USER_ID },
			'geo',
		);

		expect(result.alreadyCheckedIn).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// getCheckinStats
// ---------------------------------------------------------------------------

describe('getCheckinStats', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns correct counts for mixed statuses', async () => {
		mocks.getSignupsByShift.mockResolvedValue([
			{ status: 'ATTENDED' },
			{ status: 'ATTENDED' },
			{ status: 'CONFIRMED' },
			{ status: 'CONFIRMED' },
			{ status: 'CANCELLED' },
			{ status: 'NO_SHOW' },
		]);

		const stats = await getCheckinStats(SHIFT_ID);

		// attended=2, confirmed+attended=4 (total), cancelled/no-show excluded from total
		expect(stats.attended).toBe(2);
		expect(stats.total).toBe(4); // 2 ATTENDED + 2 CONFIRMED
		expect(stats.rate).toBe(50);
	});

	it('returns zero rate when no signups', async () => {
		mocks.getSignupsByShift.mockResolvedValue([]);

		const stats = await getCheckinStats(SHIFT_ID);

		expect(stats.attended).toBe(0);
		expect(stats.total).toBe(0);
		expect(stats.rate).toBe(0);
	});

	it('returns 100% when all confirmed are attended', async () => {
		mocks.getSignupsByShift.mockResolvedValue([
			{ status: 'ATTENDED' },
			{ status: 'ATTENDED' },
			{ status: 'ATTENDED' },
		]);

		const stats = await getCheckinStats(SHIFT_ID);

		expect(stats.attended).toBe(3);
		expect(stats.total).toBe(3);
		expect(stats.rate).toBe(100);
	});
});
