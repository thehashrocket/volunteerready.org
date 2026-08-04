/**
 * `assignVolunteerToShift` — the mutation the volunteer roster exists to enable
 * — plus a backfill for `markAttendance`, which had no coverage at all.
 *
 * Two clusters of regressions are pinned here on purpose:
 *
 *  1. **`allowOverCapacity` waives capacity and NOTHING else.** Every refusal
 *     in `validateSignup` returns early, so waiving capacity by filtering the
 *     returned code — rather than by skipping only those two checks — would
 *     also skip the duplicate and time-conflict rules that sit behind them.
 *     The tests named "does not bypass" are what keep that from regressing.
 *
 *  2. **Reassignment is not free.** The design doc claimed
 *     `@@unique([shiftId, userId])` made this idempotent; it did not, because
 *     `createSignup` only creates and the duplicate check matches CONFIRMED
 *     alone. A CANCELLED row therefore reached the unique index as a 500.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getShiftById: vi.fn(),
	getSignupsByShift: vi.fn(),
	getConfirmedShiftsForUser: vi.fn(),
	getSignupByShiftAndUser: vi.fn(),
	createSignup: vi.fn(),
	updateSignupStatus: vi.fn(),
	writeAuditLogTx: vi.fn(),
	findOrgVolunteerById: vi.fn(),
	findOrgVolunteerBlock: vi.fn(),
	liftOrgVolunteerBlock: vi.fn(),
	listAssignableVolunteers: vi.fn(),
	requireOrgShift: vi.fn(),
	requireAttendanceAccess: vi.fn(),
	checkAndIssueTenureBadges: vi.fn(),
	findMemberByUserAndOrg: vi.fn(),
	shiftUpdate: vi.fn(),
	queryRaw: vi.fn(),
}));

vi.mock('@/server/repositories/shiftRepo', () => ({
	getShiftById: mocks.getShiftById,
}));

vi.mock('@/server/repositories/shiftSignupRepo', () => ({
	getSignupsByShift: mocks.getSignupsByShift,
	getConfirmedShiftsForUser: mocks.getConfirmedShiftsForUser,
	getSignupByShiftAndUser: mocks.getSignupByShiftAndUser,
	createSignup: mocks.createSignup,
	updateSignupStatus: mocks.updateSignupStatus,
	createWaitlistEntry: vi.fn(),
	getWaitlistForShift: vi.fn(),
	getUpcomingSignupsForUser: vi.fn(),
	getUpcomingSignupsForUserIncludingWaitlist: vi.fn(),
}));

vi.mock('@/server/repositories/orgVolunteerRepo', () => ({
	findOrgVolunteerById: mocks.findOrgVolunteerById,
	findOrgVolunteerBlock: mocks.findOrgVolunteerBlock,
	listAssignableVolunteers: mocks.listAssignableVolunteers,
}));

vi.mock('@/server/services/orgVolunteerAccessService', () => ({
	liftOrgVolunteerBlock: mocks.liftOrgVolunteerBlock,
}));

vi.mock('@/server/repositories/auditRepo', () => ({
	writeAuditLogTx: mocks.writeAuditLogTx,
}));

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		$transaction: vi.fn(async (cb: (tx: unknown) => unknown) =>
			cb({
				shift: { update: mocks.shiftUpdate },
				shiftSignup: { findMany: vi.fn() },
				$queryRaw: mocks.queryRaw,
			}),
		),
	},
}));

vi.mock('@/server/repositories/reengagement-repo', () => ({
	findMemberByUserAndOrg: mocks.findMemberByUserAndOrg,
	touchMemberActivity: vi.fn(),
}));
vi.mock('@/server/services/notificationService', () => ({
	tryNotify: vi.fn(),
}));
vi.mock('@/server/services/tenureBadgeService', () => ({
	checkAndIssueTenureBadges: mocks.checkAndIssueTenureBadges,
}));
vi.mock('@/server/services/shiftAccessService', () => ({
	requireOrgShift: mocks.requireOrgShift,
	requireAttendanceAccess: mocks.requireAttendanceAccess,
}));

import type { TRPCError } from '@trpc/server';
import {
	assignVolunteerToShift,
	getAssignableVolunteers,
	markAttendance,
	signUpForShift,
} from '@/server/services/shiftSignupService';

const ORG = 'org-1';
const SHIFT = 'shift-1';
const STAFF = 'staff-1';
const VOLUNTEER_ROW = 'ov-1';
const VOLUNTEER_USER = 'user-9';

function makeShift(overrides: Record<string, unknown> = {}) {
	return {
		id: SHIFT,
		orgId: ORG,
		title: 'Saturday Morning Sort',
		startTime: new Date('2026-08-01T09:00:00Z'),
		endTime: new Date('2026-08-01T12:00:00Z'),
		capacity: 2,
		status: 'OPEN',
		location: 'Warehouse',
		isRemote: false,
		...overrides,
	};
}

function makeRosterRow(overrides: Record<string, unknown> = {}) {
	return {
		id: VOLUNTEER_ROW,
		displayName: 'Maria Garcia',
		userId: VOLUNTEER_USER,
		user: { id: VOLUNTEER_USER, email: 'maria@x.test', accountState: 'ACTIVE' },
		...overrides,
	};
}

function makeSignup(userId: string, status: string, id = `sg-${userId}`) {
	return {
		id,
		shiftId: SHIFT,
		userId,
		status,
		createdAt: new Date('2026-07-01T00:00:00Z'),
	};
}

function assign(overrides: Record<string, unknown> = {}) {
	return assignVolunteerToShift({
		shiftId: SHIFT,
		volunteerId: VOLUNTEER_ROW,
		orgId: ORG,
		actorId: STAFF,
		...overrides,
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.requireOrgShift.mockResolvedValue(makeShift());
	mocks.findOrgVolunteerById.mockResolvedValue(makeRosterRow());
	mocks.findOrgVolunteerBlock.mockResolvedValue(null);
	mocks.getSignupByShiftAndUser.mockResolvedValue(null);
	mocks.getSignupsByShift.mockResolvedValue([]);
	mocks.getConfirmedShiftsForUser.mockResolvedValue([]);
	mocks.createSignup.mockResolvedValue({ id: 'new-signup' });
	mocks.updateSignupStatus.mockResolvedValue({ id: 'revived-signup' });
});

describe('assignVolunteerToShift', () => {
	it('creates a confirmed signup and returns what the toast needs', async () => {
		const result = await assign();

		expect(mocks.createSignup).toHaveBeenCalledWith(expect.anything(), {
			shiftId: SHIFT,
			userId: VOLUNTEER_USER,
		});
		expect(result).toMatchObject({
			signupId: 'new-signup',
			displayName: 'Maria Garcia',
			accountState: 'ACTIVE',
			shiftTitle: 'Saturday Morning Sort',
			overCapacity: false,
		});
	});

	it('SECURITY: refuses to assign a volunteer who has blocked the org', async () => {
		mocks.findOrgVolunteerBlock.mockResolvedValue({ id: 'block-1' });

		// Defence in depth: `addVolunteer` and `ensureAppliedRosterRow` both refuse
		// while a block stands, so a live roster row and a block should not
		// coexist. But this path reads the roster row DIRECTLY rather than through
		// requireOrgVolunteerRelationship, so if that invariant ever breaks this is
		// the call that schedules — and emails — someone who refused the org.
		await expect(assign()).rejects.toMatchObject({ code: 'NOT_FOUND' });

		expect(mocks.createSignup).not.toHaveBeenCalled();
	});

	it('the block refusal is indistinguishable from a roster miss', async () => {
		mocks.findOrgVolunteerBlock.mockResolvedValue({ id: 'block-1' });
		const blockedError = await assign().catch((e: { message: string }) => e);

		mocks.findOrgVolunteerBlock.mockResolvedValue(null);
		mocks.findOrgVolunteerById.mockResolvedValue(null);
		const missingError = await assign().catch((e: { message: string }) => e);

		// Staff learn only that this person is not theirs to schedule — the same
		// answer the sibling guards give, for the same reason.
		expect(blockedError.message).toBe(missingError.message);
	});

	it('audits the STAFF member as actor, not the volunteer', async () => {
		await assign();

		expect(mocks.writeAuditLogTx).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				orgId: ORG,
				actorId: STAFF,
				action: 'shift.volunteer.assigned',
				entityType: 'ShiftSignup',
				metadata: expect.objectContaining({
					shiftId: SHIFT,
					volunteerId: VOLUNTEER_ROW,
					assignedUserId: VOLUNTEER_USER,
					overCapacity: false,
					revivedFrom: null,
				}),
			}),
		);
	});

	it('stamps impersonatedBy only when the caller supplies one', async () => {
		await assign({ impersonatedBy: 'admin-7' });
		expect(mocks.writeAuditLogTx.mock.calls[0][1].metadata).toMatchObject({
			impersonatedBy: 'admin-7',
		});

		mocks.writeAuditLogTx.mockClear();
		await assign({ impersonatedBy: null });
		expect(mocks.writeAuditLogTx.mock.calls[0][1].metadata).not.toHaveProperty(
			'impersonatedBy',
		);
	});

	it('SECURITY: refuses a shift belonging to another org', async () => {
		mocks.requireOrgShift.mockRejectedValue(
			Object.assign(new Error('Shift not found.'), { code: 'NOT_FOUND' }),
		);

		await expect(assign()).rejects.toThrow('Shift not found.');
		expect(mocks.createSignup).not.toHaveBeenCalled();
		expect(mocks.writeAuditLogTx).not.toHaveBeenCalled();
	});

	it('SECURITY: refuses a volunteerId that is not on this org roster', async () => {
		mocks.findOrgVolunteerById.mockResolvedValue(null);

		const err = (await assign().catch((e) => e)) as TRPCError;
		expect(err.code).toBe('NOT_FOUND');
		expect(mocks.createSignup).not.toHaveBeenCalled();
		expect(mocks.writeAuditLogTx).not.toHaveBeenCalled();
	});

	it('SECURITY: takes the user id from the roster row, never from input', async () => {
		mocks.findOrgVolunteerById.mockResolvedValue(
			makeRosterRow({ userId: 'the-real-one' }),
		);

		await assign({ volunteerId: VOLUNTEER_ROW });

		expect(mocks.findOrgVolunteerById).toHaveBeenCalledWith(ORG, VOLUNTEER_ROW);
		expect(mocks.createSignup).toHaveBeenCalledWith(expect.anything(), {
			shiftId: SHIFT,
			userId: 'the-real-one',
		});
	});

	// -- Capacity ------------------------------------------------------------

	it('refuses a full shift without the override', async () => {
		mocks.getSignupsByShift.mockResolvedValue([
			makeSignup('a', 'CONFIRMED'),
			makeSignup('b', 'CONFIRMED'),
		]);

		const err = (await assign().catch((e) => e)) as TRPCError;
		expect(err.code).toBe('CONFLICT');
		expect(mocks.createSignup).not.toHaveBeenCalled();
	});

	it('assigns over capacity with the override, and records that it happened', async () => {
		mocks.getSignupsByShift.mockResolvedValue([
			makeSignup('a', 'CONFIRMED'),
			makeSignup('b', 'CONFIRMED'),
		]);

		const result = await assign({ allowOverCapacity: true });

		expect(result.overCapacity).toBe(true);
		expect(mocks.createSignup).toHaveBeenCalled();
		expect(mocks.writeAuditLogTx.mock.calls[0][1].metadata).toMatchObject({
			overCapacity: true,
		});
	});

	it('waives capacity when the shift row is flagged FULL, too', async () => {
		mocks.requireOrgShift.mockResolvedValue(makeShift({ status: 'FULL' }));

		await expect(assign({ allowOverCapacity: true })).resolves.toBeTruthy();
	});

	it('does not bypass the duplicate check when over capacity is allowed', async () => {
		// A FULL shift plus an existing signup. Waiving capacity must not reach
		// `create`, which would collide on the unique index as a 500.
		mocks.requireOrgShift.mockResolvedValue(makeShift({ status: 'FULL' }));
		mocks.getSignupByShiftAndUser.mockResolvedValue(
			makeSignup(VOLUNTEER_USER, 'CONFIRMED'),
		);

		const err = (await assign({ allowOverCapacity: true }).catch(
			(e) => e,
		)) as TRPCError;
		expect(err.code).toBe('CONFLICT');
		expect(err.message).toBe('They are already assigned to this shift.');
		expect(mocks.createSignup).not.toHaveBeenCalled();
		expect(mocks.updateSignupStatus).not.toHaveBeenCalled();
	});

	it('does not bypass the time-conflict check when over capacity is allowed', async () => {
		mocks.requireOrgShift.mockResolvedValue(makeShift({ status: 'FULL' }));
		mocks.getConfirmedShiftsForUser.mockResolvedValue([
			{
				shift: makeShift({
					id: 'other-shift',
					title: 'Front Desk',
					status: 'OPEN',
				}),
			},
		]);

		const err = (await assign({ allowOverCapacity: true }).catch(
			(e) => e,
		)) as TRPCError;
		expect(err.code).toBe('CONFLICT');
		expect(err.message).toContain('Front Desk');
		expect(mocks.createSignup).not.toHaveBeenCalled();
	});

	it('flags the shift FULL once the assignment fills it', async () => {
		mocks.getSignupsByShift.mockResolvedValue([makeSignup('a', 'CONFIRMED')]);

		await assign();

		expect(mocks.shiftUpdate).toHaveBeenCalledWith({
			where: { id: SHIFT },
			data: { status: 'FULL' },
		});
	});

	// -- Reassignment --------------------------------------------------------

	it('revives a CANCELLED signup instead of creating a second row', async () => {
		mocks.getSignupByShiftAndUser.mockResolvedValue(
			makeSignup(VOLUNTEER_USER, 'CANCELLED'),
		);

		const result = await assign();

		expect(mocks.createSignup).not.toHaveBeenCalled();
		expect(mocks.updateSignupStatus).toHaveBeenCalledWith(
			expect.anything(),
			SHIFT,
			VOLUNTEER_USER,
			'CONFIRMED',
		);
		expect(result.signupId).toBe('revived-signup');
		expect(mocks.writeAuditLogTx.mock.calls[0][1].metadata).toMatchObject({
			revivedFrom: 'CANCELLED',
		});
	});

	it('promotes a WAITLISTED volunteer rather than refusing them', async () => {
		mocks.getSignupByShiftAndUser.mockResolvedValue(
			makeSignup(VOLUNTEER_USER, 'WAITLISTED'),
		);

		await assign();

		expect(mocks.updateSignupStatus).toHaveBeenCalledWith(
			expect.anything(),
			SHIFT,
			VOLUNTEER_USER,
			'CONFIRMED',
		);
	});

	it.each([
		['CONFIRMED', 'They are already assigned to this shift.'],
		['ATTENDED', 'They are already marked attended for this shift.'],
		['NO_SHOW', 'They are already marked a no-show for this shift.'],
	])('refuses a %s signup by name', async (status, message) => {
		mocks.getSignupByShiftAndUser.mockResolvedValue(
			makeSignup(VOLUNTEER_USER, status),
		);

		const err = (await assign().catch((e) => e)) as TRPCError;
		expect(err.code).toBe('CONFLICT');
		expect(err.message).toBe(message);
		expect(mocks.createSignup).not.toHaveBeenCalled();
		expect(mocks.updateSignupStatus).not.toHaveBeenCalled();
	});

	// -- Disclosure ----------------------------------------------------------

	it.each([['CANCELLED'], ['COMPLETED']])(
		'tells staff a %s shift is %s rather than collapsing to NOT_FOUND',
		async (status) => {
			mocks.requireOrgShift.mockResolvedValue(makeShift({ status }));

			const err = (await assign().catch((e) => e)) as TRPCError;
			// The volunteer-facing `mapSignupFailure` collapses these to NOT_FOUND
			// because `shifts.signup` is open to strangers. Staff already own this
			// shift, so the same answer would tell them their own shift is missing.
			expect(err.code).toBe('CONFLICT');
			expect(err.message).toContain(status.toLowerCase());
		},
	);

	// -- Side effects --------------------------------------------------------

	it('records no volunteer-side activity — being scheduled is not participating', async () => {
		await assign();

		expect(mocks.checkAndIssueTenureBadges).not.toHaveBeenCalled();
		expect(mocks.findMemberByUserAndOrg).not.toHaveBeenCalled();
	});

	it('SECURITY: a staff assignment never lifts a block', async () => {
		await assign();

		// Only the volunteer restores their own access. If this path lifted, the
		// org could clear a refusal with a staff-side action, which is precisely
		// the "consent the other party can undo" the block exists to prevent.
		expect(mocks.liftOrgVolunteerBlock).not.toHaveBeenCalled();
	});
});

/**
 * The third volunteer-initiated lift. Self-signup only: `assignVolunteerToShift`
 * is a separate function that refuses a blocked pair outright (above), so this
 * is reachable exclusively by the volunteer acting for themselves.
 */
