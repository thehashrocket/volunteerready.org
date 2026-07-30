/**
 * Router-level tests for the org scoping of every shift procedure.
 *
 * The service tests in `services/__tests__/shiftOrgScoping.test.ts` prove each
 * service refuses an `orgId` it is handed that does not own the shift. Nothing
 * proved the ROUTER hands it the right one — and that is the whole bug class
 * this fix belongs to. Every one of these procedures takes a shift id from
 * client input; if `orgId` were ever sourced from input too, or from a stale
 * session field rather than the server-resolved `ctx`, the service guard would
 * faithfully authorize against an org the caller chose.
 *
 * Mirrors profile.access.test.ts / credentials.access.test.ts, written for the
 * sibling `requireOrgVolunteerRelationship` fix for exactly this reason.
 *
 * The `markAttendance` cases carry the most weight. `AttendanceAuthorization`
 * exists so a caller must state WHICH authorization model applies, and the two
 * staff callsites must declare `{by:'staff'}`. An edit to `{by:'self'}` there
 * would silently reopen the cross-tenant attendance write on a staffProcedure
 * while every service test kept passing.
 */
import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getShiftDetail: vi.fn(),
	listOrgShifts: vi.fn(),
	updateExistingShift: vi.fn(),
	cancelShift: vi.fn(),
	completeShift: vi.fn(),
	removeShift: vi.fn(),
	createNewShift: vi.fn(),
	getShiftSignups: vi.fn(),
	getShiftWaitlist: vi.fn(),
	markAttendance: vi.fn(),
	getCheckinStats: vi.fn(),
	requireOrgShift: vi.fn(),
	requireOwnSignup: vi.fn(),
	generateCheckinTokenFromEnv: vi.fn(),
	getShiftById: vi.fn(),
	validateCheckinTokenFromEnv: vi.fn(),
	assignVolunteerToShift: vi.fn(),
	getAssignableVolunteers: vi.fn(),
	isFeatureEnabled: vi.fn(),
}));

vi.mock('@/server/services/featureFlagService', async () => {
	const { STAFF_CREATED_VOLUNTEERS_FLAG } = await import(
		'@/server/domain/feature-flags'
	);
	return {
		isFeatureEnabled: mocks.isFeatureEnabled,
		// A thin wrapper over isFeatureEnabled in the real module. Delegating
		// rather than mocking it outright keeps the flag-KEY assertions below
		// meaningful — otherwise they would only prove some helper was called.
		isRosterEnabledForOrg: (orgId: string) =>
			mocks.isFeatureEnabled(orgId, STAFF_CREATED_VOLUNTEERS_FLAG),
	};
});

// orgProcedure does one indexed lookup per call to enforce org suspension
// (init.ts:279). Return an unsuspended org so the guard passes.
vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		organization: {
			findUnique: vi.fn().mockResolvedValue({ suspendedAt: null }),
		},
	},
}));
vi.mock('@/server/auth', () => ({ authOptions: {} }));

vi.mock('@/server/services/shiftService', () => ({
	getShiftDetail: mocks.getShiftDetail,
	listOrgShifts: mocks.listOrgShifts,
	updateExistingShift: mocks.updateExistingShift,
	cancelShift: mocks.cancelShift,
	completeShift: mocks.completeShift,
	removeShift: mocks.removeShift,
	createNewShift: mocks.createNewShift,
}));

vi.mock('@/server/services/shiftSignupService', () => ({
	getShiftSignups: mocks.getShiftSignups,
	getShiftWaitlist: mocks.getShiftWaitlist,
	markAttendance: mocks.markAttendance,
	getCheckinStats: mocks.getCheckinStats,
	cancelSignup: vi.fn(),
	getMyCheckinStatus: vi.fn(),
	getMyUpcomingShifts: vi.fn(),
	getMyUpcomingShiftsWithWaitlist: vi.fn(),
	joinWaitlist: vi.fn(),
	leaveWaitlist: vi.fn(),
	signUpForShift: vi.fn(),
	assignVolunteerToShift: mocks.assignVolunteerToShift,
	getAssignableVolunteers: mocks.getAssignableVolunteers,
}));

vi.mock('@/server/services/shiftAccessService', () => ({
	requireOrgShift: mocks.requireOrgShift,
	requireOwnSignup: mocks.requireOwnSignup,
}));

vi.mock('@/server/repositories/shiftRepo', () => ({
	getShiftById: mocks.getShiftById,
}));

vi.mock('@/server/lib/checkin-token', () => ({
	generateCheckinTokenFromEnv: mocks.generateCheckinTokenFromEnv,
	validateCheckinTokenFromEnv: mocks.validateCheckinTokenFromEnv,
}));

