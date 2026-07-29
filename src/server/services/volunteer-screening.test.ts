/**
 * Unit tests for volunteer-screening.ts — source tracking (T1).
 *
 * Tests the 4 source tracking paths:
 * 1. source=MARKETPLACE + org marketplace-visible → MARKETPLACE
 * 2. source=DIRECT → DIRECT
 * 3. source=MARKETPLACE + org NOT marketplace-visible → downgrade to DIRECT
 * 4. source=undefined → DIRECT (default)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPrisma = vi.hoisted(() => ({
	organization: { findUnique: vi.fn() },
	volunteerOpportunity: { findFirst: vi.fn() },
	$transaction: vi.fn(),
}));

vi.mock('@/server/repositories/prisma', () => ({ prisma: mockPrisma }));

vi.mock('@/server/repositories/volunteer-applications', () => ({
	getActiveQuestions: vi.fn().mockResolvedValue([]),
	findActiveApplicationByUserAndOpportunity: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/server/repositories/auditRepo', () => ({
	writeAuditLogTx: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/server/repositories/reengagement-repo', () => ({
	findMemberByUserAndOrg: vi.fn().mockResolvedValue(null),
	touchMemberActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/server/services/notificationService', () => ({
	tryNotify: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/server/services/tenureBadgeService', () => ({
	checkAndIssueTenureBadges: vi.fn().mockResolvedValue(undefined),
}));

const mockLiftOrgVolunteerBlock = vi.hoisted(() =>
	vi.fn().mockResolvedValue(false),
);

vi.mock('@/server/services/orgVolunteerAccessService', () => ({
	liftOrgVolunteerBlock: mockLiftOrgVolunteerBlock,
}));

import { submitVolunteerApplication } from './volunteer-screening';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_PAYLOAD = {
	submittedByEmail: 'test@example.com',
	submittedByUserId: null,
	opportunityId: null,
	profile: {
		name: 'Test',
		email: 'test@example.com',
		phone: '',
		county: '',
		availability: '',
		experienceLevel: '',
		notes: '',
	},
	responses: [],
};

/** Set up the $transaction mock to call callback with a tx containing mockCreate */
function setupTransactionMock(appId = 'app-1') {
	const txCreate = vi.fn().mockResolvedValue({ id: appId });
	const txMock = {
		volunteerApplication: { create: txCreate },
		volunteerAnswer: { createMany: vi.fn().mockResolvedValue({}) },
		organization: { updateMany: vi.fn().mockResolvedValue({}) },
	};
	mockPrisma.$transaction.mockImplementation(
		async (cb: (tx: typeof txMock) => unknown) => cb(txMock),
	);
	return txCreate;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('submitVolunteerApplication — source tracking', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Default org: marketplace-visible = true
		mockPrisma.organization.findUnique.mockResolvedValue({
			marketplaceVisible: true,
			firstApplicationReceivedAt: null,
			name: 'Test Org',
			members: [],
		});
		mockPrisma.volunteerOpportunity.findFirst.mockResolvedValue(null);
	});

	it('stores MARKETPLACE when source=MARKETPLACE and org is marketplace-visible', async () => {
		const txCreate = setupTransactionMock();
		mockPrisma.organization.findUnique.mockResolvedValue({
			marketplaceVisible: true,
		});

		await submitVolunteerApplication('org-1', {
			...BASE_PAYLOAD,
			source: 'MARKETPLACE' as const,
		} as Parameters<typeof submitVolunteerApplication>[1]);

		expect(txCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ source: 'MARKETPLACE' }),
			}),
		);
	});

	it('stores DIRECT when source=DIRECT is passed explicitly', async () => {
		const txCreate = setupTransactionMock();

		await submitVolunteerApplication('org-1', {
			...BASE_PAYLOAD,
			source: 'DIRECT' as const,
		} as Parameters<typeof submitVolunteerApplication>[1]);

		// DIRECT → no marketplaceVisible lookup (source validation is skipped)
		const marketplaceCalls =
			mockPrisma.organization.findUnique.mock.calls.filter(
				(call) =>
					(call[0] as { select?: { marketplaceVisible?: boolean } })?.select
						?.marketplaceVisible !== undefined,
			);
		expect(marketplaceCalls).toHaveLength(0);
		expect(txCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ source: 'DIRECT' }),
			}),
		);
	});

	it('downgrades MARKETPLACE to DIRECT when org is not marketplace-visible', async () => {
		const txCreate = setupTransactionMock();
		mockPrisma.organization.findUnique.mockResolvedValue({
			marketplaceVisible: false,
		});

		await submitVolunteerApplication('org-1', {
			...BASE_PAYLOAD,
			source: 'MARKETPLACE' as const,
		} as Parameters<typeof submitVolunteerApplication>[1]);

		expect(txCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ source: 'DIRECT' }),
			}),
		);
	});

	it('defaults to DIRECT when no source is provided', async () => {
		const txCreate = setupTransactionMock();

		await submitVolunteerApplication('org-1', {
			...BASE_PAYLOAD,
			source: undefined,
		} as Parameters<typeof submitVolunteerApplication>[1]);

		// No source → no marketplaceVisible lookup needed
		const marketplaceCalls =
			mockPrisma.organization.findUnique.mock.calls.filter(
				(call) =>
					(call[0] as { select?: { marketplaceVisible?: boolean } })?.select
						?.marketplaceVisible !== undefined,
			);
		expect(marketplaceCalls).toHaveLength(0);
		expect(txCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ source: 'DIRECT' }),
			}),
		);
	});
});