describe('signUpForShift — lifting an org block', () => {
	beforeEach(() => {
		mocks.getShiftById.mockResolvedValue(makeShift({ capacity: 5 }));
		// Fire-and-forget re-engagement touch, awaited nowhere but `.then`-ed.
		mocks.findMemberByUserAndOrg.mockResolvedValue(null);
	});

	it('lifts any block on the shift org, on the same tx handle as the signup', async () => {
		await signUpForShift(SHIFT, VOLUNTEER_USER);

		// Same handle as createSignup: escaping the tx would clear the block even
		// when the signup that justified it rolls back.
		const tx = mocks.createSignup.mock.calls[0][0];
		expect(mocks.liftOrgVolunteerBlock).toHaveBeenCalledWith(
			tx,
			ORG,
			VOLUNTEER_USER,
		);
	});

	it('scopes the lift to the org that owns the shift', async () => {
		mocks.getShiftById.mockResolvedValue(
			makeShift({ orgId: 'org-other', capacity: 5 }),
		);

		await signUpForShift(SHIFT, VOLUNTEER_USER);

		// Blocks are per (org, user). Signing up with one org must not restore
		// access for another the volunteer is still refusing.
		expect(mocks.liftOrgVolunteerBlock).toHaveBeenCalledWith(
			expect.anything(),
			'org-other',
			VOLUNTEER_USER,
		);
	});

	it('does not reach the lift when the signup itself is refused', async () => {
		mocks.getShiftById.mockResolvedValue(null);

		await expect(signUpForShift(SHIFT, VOLUNTEER_USER)).rejects.toMatchObject({
			code: 'NOT_FOUND',
		});

		expect(mocks.liftOrgVolunteerBlock).not.toHaveBeenCalled();
	});
});

