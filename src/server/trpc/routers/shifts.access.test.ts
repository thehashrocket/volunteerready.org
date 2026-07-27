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
	validateCheckinTokenFromEnv: vi.fn(),
}));

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
}));

vi.mock('@/server/services/shiftAccessService', () => ({
	requireOrgShift: mocks.requireOrgShift,
}));

vi.mock('@/server/repositories/shiftRepo', () => ({ getShiftById: vi.fn() }));

vi.mock('@/server/lib/checkin-token', () => ({
	generateCheckinTokenFromEnv: vi.fn(),
	validateCheckinTokenFromEnv: mocks.validateCheckinTokenFromEnv,
}));

vi.mock('@/server/trpc/rate-limit-middleware', () => ({
	rateLimitByOrg: () => (opts: { next: () => unknown }) => opts.next(),
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
