/**
 * Service-level tests for shift completion features in shiftService.
 *
 * Tests completeShift thank-you notifications and session summary email.
 */

const mocks = vi.hoisted(() => ({
	updateShift: vi.fn(),
	writeAuditLogTx: vi.fn(),
	tryNotify: vi.fn(),
	sendEmail: vi.fn(),
	shiftSignupFindMany: vi.fn(),
	shiftSignupCount: vi.fn(),
	orgMemberFindMany: vi.fn(),
	queryRaw: vi.fn(),
	shiftUpdateMany: vi.fn(),
	shiftFindUniqueOrThrow: vi.fn(),
}));

vi.mock('@/server/repositories/shiftRepo', () => ({
	getShiftById: vi.fn(),
	getShiftWithSignups: vi.fn(),
	listShiftsByOpportunity: vi.fn(),
	listShiftsByOrg: vi.fn(),
	listUpcomingShiftsForOrg: vi.fn(),
	createShift: vi.fn(),
	deleteShift: vi.fn(),
	updateShift: mocks.updateShift,
}));

vi.mock('@/server/repositories/auditRepo', () => ({
	writeAuditLogTx: mocks.writeAuditLogTx,
}));

vi.mock('@/server/services/notificationService', () => ({
	tryNotify: mocks.tryNotify,
}));

vi.mock('@/server/lib/email', () => ({
	sendEmail: mocks.sendEmail,
}));

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		$transaction: vi.fn(async (cb: (tx: unknown) => unknown) => {
			const tx = {
				shift: {
					updateMany: mocks.shiftUpdateMany,
					findUniqueOrThrow: mocks.shiftFindUniqueOrThrow,
				},
			};
			return cb(tx);
		}),
		shiftSignup: {
			findMany: mocks.shiftSignupFindMany,
			count: mocks.shiftSignupCount,
		},
		organizationMember: {
			findMany: mocks.orgMemberFindMany,
		},
		$queryRaw: mocks.queryRaw,
	},
}));

import { completeShift } from '../shiftService';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ORG_ID = 'org-complete';
const SHIFT_ID = 'shift-complete';
const ACTOR_ID = 'user-staff';

function makeCompletedShift() {
	return {
		id: SHIFT_ID,
		title: 'Morning Shift',
		orgId: ORG_ID,
		startTime: new Date('2026-04-01T09:00:00Z'),
		endTime: new Date('2026-04-01T12:00:00Z'),
		capacity: 10,
		status: 'COMPLETED',
	};
}

// ---------------------------------------------------------------------------
// completeShift — thank-you notifications
// ---------------------------------------------------------------------------

describe('completeShift', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.shiftUpdateMany.mockResolvedValue({ count: 1 });
		mocks.shiftFindUniqueOrThrow.mockResolvedValue(makeCompletedShift());
		mocks.shiftSignupCount.mockResolvedValue(5);
		mocks.orgMemberFindMany.mockResolvedValue([]);
	});

	it('sends SHIFT_COMPLETED notification to each ATTENDED volunteer', async () => {
		mocks.shiftSignupFindMany.mockResolvedValue([
			{ userId: 'vol-1' },
			{ userId: 'vol-2' },
		]);
		mocks.queryRaw.mockResolvedValue([
			{ user_id: 'vol-1', total_hours: 10.5 },
			{ user_id: 'vol-2', total_hours: 3.0 },
		]);

		await completeShift(SHIFT_ID, ORG_ID, ACTOR_ID);

		expect(mocks.tryNotify).toHaveBeenCalledTimes(2);
		expect(mocks.tryNotify).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: 'vol-1',
				type: 'SHIFT_COMPLETED',
				title: 'Thanks for volunteering!',
				href: '/app/my-shifts',
			}),
		);
		// Check that body includes hours
		const call1 = mocks.tryNotify.mock.calls[0][0];
		expect(call1.body).toContain('3h'); // shift duration: 3 hours
		expect(call1.body).toContain('10.5 total hours');
	});

	it('sends no notifications when no volunteers attended', async () => {
		mocks.shiftSignupFindMany.mockResolvedValue([]);
		mocks.queryRaw.mockResolvedValue([]);

		await completeShift(SHIFT_ID, ORG_ID, ACTOR_ID);

		expect(mocks.tryNotify).not.toHaveBeenCalled();
	});

	it('sends session summary email to org admins', async () => {
		mocks.shiftSignupFindMany.mockResolvedValue([{ userId: 'vol-1' }]);
		mocks.queryRaw.mockResolvedValue([{ user_id: 'vol-1', total_hours: 5.0 }]);
		mocks.orgMemberFindMany.mockResolvedValue([
			{ user: { email: 'admin@test.com' } },
		]);

		await completeShift(SHIFT_ID, ORG_ID, ACTOR_ID);

		// Wait for fire-and-forget
		await new Promise((r) => setTimeout(r, 50));

		expect(mocks.sendEmail).toHaveBeenCalledWith(
			'admin@test.com',
			expect.stringContaining('Shift Complete'),
			expect.stringContaining('Morning Shift'),
		);
	});

	it('escapes HTML in shift title for email', async () => {
		mocks.shiftFindUniqueOrThrow.mockResolvedValue({
			...makeCompletedShift(),
			title: '<script>alert("xss")</script>',
		});
		mocks.shiftSignupFindMany.mockResolvedValue([{ userId: 'vol-1' }]);
		mocks.queryRaw.mockResolvedValue([{ user_id: 'vol-1', total_hours: 1.0 }]);
		mocks.orgMemberFindMany.mockResolvedValue([
			{ user: { email: 'admin@test.com' } },
		]);

		await completeShift(SHIFT_ID, ORG_ID, ACTOR_ID);

		await new Promise((r) => setTimeout(r, 50));

		const emailHtml = mocks.sendEmail.mock.calls[0]?.[2] ?? '';
		expect(emailHtml).not.toContain('<script>');
		expect(emailHtml).toContain('&lt;script&gt;');
	});

	it('returns null and skips side effects when shift is already CANCELLED', async () => {
		mocks.shiftUpdateMany.mockResolvedValue({ count: 0 });

		const result = await completeShift(SHIFT_ID, ORG_ID, ACTOR_ID);

		expect(result).toBeNull();
		expect(mocks.shiftFindUniqueOrThrow).not.toHaveBeenCalled();
		expect(mocks.writeAuditLogTx).not.toHaveBeenCalled();
		expect(mocks.tryNotify).not.toHaveBeenCalled();
	});

	it('writes audit log for shift completion', async () => {
		mocks.shiftSignupFindMany.mockResolvedValue([]);
		mocks.queryRaw.mockResolvedValue([]);

		await completeShift(SHIFT_ID, ORG_ID, ACTOR_ID);

		expect(mocks.writeAuditLogTx).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				action: 'shift.completed',
				entityType: 'Shift',
				entityId: SHIFT_ID,
			}),
		);
	});
});