/**
 * The first of the three volunteer-initiated acts that lift an
 * `OrgVolunteerBlock`. This is the one with a condition on it, and the condition
 * is the whole control: `screener.submit` is a `publicProcedure` taking an
 * arbitrary `submittedByEmail`, so if an anonymous submission could lift a
 * block, anyone who can type a volunteer's address could hand the org back the
 * access that volunteer revoked.
 */
describe('submitVolunteerApplication — lifting an org block', () => {
	/** Same shape as setupTransactionMock, but hands back the tx handle too. */
	function setupTransactionCapture() {
		const txMock = {
			volunteerApplication: {
				create: vi.fn().mockResolvedValue({ id: 'app-1' }),
			},
			volunteerAnswer: { createMany: vi.fn().mockResolvedValue({}) },
			organization: { updateMany: vi.fn().mockResolvedValue({}) },
		};
		mockPrisma.$transaction.mockImplementation(
			async (cb: (tx: typeof txMock) => unknown) => cb(txMock),
		);
		return txMock;
	}

	beforeEach(() => {
		vi.clearAllMocks();
		mockPrisma.organization.findUnique.mockResolvedValue({
			marketplaceVisible: true,
			firstApplicationReceivedAt: null,
			name: 'Test Org',
			members: [],
		});
		mockPrisma.volunteerOpportunity.findFirst.mockResolvedValue(null);
	});

	it('lifts the block on the same tx handle as the application insert', async () => {
		const txMock = setupTransactionCapture();

		await submitVolunteerApplication('org-1', {
			...BASE_PAYLOAD,
			submittedByUserId: 'user-1',
		} as Parameters<typeof submitVolunteerApplication>[1]);

		// Escaping the tx would clear the block even when the submission that
		// justified it rolls back — access restored for an act that never happened.
		expect(mockLiftOrgVolunteerBlock).toHaveBeenCalledWith(
			txMock,
			'org-1',
			'user-1',
		);
	});

	it('SECURITY: an anonymous submission lifts nothing', async () => {
		setupTransactionCapture();

		await submitVolunteerApplication('org-1', {
			...BASE_PAYLOAD,
			submittedByUserId: null,
		} as Parameters<typeof submitVolunteerApplication>[1]);

		// The address on an anonymous application is attacker-supplied, so it must
		// never be the thing that clears a volunteer's standing refusal.
		expect(mockLiftOrgVolunteerBlock).not.toHaveBeenCalled();
	});
});
