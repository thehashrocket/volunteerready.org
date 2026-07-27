/**
 * SECURITY tests for org scoping across the staff-facing shift surface.
 *
 * Every procedure in `routers/shifts.ts` takes a client-supplied shift id.
 * Before this guard landed:
 *   - the reads (`getShiftSignups`, `getShiftWaitlist`, `getShiftDetail`)
 *     returned another tenant's volunteer names and email addresses;
 *   - the writes (`updateExistingShift`, `cancelShift`, `completeShift`,
 *     `removeShift`) accepted `orgId` but used it only to stamp the audit row,
 *     writing on `where: { id }` alone — so a coordinator at org A could edit,
 *     cancel, complete or delete org B's shift and have it filed under org A.
 */

const mocks = vi.hoisted(() => ({
	getShiftById: vi.fn(),
	getShiftWithSignups: vi.fn(),
	getSignupsByShift: vi.fn(),
	getWaitlistForShift: vi.fn(),
	updateShift: vi.fn(),
	deleteShift: vi.fn(),
	writeAuditLogTx: vi.fn(),
	txUpdateMany: vi.fn(),
	txFindUniqueOrThrow: vi.fn(),
	signupFindMany: vi.fn(),
}));

vi.mock('@/server/repositories/shiftRepo', () => ({
	getShiftById: mocks.getShiftById,
	getShiftWithSignups: mocks.getShiftWithSignups,
	updateShift: mocks.updateShift,
	deleteShift: mocks.deleteShift,
	listShiftsByOpportunity: vi.fn(),
	listShiftsByOrg: vi.fn(),
	listUpcomingShiftsForOrg: vi.fn(),
	createShift: vi.fn(),
}));

vi.mock('@/server/repositories/shiftSignupRepo', () => ({
	getSignupsByShift: mocks.getSignupsByShift,
	getWaitlistForShift: mocks.getWaitlistForShift,
	getSignupByShiftAndUser: vi.fn(),
	getConfirmedShiftsForUser: vi.fn(),
	createSignup: vi.fn(),
	createWaitlistEntry: vi.fn(),
	updateSignupStatus: vi.fn(),
	getUpcomingSignupsForUser: vi.fn(),
	getUpcomingSignupsForUserIncludingWaitlist: vi.fn(),
}));

vi.mock('@/server/repositories/auditRepo', () => ({
	writeAuditLogTx: mocks.writeAuditLogTx,
}));

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		$transaction: vi.fn(async (cb: (tx: unknown) => unknown) =>
			cb({
				shift: {
					updateMany: mocks.txUpdateMany,
					findUniqueOrThrow: mocks.txFindUniqueOrThrow,
				},
			}),
		),
		shiftSignup: { findMany: mocks.signupFindMany },
	},
}));

vi.mock('@/server/lib/email', () => ({ sendEmail: vi.fn() }));
vi.mock('@/server/services/notificationService', () => ({
	tryNotify: vi.fn(),
}));
vi.mock('@/server/services/tenureBadgeService', () => ({
	checkAndIssueTenureBadges: vi.fn(),
}));
vi.mock('@/server/repositories/reengagement-repo', () => ({
	findMemberByUserAndOrg: vi.fn(),
	touchMemberActivity: vi.fn(),
}));

import {
	cancelShift,
	completeShift,
	getShiftDetail,
	removeShift,
	updateExistingShift,
} from '../shiftService';
import { getShiftSignups, getShiftWaitlist } from '../shiftSignupService';

const ORG_ID = 'org-owner';
const OTHER_ORG_ID = 'org-attacker';
const SHIFT_ID = 'shift-1';
const ACTOR_ID = 'user-staff';

const ROSTER = [
	{ id: 'signup-1', user: { name: 'Ada', email: 'ada@example.org' } },
];

function makeShift(overrides: Record<string, unknown> = {}) {
	return {
		id: SHIFT_ID,
		orgId: ORG_ID,
		title: 'Morning',
		// completeShift derives volunteer hours from these.
		startTime: new Date('2026-04-01T09:00:00Z'),
		endTime: new Date('2026-04-01T12:00:00Z'),
		...overrides,
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.getShiftById.mockResolvedValue(makeShift());
	mocks.getSignupsByShift.mockResolvedValue(ROSTER);
	mocks.getWaitlistForShift.mockResolvedValue(ROSTER);
	mocks.getShiftWithSignups.mockResolvedValue({
		...makeShift(),
		signups: ROSTER,
	});
	mocks.updateShift.mockResolvedValue(makeShift());
	mocks.txFindUniqueOrThrow.mockResolvedValue(makeShift());
	mocks.signupFindMany.mockResolvedValue([]);
});

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

describe('getShiftSignups', () => {
	it('returns the roster for a shift in the caller org', async () => {
		await expect(getShiftSignups(SHIFT_ID, ORG_ID)).resolves.toEqual(ROSTER);
	});

	it('SECURITY: throws NOT_FOUND for a shift owned by another org', async () => {
		await expect(getShiftSignups(SHIFT_ID, OTHER_ORG_ID)).rejects.toMatchObject(
			{ code: 'NOT_FOUND' },
		);
	});

	it('SECURITY: does not reach the signup query for a foreign shift', async () => {
		await getShiftSignups(SHIFT_ID, OTHER_ORG_ID).catch(() => {});

		expect(mocks.getSignupsByShift).not.toHaveBeenCalled();
	});
});