vi.mock('@/server/trpc/rate-limit-middleware', () => ({
	rateLimitByOrg: () => (opts: { next: () => unknown }) => opts.next(),
	rateLimitByUser: () => (opts: { next: () => unknown }) => opts.next(),
}));

import { t } from '@/server/trpc/init';
import { shiftsRouter } from './shifts';

const callerFactory = t.createCallerFactory(shiftsRouter);
const CTX_ORG_ID = 'org-from-context';
const ACTOR_ID = 'user-actor';
const SHIFT_ID = 'shift-target';

function caller() {
	return callerFactory({
		session: { user: { id: ACTOR_ID } },
		realSession: null,
		realUserId: ACTOR_ID,
		impersonation: null,
		orgId: CTX_ORG_ID,
		role: 'STAFF',
		companyId: null,
		companyRole: null,
		prisma: {} as never,
		sessionToken: null,
		ip: null,
	} as Parameters<typeof callerFactory>[0]);
}

beforeEach(() => {
	vi.resetAllMocks();
	mocks.getShiftDetail.mockResolvedValue({ id: SHIFT_ID });
	mocks.getShiftSignups.mockResolvedValue([]);
	mocks.getShiftWaitlist.mockResolvedValue([]);
	mocks.markAttendance.mockResolvedValue({ alreadyCheckedIn: false });
	mocks.completeShift.mockResolvedValue({ id: SHIFT_ID });
	mocks.getCheckinStats.mockResolvedValue({ attended: 0, total: 0, rate: 0 });
	mocks.requireOrgShift.mockResolvedValue({ id: SHIFT_ID, status: 'OPEN' });
	mocks.validateCheckinTokenFromEnv.mockReturnValue(true);
	mocks.isFeatureEnabled.mockResolvedValue(true);
	mocks.getAssignableVolunteers.mockResolvedValue([]);
	mocks.assignVolunteerToShift.mockResolvedValue({ signupId: 'sg-1' });
});

describe('reads are scoped to ctx.orgId', () => {
	it('SECURITY: getById passes ctx.orgId', async () => {
		await caller().getById({ id: SHIFT_ID });

		expect(mocks.getShiftDetail).toHaveBeenCalledWith(SHIFT_ID, CTX_ORG_ID);
	});

	it('SECURITY: getSignups passes ctx.orgId', async () => {
		await caller().getSignups({ shiftId: SHIFT_ID });

		expect(mocks.getShiftSignups).toHaveBeenCalledWith(SHIFT_ID, CTX_ORG_ID);
	});

	it('SECURITY: getWaitlist passes ctx.orgId', async () => {
		await caller().getWaitlist({ shiftId: SHIFT_ID });

		expect(mocks.getShiftWaitlist).toHaveBeenCalledWith(SHIFT_ID, CTX_ORG_ID);
	});

	it('SECURITY: getCheckinStats guards on ctx.orgId before reading', async () => {
		await caller().getCheckinStats({ shiftId: SHIFT_ID });

		expect(mocks.requireOrgShift).toHaveBeenCalledWith(SHIFT_ID, CTX_ORG_ID);
	});
});

describe('writes are scoped to ctx.orgId', () => {
	it('SECURITY: update passes ctx.orgId', async () => {
		await caller().update({ id: SHIFT_ID, title: 'New' });

		expect(mocks.updateExistingShift).toHaveBeenCalledWith(
			expect.objectContaining({ id: SHIFT_ID }),
			CTX_ORG_ID,
			ACTOR_ID,
		);
	});

	it('SECURITY: cancel passes ctx.orgId', async () => {
		await caller().cancel({ id: SHIFT_ID });

		expect(mocks.cancelShift).toHaveBeenCalledWith(
			SHIFT_ID,
			CTX_ORG_ID,
			ACTOR_ID,
		);
	});

	it('SECURITY: complete passes ctx.orgId', async () => {
		await caller().complete({ id: SHIFT_ID });

		expect(mocks.completeShift).toHaveBeenCalledWith(
			SHIFT_ID,
			CTX_ORG_ID,
			ACTOR_ID,
		);
	});

	it('SECURITY: remove passes ctx.orgId', async () => {
		await caller().remove({ id: SHIFT_ID });

		expect(mocks.removeShift).toHaveBeenCalledWith(
			SHIFT_ID,
			CTX_ORG_ID,
			ACTOR_ID,
		);
	});

	it('SECURITY: create stamps ctx.orgId, so a client cannot choose the org', async () => {
		await caller().create({
			title: 'Shift',
			startTime: new Date('2026-09-01T09:00:00Z'),
			endTime: new Date('2026-09-01T12:00:00Z'),
			capacity: 5,
		});

		expect(mocks.createNewShift).toHaveBeenCalledWith(
			expect.objectContaining({ orgId: CTX_ORG_ID }),
			ACTOR_ID,
		);
	});
});