describe('getAssignableVolunteers', () => {
	it('SECURITY: scopes the shift before listing anyone', async () => {
		mocks.listAssignableVolunteers.mockResolvedValue([]);

		await getAssignableVolunteers({ shiftId: SHIFT, orgId: ORG });

		expect(mocks.requireOrgShift).toHaveBeenCalledWith(SHIFT, ORG);
	});

	it('SECURITY: never projects User.id to the client', async () => {
		mocks.listAssignableVolunteers.mockResolvedValue([makeRosterRow()]);

		const rows = await getAssignableVolunteers({ shiftId: SHIFT, orgId: ORG });

		expect(rows).toEqual([
			{
				id: VOLUNTEER_ROW,
				displayName: 'Maria Garcia',
				email: 'maria@x.test',
				accountState: 'ACTIVE',
			},
		]);
		expect(rows[0]).not.toHaveProperty('userId');
	});
});

/**
 * Backfill: `markAttendance` is the mutation `assignVolunteerToShift` feeds, and
 * it had no test file at all despite writing attendance for an arbitrary input
 * userId.
 */
describe('markAttendance', () => {
	beforeEach(() => {
		mocks.requireAttendanceAccess.mockResolvedValue(makeShift());
		mocks.queryRaw.mockResolvedValue([{ id: 'sg-1', status: 'CONFIRMED' }]);
		mocks.updateSignupStatus.mockResolvedValue({ id: 'sg-1' });
	});

	function mark(status: 'ATTENDED' | 'NO_SHOW' = 'ATTENDED') {
		return markAttendance(SHIFT, VOLUNTEER_USER, status, STAFF, {
			by: 'staff',
			orgId: ORG,
		});
	}

	it('SECURITY: authorizes through requireAttendanceAccess before writing', async () => {
		await mark();

		expect(mocks.requireAttendanceAccess).toHaveBeenCalledWith(
			SHIFT,
			VOLUNTEER_USER,
			{ by: 'staff', orgId: ORG },
		);
	});

	it('writes the status and audits the org that owns the shift', async () => {
		const result = await mark();

		expect(mocks.updateSignupStatus).toHaveBeenCalledWith(
			expect.anything(),
			SHIFT,
			VOLUNTEER_USER,
			'ATTENDED',
		);
		expect(result.alreadyCheckedIn).toBe(false);
		expect(mocks.writeAuditLogTx).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				orgId: ORG,
				actorId: STAFF,
				action: 'shift.attendance.attended',
				metadata: expect.objectContaining({ method: 'manual' }),
			}),
		);
	});

	it('is idempotent for a repeat check-in and writes no second audit row', async () => {
		mocks.queryRaw.mockResolvedValue([{ id: 'sg-1', status: 'ATTENDED' }]);

		const result = await mark();

		expect(result.alreadyCheckedIn).toBe(true);
		expect(mocks.updateSignupStatus).not.toHaveBeenCalled();
		expect(mocks.writeAuditLogTx).not.toHaveBeenCalled();
	});

	it('refuses to check in a cancelled signup', async () => {
		mocks.queryRaw.mockResolvedValue([{ id: 'sg-1', status: 'CANCELLED' }]);

		await expect(mark()).rejects.toThrow('signup is CANCELLED');
		expect(mocks.updateSignupStatus).not.toHaveBeenCalled();
	});

	it('throws when there is no signup to mark', async () => {
		mocks.queryRaw.mockResolvedValue([]);

		await expect(mark()).rejects.toThrow('No signup found');
	});
});