describe('getShiftWaitlist', () => {
	it('returns the waitlist for a shift in the caller org', async () => {
		await expect(getShiftWaitlist(SHIFT_ID, ORG_ID)).resolves.toEqual(ROSTER);
	});

	it('SECURITY: throws NOT_FOUND for a shift owned by another org', async () => {
		await expect(
			getShiftWaitlist(SHIFT_ID, OTHER_ORG_ID),
		).rejects.toMatchObject({ code: 'NOT_FOUND' });
	});

	it('SECURITY: does not reach the waitlist query for a foreign shift', async () => {
		await getShiftWaitlist(SHIFT_ID, OTHER_ORG_ID).catch(() => {});

		expect(mocks.getWaitlistForShift).not.toHaveBeenCalled();
	});
});

describe('getShiftDetail', () => {
	it('returns the shift with signups for the caller org', async () => {
		const shift = await getShiftDetail(SHIFT_ID, ORG_ID);

		expect(shift?.id).toBe(SHIFT_ID);
	});

	it('SECURITY: returns null for a shift owned by another org', async () => {
		await expect(getShiftDetail(SHIFT_ID, OTHER_ORG_ID)).resolves.toBeNull();
	});

	it('SECURITY: a foreign shift is indistinguishable from a missing one', async () => {
		// The router renders both as NOT_FOUND, so an attacker enumerating ids
		// cannot tell which shifts exist.
		const foreign = await getShiftDetail(SHIFT_ID, OTHER_ORG_ID);

		mocks.getShiftWithSignups.mockResolvedValue(null);
		const missing = await getShiftDetail(SHIFT_ID, ORG_ID);

		expect(foreign).toBe(missing);
	});
});

// ---------------------------------------------------------------------------
// Writes — orgId reached these only as an audit-log field
// ---------------------------------------------------------------------------

describe('updateExistingShift', () => {
	it('updates a shift in the caller org', async () => {
		await updateExistingShift({ id: SHIFT_ID, title: 'New' }, ORG_ID, ACTOR_ID);

		expect(mocks.updateShift).toHaveBeenCalled();
	});

	it("SECURITY: refuses to edit another org's shift", async () => {
		await expect(
			updateExistingShift(
				{ id: SHIFT_ID, title: 'Hijacked' },
				OTHER_ORG_ID,
				ACTOR_ID,
			),
		).rejects.toMatchObject({ code: 'NOT_FOUND' });

		expect(mocks.updateShift).not.toHaveBeenCalled();
		expect(mocks.writeAuditLogTx).not.toHaveBeenCalled();
	});
});

describe('cancelShift', () => {
	it('cancels a shift in the caller org', async () => {
		await cancelShift(SHIFT_ID, ORG_ID, ACTOR_ID);

		expect(mocks.updateShift).toHaveBeenCalledWith(expect.anything(), {
			id: SHIFT_ID,
			status: 'CANCELLED',
		});
	});

	it("SECURITY: refuses to cancel another org's shift", async () => {
		await expect(
			cancelShift(SHIFT_ID, OTHER_ORG_ID, ACTOR_ID),
		).rejects.toMatchObject({ code: 'NOT_FOUND' });

		expect(mocks.updateShift).not.toHaveBeenCalled();
	});
});

describe('removeShift', () => {
	it('deletes a shift in the caller org', async () => {
		await removeShift(SHIFT_ID, ORG_ID, ACTOR_ID);

		expect(mocks.deleteShift).toHaveBeenCalledWith(expect.anything(), SHIFT_ID);
	});

	it("SECURITY: refuses to delete another org's shift", async () => {
		// The delete cascades to ShiftSignup, so this destroyed attendance history.
		await expect(
			removeShift(SHIFT_ID, OTHER_ORG_ID, ACTOR_ID),
		).rejects.toMatchObject({ code: 'NOT_FOUND' });

		expect(mocks.deleteShift).not.toHaveBeenCalled();
	});
});

describe('completeShift', () => {
	it('SECURITY: scopes the atomic update by orgId, not just id', async () => {
		// The org check lives in the WHERE clause rather than in a preceding read,
		// so the single-statement no-TOCTOU property of this update is preserved.
		mocks.txUpdateMany.mockResolvedValue({ count: 1 });

		await completeShift(SHIFT_ID, ORG_ID, ACTOR_ID);

		expect(mocks.txUpdateMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({ id: SHIFT_ID, orgId: ORG_ID }),
			}),
		);
	});

	it('SECURITY: passes the CALLER org, never the shift own org, to the WHERE clause', async () => {
		// Guards the actual failure mode a mock can catch here: `orgId` being
		// sourced from the loaded shift (always true, fail-open) instead of from
		// the caller. Asserting on a mocked `count` cannot catch anything —
		// whether Postgres honours the clause is proven in
		// shiftOrgScoping.integration.test.ts against a real database.
		mocks.txUpdateMany.mockResolvedValue({ count: 0 });

		await completeShift(SHIFT_ID, OTHER_ORG_ID, ACTOR_ID);

		expect(mocks.txUpdateMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({ orgId: OTHER_ORG_ID }),
			}),
		);
	});

	it('writes no audit row when the update matches nothing', async () => {
		mocks.txUpdateMany.mockResolvedValue({ count: 0 });

		await expect(
			completeShift(SHIFT_ID, OTHER_ORG_ID, ACTOR_ID),
		).resolves.toBeNull();

		expect(mocks.writeAuditLogTx).not.toHaveBeenCalled();
	});
});