describe('markAttendance declares the staff authorization model', () => {
	it('SECURITY: staff manual attendance declares {by:staff} with ctx.orgId', async () => {
		await caller().markAttendance({
			shiftId: SHIFT_ID,
			userId: 'user-volunteer',
			status: 'ATTENDED',
		});

		expect(mocks.markAttendance).toHaveBeenCalledWith(
			SHIFT_ID,
			'user-volunteer',
			'ATTENDED',
			ACTOR_ID,
			{ by: 'staff', orgId: CTX_ORG_ID },
		);
	});

	it('SECURITY: checkinByQr declares {by:staff} with ctx.orgId', async () => {
		await caller().checkinByQr({
			shiftId: SHIFT_ID,
			userId: 'user-volunteer',
			token: 'tok',
		});

		expect(mocks.markAttendance).toHaveBeenCalledWith(
			SHIFT_ID,
			'user-volunteer',
			'ATTENDED',
			ACTOR_ID,
			{ by: 'staff', orgId: CTX_ORG_ID },
			'qr',
		);
	});

	it('SECURITY: no staff path ever declares {by:self}', async () => {
		// {by:'self'} skips the org check entirely by design. It is correct for
		// the volunteer geo path and catastrophic on a staffProcedure.
		await caller().markAttendance({
			shiftId: SHIFT_ID,
			userId: 'user-volunteer',
			status: 'NO_SHOW',
		});
		await caller().checkinByQr({
			shiftId: SHIFT_ID,
			userId: 'user-volunteer',
			token: 'tok',
		});

		for (const call of mocks.markAttendance.mock.calls) {
			expect(call[4]).toMatchObject({ by: 'staff' });
		}
	});
});

describe('pre-authorization disclosure', () => {
	// These pin the ORDER of checks, not just their presence. The bug being
	// fixed was never a missing check — it was a correct check placed after the
	// branches that had already answered the question it guards.

	it('SECURITY: getCheckinToken authorizes before reading any shift state', async () => {
		mocks.requireOwnSignup.mockRejectedValue(
			new TRPCError({ code: 'NOT_FOUND', message: 'Shift not found.' }),
		);

		await expect(
			caller().getCheckinToken({ shiftId: SHIFT_ID }),
		).rejects.toMatchObject({ code: 'NOT_FOUND' });

		// The unscoped repo read is what leaked status and start time. If the
		// guard rejects, it must never happen.
		expect(mocks.getShiftById).not.toHaveBeenCalled();
		expect(mocks.generateCheckinTokenFromEnv).not.toHaveBeenCalled();
	});

	it('SECURITY: getCheckinToken passes the session user, never an input-supplied id', async () => {
		mocks.requireOwnSignup.mockResolvedValue({
			shift: { status: 'OPEN', startTime: new Date() },
			signup: { status: 'CONFIRMED' },
		});

		await caller().getCheckinToken({
			shiftId: SHIFT_ID,
			userId: 'user-someone-else',
		} as never);

		expect(mocks.requireOwnSignup).toHaveBeenCalledWith(SHIFT_ID, ACTOR_ID);
	});

	it('still tells a volunteer WITH a signup why the code is not ready', async () => {
		// The fix must not degrade the legitimate flow into a blank NOT_FOUND.
		mocks.requireOwnSignup.mockResolvedValue({
			shift: {
				status: 'OPEN',
				startTime: new Date(Date.now() + 72 * 60 * 60 * 1000),
			},
			signup: { status: 'CONFIRMED' },
		});

		await expect(
			caller().getCheckinToken({ shiftId: SHIFT_ID }),
		).rejects.toMatchObject({
			code: 'BAD_REQUEST',
			message: 'QR code is available 24 hours before the shift.',
		});
	});

	it('SECURITY: selfCheckin validates the token before loading the shift', async () => {
		mocks.validateCheckinTokenFromEnv.mockReturnValue(false);

		await expect(
			caller().selfCheckin({ shiftId: SHIFT_ID, token: 'forged' }),
		).rejects.toMatchObject({ code: 'UNAUTHORIZED' });

		// Structural proof the leak is closed: with a bad token the shift is
		// never read at all, so no status can escape regardless of wording.
		expect(mocks.getShiftById).not.toHaveBeenCalled();
		expect(mocks.markAttendance).not.toHaveBeenCalled();
	});

	it('SECURITY: selfCheckin still declares {by:self} on the happy path', async () => {
		mocks.validateCheckinTokenFromEnv.mockReturnValue(true);
		mocks.getShiftById.mockResolvedValue({ id: SHIFT_ID, status: 'OPEN' });

		await caller().selfCheckin({ shiftId: SHIFT_ID, token: 'good' });

		expect(mocks.markAttendance).toHaveBeenCalledWith(
			SHIFT_ID,
			ACTOR_ID,
			'ATTENDED',
			ACTOR_ID,
			{ by: 'self', userId: ACTOR_ID },
			'geo',
		);
	});
});

