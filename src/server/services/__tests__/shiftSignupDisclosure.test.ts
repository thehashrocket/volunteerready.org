/**
 * SECURITY tests for what a signup refusal discloses.
 *
 * `shifts.signup` and `joinWaitlist` are open to ANY authenticated user — no
 * org relationship is required (see mapSignupFailure in shiftSignupService.ts).
 * There is therefore no caller-identity axis to authorize on, and the error
 * mapping is the only control: it must not let a caller enumerating shift ids
 * separate "this is real and staff cancelled it" from "this does not exist".
 *
 * These also pin the flip side. Over-collapsing would be its own regression —
 * capacity and caller-self facts stay specific, because neither reveals an org
 * decision and both are needed for a usable flow.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getShiftById: vi.fn(),
	getSignupsByShift: vi.fn(),
	getConfirmedShiftsForUser: vi.fn(),
	getSignupByShiftAndUser: vi.fn(),
	createSignup: vi.fn(),
	createWaitlistEntry: vi.fn(),
	updateSignupStatus: vi.fn(),
	writeAuditLogTx: vi.fn(),
}));

vi.mock('@/server/repositories/shiftRepo', () => ({
	getShiftById: mocks.getShiftById,
}));

vi.mock('@/server/repositories/shiftSignupRepo', () => ({
	getSignupsByShift: mocks.getSignupsByShift,
	getConfirmedShiftsForUser: mocks.getConfirmedShiftsForUser,
	getSignupByShiftAndUser: mocks.getSignupByShiftAndUser,
	createSignup: mocks.createSignup,
	createWaitlistEntry: mocks.createWaitlistEntry,
	updateSignupStatus: mocks.updateSignupStatus,
	getWaitlistForShift: vi.fn(),
	getUpcomingSignupsForUser: vi.fn(),
	getUpcomingSignupsForUserIncludingWaitlist: vi.fn(),
}));

vi.mock('@/server/repositories/auditRepo', () => ({
	writeAuditLogTx: mocks.writeAuditLogTx,
}));

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		$transaction: vi.fn(async (cb: (tx: unknown) => unknown) =>
			cb({ shift: { update: vi.fn() }, shiftSignup: { findMany: vi.fn() } }),
		),
	},
}));

vi.mock('@/server/repositories/reengagement-repo', () => ({
	findMemberByUserAndOrg: vi.fn().mockResolvedValue(null),
	touchMemberActivity: vi.fn(),
}));
vi.mock('@/server/services/notificationService', () => ({
	tryNotify: vi.fn(),
}));
vi.mock('@/server/services/tenureBadgeService', () => ({
	checkAndIssueTenureBadges: vi.fn(),
}));
vi.mock('@/server/services/shiftAccessService', () => ({
	requireOrgShift: vi.fn(),
	requireAttendanceAccess: vi.fn(),
}));

import type { TRPCError } from '@trpc/server';
import {
	cancelSignup,
	joinWaitlist,
	leaveWaitlist,
	signUpForShift,
} from '../shiftSignupService';

const SHIFT_ID = 'shift-1';
const USER_ID = 'user-vol';

function makeShift(overrides: Record<string, unknown> = {}) {
	return {
		id: SHIFT_ID,
		orgId: 'org-1',
		title: 'Morning Shift',
		startTime: new Date('2026-09-01T09:00:00Z'),
		endTime: new Date('2026-09-01T12:00:00Z'),
		capacity: 5,
		status: 'OPEN',
		location: null,
		isRemote: false,
		...overrides,
	};
}

/** Resolve the TRPCError a call rejects with, failing if it resolves instead. */
async function captureError(promise: Promise<unknown>): Promise<TRPCError> {
	try {
		await promise;
	} catch (err) {
		return err as TRPCError;
	}
	throw new Error('Expected the call to reject, but it resolved.');
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.getSignupsByShift.mockResolvedValue([]);
	mocks.getConfirmedShiftsForUser.mockResolvedValue([]);
});

describe('signUpForShift — administrative facts are collapsed', () => {
	it('SECURITY: a CANCELLED shift is indistinguishable from a missing one', async () => {
		mocks.getShiftById.mockResolvedValue(null);
		const missing = await captureError(signUpForShift(SHIFT_ID, USER_ID));

		mocks.getShiftById.mockResolvedValue(makeShift({ status: 'CANCELLED' }));
		const cancelled = await captureError(signUpForShift(SHIFT_ID, USER_ID));

		expect(cancelled.code).toBe(missing.code);
		expect(cancelled.message).toBe(missing.message);
		expect(cancelled.code).toBe('NOT_FOUND');
	});

	it('SECURITY: a COMPLETED shift is indistinguishable from a missing one', async () => {
		mocks.getShiftById.mockResolvedValue(null);
		const missing = await captureError(signUpForShift(SHIFT_ID, USER_ID));

		mocks.getShiftById.mockResolvedValue(makeShift({ status: 'COMPLETED' }));
		const completed = await captureError(signUpForShift(SHIFT_ID, USER_ID));

		expect(completed.code).toBe(missing.code);
		expect(completed.message).toBe(missing.message);
	});

	it('SECURITY: never writes a signup row when it refuses', async () => {
		mocks.getShiftById.mockResolvedValue(makeShift({ status: 'CANCELLED' }));

		await captureError(signUpForShift(SHIFT_ID, USER_ID));

		expect(mocks.createSignup).not.toHaveBeenCalled();
		expect(mocks.writeAuditLogTx).not.toHaveBeenCalled();
	});
});

