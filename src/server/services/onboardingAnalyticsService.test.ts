/**
 * Unit tests for onboardingAnalyticsService.
 *
 * Prisma is mocked — tests verify funnel computation, step completion
 * mapping, and edge cases (zero orgs, partial completion).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoist mocks
// ---------------------------------------------------------------------------

const mockCountOrgsWithPopulatedRoster = vi.hoisted(() => vi.fn());

const mockPrisma = vi.hoisted(() => ({
	organization: {
		count: vi.fn(),
		findMany: vi.fn(),
	},
}));

vi.mock('@/server/repositories/prisma', () => ({
	prisma: mockPrisma,
}));

vi.mock('@/server/repositories/rosterMetricsRepo', () => ({
	countOrgsWithPopulatedRoster: mockCountOrgsWithPopulatedRoster,
}));

import {
	ROSTER_ACTIVATION_WINDOW_DAYS,
	ROSTER_POPULATED_THRESHOLD,
} from '@/server/domain/org-volunteer';
import { getOnboardingFunnel } from './onboardingAnalyticsService';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const RECENT_ORG = {
	id: 'org-1',
	name: 'Test Org',
	slug: 'test-org',
	createdAt: new Date('2026-03-01'),
	firstApplicationReceivedAt: new Date('2026-03-10'),
	_count: {
		screenerQuestions: 2,
		opportunities: 1,
		orgVolunteers: ROSTER_POPULATED_THRESHOLD,
	},
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
	vi.clearAllMocks();

	// Default: 0 orgs
	mockPrisma.organization.count.mockResolvedValue(0);
	mockPrisma.organization.findMany.mockResolvedValue([]);
	mockCountOrgsWithPopulatedRoster.mockResolvedValue(0);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getOnboardingFunnel', () => {
	it('returns zero counts when no orgs exist', async () => {
		const result = await getOnboardingFunnel();

		expect(result.funnel).toEqual([
			{ step: 1, label: 'Account created', count: 0 },
			{ step: 2, label: 'Screener set up', count: 0 },
			{ step: 3, label: 'Opportunity published', count: 0 },
			{ step: 4, label: 'First application received', count: 0 },
			{
				step: 5,
				label: `Roster populated (${ROSTER_POPULATED_THRESHOLD}+)`,
				count: 0,
			},
		]);
		expect(result.orgDetails).toEqual([]);
	});

	it('returns correct funnel counts', async () => {
		// 4 calls to count: total, with screener, with opportunity, with application
		mockPrisma.organization.count
			.mockResolvedValueOnce(10) // total orgs
			.mockResolvedValueOnce(7) // with screener
			.mockResolvedValueOnce(5) // with opportunity
			.mockResolvedValueOnce(3); // with application
		// Step 5 does not come from organization.count — it needs a HAVING over a
		// grouped join, so it lives in rosterMetricsRepo.
		mockCountOrgsWithPopulatedRoster.mockResolvedValue(2);

		mockPrisma.organization.findMany.mockResolvedValue([]);

		const result = await getOnboardingFunnel();

		expect(result.funnel[0].count).toBe(10);
		expect(result.funnel[1].count).toBe(7);
		expect(result.funnel[2].count).toBe(5);
		expect(result.funnel[3].count).toBe(3);
		expect(result.funnel[4].count).toBe(2);
	});

	describe('roster activation — the launch success metric', () => {
		it('is measured separately from step 5, and more narrowly', async () => {
			// Step 5 asks "did this roster ever fill up?". The success metric asks
			// "did the concierge motion work?" — STAFF_ADDED rows only, inside the
			// first week. Reporting one as the other would make the metric look
			// met by orgs whose roster filled from approved applications months in.
			mockPrisma.organization.count.mockResolvedValue(10);
			mockCountOrgsWithPopulatedRoster
				.mockResolvedValueOnce(6) // step 5: any source, any time
				.mockResolvedValueOnce(2); // activation: STAFF_ADDED within 7 days

			const result = await getOnboardingFunnel();

			expect(result.funnel[4].count).toBe(6);
			// No `totalOrgs`: pairing this numerator with an all-time org count
			// rendered as a rate that deflates regardless of whether the concierge
			// motion works. See the service comment.
			expect(result.rosterActivation).toEqual({
				orgs: 2,
				threshold: ROSTER_POPULATED_THRESHOLD,
				withinDays: ROSTER_ACTIVATION_WINDOW_DAYS,
			});
		});

		it('asks the repository for exactly the metric the design doc defines', async () => {
			await getOnboardingFunnel();
			expect(mockCountOrgsWithPopulatedRoster).toHaveBeenCalledWith({
				threshold: ROSTER_POPULATED_THRESHOLD,
				source: 'STAFF_ADDED',
				withinDaysOfSignup: ROSTER_ACTIVATION_WINDOW_DAYS,
			});
		});
	});

	it('computes stepsCompleted for orgs with all 5 steps done', async () => {
		mockPrisma.organization.count.mockResolvedValue(1);
		mockPrisma.organization.findMany.mockResolvedValue([RECENT_ORG]);

		const result = await getOnboardingFunnel();

		expect(result.orgDetails[0].stepsCompleted).toBe(5);
		expect(result.orgDetails[0].hasScreener).toBe(true);
		expect(result.orgDetails[0].hasOpportunity).toBe(true);
		expect(result.orgDetails[0].hasApplication).toBe(true);
		expect(result.orgDetails[0].hasRoster).toBe(true);
	});

	it('needs the full threshold to count the roster step, not one row', async () => {
		mockPrisma.organization.count.mockResolvedValue(1);
		mockPrisma.organization.findMany.mockResolvedValue([
			{
				...RECENT_ORG,
				_count: {
					...RECENT_ORG._count,
					orgVolunteers: ROSTER_POPULATED_THRESHOLD - 1,
				},
			},
		]);

		const result = await getOnboardingFunnel();

		expect(result.orgDetails[0].hasRoster).toBe(false);
		expect(result.orgDetails[0].rosterVolunteerCount).toBe(
			ROSTER_POPULATED_THRESHOLD - 1,
		);
		expect(result.orgDetails[0].stepsCompleted).toBe(4);
	});

	it('computes stepsCompleted for orgs with partial completion', async () => {
		const partialOrg = {
			...RECENT_ORG,
			firstApplicationReceivedAt: null,
			_count: { screenerQuestions: 1, opportunities: 0, orgVolunteers: 0 },
		};
		mockPrisma.organization.count.mockResolvedValue(1);
		mockPrisma.organization.findMany.mockResolvedValue([partialOrg]);

		const result = await getOnboardingFunnel();

		// account created + screener = 2 steps
		expect(result.orgDetails[0].stepsCompleted).toBe(2);
		expect(result.orgDetails[0].hasScreener).toBe(true);
		expect(result.orgDetails[0].hasOpportunity).toBe(false);
		expect(result.orgDetails[0].hasApplication).toBe(false);
	});

	it('computes stepsCompleted=1 for brand new orgs', async () => {
		const newOrg = {
			...RECENT_ORG,
			firstApplicationReceivedAt: null,
			_count: { screenerQuestions: 0, opportunities: 0, orgVolunteers: 0 },
		};
		mockPrisma.organization.count.mockResolvedValue(1);
		mockPrisma.organization.findMany.mockResolvedValue([newOrg]);

		const result = await getOnboardingFunnel();

		// Only account created = 1 step
		expect(result.orgDetails[0].stepsCompleted).toBe(1);
		expect(result.orgDetails[0].hasScreener).toBe(false);
	});
});
