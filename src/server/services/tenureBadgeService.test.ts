/**
 * Tests for tenureBadgeService — idempotent tenure badge issuance.
 *
 * All external dependencies (prisma, repos) are mocked so tests are fast
 * and don't require a database.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoist mock functions so vi.mock factories can reference them
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
	prismaUserFindUnique: vi.fn(),
	prismaOrgFindUnique: vi.fn(),
	prismaTransaction: vi.fn(),
	listUserApplications: vi.fn(),
	getAttendedShiftsForUser: vi.fn(),
	upsertCredential: vi.fn(),
}));

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		user: { findUnique: mocks.prismaUserFindUnique },
		organization: { findUnique: mocks.prismaOrgFindUnique },
		$transaction: mocks.prismaTransaction,
	},
}));

vi.mock('@/server/repositories/volunteer-applications', () => ({
	listUserApplications: mocks.listUserApplications,
}));

vi.mock('@/server/repositories/shiftSignupRepo', () => ({
	getAttendedShiftsForUser: mocks.getAttendedShiftsForUser,
	getSignupsForReliability: vi.fn().mockResolvedValue([]),
	getConfirmedShiftsForUser: vi.fn().mockResolvedValue([]),
	getSignupsByShift: vi.fn().mockResolvedValue([]),
	getSignupByShiftAndUser: vi.fn().mockResolvedValue(null),
	getUpcomingSignupsForUser: vi.fn().mockResolvedValue([]),
	createSignup: vi.fn(),
	updateSignupStatus: vi.fn(),
}));

vi.mock('@/server/repositories/volunteerCredentialRepo', () => ({
	upsertCredential: mocks.upsertCredential,
	getCredentialsByUserId: vi.fn().mockResolvedValue([]),
	getCredentialsByOrg: vi.fn().mockResolvedValue([]),
	getCredentialsByUserAndOrg: vi.fn().mockResolvedValue([]),
	deleteCredential: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import service AFTER mocks are registered
// ---------------------------------------------------------------------------

import { checkAndIssueTenureBadges } from './tenureBadgeService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PLATFORM_ORG_ID = 'platform-org-id';
const USER_ID = 'user-123';

function daysAgo(n: number): Date {
	const d = new Date();
	d.setDate(d.getDate() - n);
	return d;
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.prismaOrgFindUnique.mockResolvedValue({ id: PLATFORM_ORG_ID });
	mocks.prismaTransaction.mockImplementation(
		async (fn: (tx: unknown) => Promise<unknown>) =>
			fn({ volunteerCredential: { upsert: mocks.upsertCredential } }),
	);
	mocks.upsertCredential.mockResolvedValue({ id: 'cred-1' });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('checkAndIssueTenureBadges', () => {
	it('returns early if user does not exist', async () => {
		mocks.prismaUserFindUnique.mockResolvedValue(null);

		await checkAndIssueTenureBadges(USER_ID);

		expect(mocks.listUserApplications).not.toHaveBeenCalled();
		expect(mocks.upsertCredential).not.toHaveBeenCalled();
	});

	it('returns early if user account is less than 1 year old', async () => {
		mocks.prismaUserFindUnique.mockResolvedValue({ createdAt: daysAgo(300) });

		await checkAndIssueTenureBadges(USER_ID);

		expect(mocks.listUserApplications).not.toHaveBeenCalled();
		expect(mocks.upsertCredential).not.toHaveBeenCalled();
	});

	it('returns early if platform org is not found', async () => {
		mocks.prismaUserFindUnique.mockResolvedValue({ createdAt: daysAgo(400) });
		mocks.prismaOrgFindUnique.mockResolvedValue(null);
		mocks.listUserApplications.mockResolvedValue([]);
		mocks.getAttendedShiftsForUser.mockResolvedValue([]);

		await checkAndIssueTenureBadges(USER_ID);

		expect(mocks.upsertCredential).not.toHaveBeenCalled();
	});

	it('issues no badge when activity is less than 1yr old', async () => {
		mocks.prismaUserFindUnique.mockResolvedValue({ createdAt: daysAgo(400) });
		mocks.listUserApplications.mockResolvedValue([
			{ submittedAt: daysAgo(200) },
		]);
		mocks.getAttendedShiftsForUser.mockResolvedValue([]);

		await checkAndIssueTenureBadges(USER_ID);

		expect(mocks.upsertCredential).not.toHaveBeenCalled();
	});

	it('issues TENURE_1YR when volunteer has 1yr of activity', async () => {
		mocks.prismaUserFindUnique.mockResolvedValue({ createdAt: daysAgo(500) });
		mocks.listUserApplications.mockResolvedValue([
			{ submittedAt: daysAgo(430) }, // ~14 months → 1YR
		]);
		mocks.getAttendedShiftsForUser.mockResolvedValue([]);

		await checkAndIssueTenureBadges(USER_ID);

		expect(mocks.upsertCredential).toHaveBeenCalledTimes(1);
		expect(mocks.upsertCredential).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ type: 'TENURE_1YR', status: 'VERIFIED' }),
		);
	});

	it('issues TENURE_1YR and TENURE_3YR for 3yr volunteer', async () => {
		mocks.prismaUserFindUnique.mockResolvedValue({ createdAt: daysAgo(1200) });
		mocks.listUserApplications.mockResolvedValue([
			{ submittedAt: daysAgo(1130) }, // ~37 months → 3YR
		]);
		mocks.getAttendedShiftsForUser.mockResolvedValue([]);

		await checkAndIssueTenureBadges(USER_ID);

		expect(mocks.upsertCredential).toHaveBeenCalledTimes(2);
		const types = mocks.upsertCredential.mock.calls.map(
			(call) => (call[1] as { type: string }).type,
		);
		expect(types).toContain('TENURE_1YR');
		expect(types).toContain('TENURE_3YR');
		expect(types).not.toContain('TENURE_5YR');
	});

	it('issues all three badges for 5yr+ volunteer', async () => {
		mocks.prismaUserFindUnique.mockResolvedValue({ createdAt: daysAgo(1900) });
		mocks.listUserApplications.mockResolvedValue([
			{ submittedAt: daysAgo(1870) }, // ~61 months → 5YR
		]);
		mocks.getAttendedShiftsForUser.mockResolvedValue([]);

		await checkAndIssueTenureBadges(USER_ID);

		expect(mocks.upsertCredential).toHaveBeenCalledTimes(3);
		const types = mocks.upsertCredential.mock.calls.map(
			(call) => (call[1] as { type: string }).type,
		);
		expect(types).toContain('TENURE_1YR');
		expect(types).toContain('TENURE_3YR');
		expect(types).toContain('TENURE_5YR');
	});

	it('swallows P2002 errors (concurrent badge issuance) without throwing', async () => {
		mocks.prismaUserFindUnique.mockResolvedValue({ createdAt: daysAgo(500) });
		mocks.listUserApplications.mockResolvedValue([{ submittedAt: daysAgo(430) }]);
		mocks.getAttendedShiftsForUser.mockResolvedValue([]);

		const p2002 = Object.assign(new Error('Unique constraint'), { code: 'P2002' });
		mocks.prismaTransaction.mockRejectedValue(p2002);

		await expect(checkAndIssueTenureBadges(USER_ID)).resolves.toBeUndefined();
	});

	it('swallows unexpected errors without throwing (fire-and-forget contract)', async () => {
		mocks.prismaUserFindUnique.mockRejectedValue(new Error('DB connection lost'));

		await expect(checkAndIssueTenureBadges(USER_ID)).resolves.toBeUndefined();
	});

	it('uses earliest activity across applications AND attended shifts', async () => {
		mocks.prismaUserFindUnique.mockResolvedValue({ createdAt: daysAgo(1900) });
		// Application is recent (200 days) but a shift signup is old (1130 days → 3YR)
		mocks.listUserApplications.mockResolvedValue([{ submittedAt: daysAgo(200) }]);
		mocks.getAttendedShiftsForUser.mockResolvedValue([
			{ createdAt: daysAgo(1130) },
		]);

		await checkAndIssueTenureBadges(USER_ID);

		const types = mocks.upsertCredential.mock.calls.map(
			(call) => (call[1] as { type: string }).type,
		);
		expect(types).toContain('TENURE_1YR');
		expect(types).toContain('TENURE_3YR');
	});
});