describe('signUpForShift — contention and caller-self facts stay specific', () => {
	it('reports a full shift as CONFLICT, not the collapsed NOT_FOUND', async () => {
		mocks.getShiftById.mockResolvedValue(makeShift({ status: 'FULL' }));

		const err = await captureError(signUpForShift(SHIFT_ID, USER_ID));

		expect(err.code).toBe('CONFLICT');
		expect(err.message).toBe('This shift is full.');
	});

	it('reports the caller’s own duplicate signup specifically', async () => {
		mocks.getShiftById.mockResolvedValue(makeShift());
		mocks.getSignupsByShift.mockResolvedValue([
			{
				id: 's1',
				shiftId: SHIFT_ID,
				userId: USER_ID,
				status: 'CONFIRMED',
				createdAt: new Date(),
			},
		]);

		const err = await captureError(signUpForShift(SHIFT_ID, USER_ID));

		expect(err.code).toBe('CONFLICT');
		expect(err.message).toContain('already signed up');
	});

	it('SECURITY: a full shift and a cancelled shift do NOT look alike', async () => {
		// Guards the opposite regression: collapsing everything would be safe but
		// unusable, and would silently break the future self-serve flow.
		mocks.getShiftById.mockResolvedValue(makeShift({ status: 'FULL' }));
		const full = await captureError(signUpForShift(SHIFT_ID, USER_ID));

		mocks.getShiftById.mockResolvedValue(makeShift({ status: 'CANCELLED' }));
		const cancelled = await captureError(signUpForShift(SHIFT_ID, USER_ID));

		expect(full.code).not.toBe(cancelled.code);
	});

	it('never throws a bare Error — every failure carries a 4xx code', async () => {
		// These paths used to `throw new Error(...)`, surfacing as 500s.
		mocks.getShiftById.mockResolvedValue(null);

		const err = await captureError(signUpForShift(SHIFT_ID, USER_ID));

		expect(err.code).toBeDefined();
		expect(err.code).not.toBe('INTERNAL_SERVER_ERROR');
	});
});

describe('joinWaitlist', () => {
	it('SECURITY: collapses a cancelled shift into the missing-shift error', async () => {
		mocks.getShiftById.mockResolvedValue(null);
		const missing = await captureError(joinWaitlist(SHIFT_ID, USER_ID));

		mocks.getShiftById.mockResolvedValue(makeShift({ status: 'CANCELLED' }));
		const cancelled = await captureError(joinWaitlist(SHIFT_ID, USER_ID));

		expect(cancelled.code).toBe(missing.code);
		expect(cancelled.message).toBe(missing.message);
	});
});

describe('cancelSignup / leaveWaitlist — own-row check runs first', () => {
	// Each of these asserts the property TWICE, deliberately.
	//
	// The output comparison is the real invariant: a caller with no signup gets
	// a byte-identical error whether or not the shift exists. It survives any
	// refactor that preserves behaviour.
	//
	// The call-count assertion is narrower and more brittle — it would fail if
	// someone merged the two lookups into one query — but it pins the reason
	// the property holds STRUCTURALLY rather than by the two messages happening
	// to match today. That is the house idiom for this bug class (see the
	// getCheckinToken cases in routers/shifts.access.test.ts). Keep both: if
	// the second one starts failing on a legitimate refactor, delete it and
	// keep the first.

	it('SECURITY: cancelSignup does not reveal whether an unrelated shift exists', async () => {
		mocks.getSignupByShiftAndUser.mockResolvedValue(null);
		mocks.getShiftById.mockResolvedValue(null);
		const shiftMissing = await captureError(cancelSignup(SHIFT_ID, USER_ID));

		vi.clearAllMocks();
		mocks.getSignupByShiftAndUser.mockResolvedValue(null);
		mocks.getShiftById.mockResolvedValue(makeShift());
		const shiftReal = await captureError(cancelSignup(SHIFT_ID, USER_ID));

		expect(shiftReal.code).toBe(shiftMissing.code);
		expect(shiftReal.message).toBe(shiftMissing.message);
		expect(shiftReal.code).toBe('NOT_FOUND');
		expect(mocks.getShiftById).not.toHaveBeenCalled();
	});

	it('SECURITY: leaveWaitlist does not reveal whether an unrelated shift exists', async () => {
		mocks.getSignupByShiftAndUser.mockResolvedValue(null);
		mocks.getShiftById.mockResolvedValue(null);
		const shiftMissing = await captureError(leaveWaitlist(SHIFT_ID, USER_ID));

		vi.clearAllMocks();
		mocks.getSignupByShiftAndUser.mockResolvedValue(null);
		mocks.getShiftById.mockResolvedValue(makeShift());
		const shiftReal = await captureError(leaveWaitlist(SHIFT_ID, USER_ID));

		expect(shiftReal.code).toBe(shiftMissing.code);
		expect(shiftReal.message).toBe(shiftMissing.message);
		expect(shiftReal.code).toBe('NOT_FOUND');
		expect(mocks.getShiftById).not.toHaveBeenCalled();
	});

	it('SECURITY: a CONFIRMED signup cannot be removed through the waitlist path', async () => {
		mocks.getSignupByShiftAndUser.mockResolvedValue({
			id: 's1',
			status: 'CONFIRMED',
		});

		const err = await captureError(leaveWaitlist(SHIFT_ID, USER_ID));

		expect(err.code).toBe('NOT_FOUND');
		expect(mocks.updateSignupStatus).not.toHaveBeenCalled();
	});
});