/**
 * The roster feature flag is a KILL SWITCH, not a nav-hiding convenience.
 *
 * `ShiftDetailDialog` withholds the assign picker when the flag is off, but
 * that is cosmetic — both procedures below are live HTTP endpoints, and
 * `assignVolunteer` writes a `ShiftSignup` and an audit row. If they were
 * plain `staffProcedure`s, any staff user at a non-pilot org could POST
 * straight to tRPC and schedule from a roster the product says they cannot see.
 *
 * This is the same argument `volunteers/layout.tsx` makes about the route and
 * then does not apply to the mutations, which is why `rosterProcedure` is
 * shared between the two routers rather than copied.
 */
describe('assign procedures are gated by the roster flag', () => {
	it('SECURITY: assignVolunteer is FORBIDDEN when the flag is off', async () => {
		mocks.isFeatureEnabled.mockResolvedValue(false);

		await expect(
			caller().assignVolunteer({ shiftId: SHIFT_ID, volunteerId: 'ov-1' }),
		).rejects.toMatchObject({ code: 'FORBIDDEN' });

		expect(mocks.assignVolunteerToShift).not.toHaveBeenCalled();
	});

	it('SECURITY: assignableVolunteers is FORBIDDEN when the flag is off', async () => {
		mocks.isFeatureEnabled.mockResolvedValue(false);

		await expect(
			caller().assignableVolunteers({ shiftId: SHIFT_ID }),
		).rejects.toMatchObject({ code: 'FORBIDDEN' });

		expect(mocks.getAssignableVolunteers).not.toHaveBeenCalled();
	});

	it('SECURITY: the flag is resolved against ctx.orgId, not anything from input', async () => {
		await caller().assignVolunteer({ shiftId: SHIFT_ID, volunteerId: 'ov-1' });

		expect(mocks.isFeatureEnabled).toHaveBeenCalledWith(
			CTX_ORG_ID,
			'staff_created_volunteers',
		);
	});

	it('SECURITY: assignVolunteer passes ctx.orgId and the session actor', async () => {
		await caller().assignVolunteer({
			shiftId: SHIFT_ID,
			volunteerId: 'ov-1',
			allowOverCapacity: true,
		});

		expect(mocks.assignVolunteerToShift).toHaveBeenCalledWith({
			shiftId: SHIFT_ID,
			volunteerId: 'ov-1',
			orgId: CTX_ORG_ID,
			actorId: ACTOR_ID,
			allowOverCapacity: true,
			impersonatedBy: null,
		});
	});

	it('SECURITY: assignableVolunteers passes ctx.orgId', async () => {
		await caller().assignableVolunteers({ shiftId: SHIFT_ID, search: 'mar' });

		expect(mocks.getAssignableVolunteers).toHaveBeenCalledWith({
			shiftId: SHIFT_ID,
			orgId: CTX_ORG_ID,
			search: 'mar',
		});
	});

	/**
	 * The trap the design doc flags for this exact task: `ctx.realUserId` is
	 * populated on EVERY logged-in request, not only impersonated ones. Stamping
	 * it unconditionally marks every audit row as impersonated and makes
	 * `queryAuditLog`'s `impersonatedOnly` filter match everything.
	 */
	it('SECURITY: stamps impersonatedBy only when the real user differs', async () => {
		await caller().assignVolunteer({ shiftId: SHIFT_ID, volunteerId: 'ov-1' });
		expect(mocks.assignVolunteerToShift).toHaveBeenCalledWith(
			expect.objectContaining({ impersonatedBy: null }),
		);

		mocks.assignVolunteerToShift.mockClear();
		const impersonated = callerFactory({
			session: { user: { id: 'target-user' } },
			realSession: null,
			realUserId: 'real-admin',
			impersonation: null,
			orgId: CTX_ORG_ID,
			role: 'STAFF',
			companyId: null,
			companyRole: null,
			prisma: {} as never,
			sessionToken: null,
			ip: null,
		} as Parameters<typeof callerFactory>[0]);

		await impersonated.assignVolunteer({
			shiftId: SHIFT_ID,
			volunteerId: 'ov-1',
		});

		expect(mocks.assignVolunteerToShift).toHaveBeenCalledWith(
			expect.objectContaining({
				actorId: 'target-user',
				impersonatedBy: 'real-admin',
			}),
		);
	});
});
