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

const mockPrisma = vi.hoisted(() => ({
	organization: {
		count: vi.fn(),
		findMany: vi.fn(),
	},
}));

vi.mock('@/server/repositories/prisma', () => ({
	prisma: mockPrisma,
}));

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

		mockPrisma.organization.findMany.mockResolvedValue([]);

		const result = await getOnboardingFunnel();

		expect(result.funnel[0].count).toBe(10);
		expect(result.funnel[1].count).toBe(7);
		expect(result.funnel[2].count).toBe(5);
		expect(result.funnel[3].count).toBe(3);
	});

	it('computes stepsCompleted for orgs with all 4 steps done', async () => {
		mockPrisma.organization.count.mockResolvedValue(1);
		mockPrisma.organization.findMany.mockResolvedValue([RECENT_ORG]);

		const result = await getOnboardingFunnel();

		expect(result.orgDetails[0].stepsCompleted).toBe(4);
		expect(result.orgDetails[0].hasScreener).toBe(true);
		expect(result.orgDetails[0].hasOpportunity).toBe(true);
		expect(result.orgDetails[0].hasApplication).toBe(true);
	});

	it('computes stepsCompleted for orgs with partial completion', async () => {
		const partialOrg = {
			...RECENT_ORG,
			firstApplicationReceivedAt: null,
			_count: { screenerQuestions: 1, opportunities: 0 },
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
			_count: { screenerQuestions: 0, opportunities: 0 },
		};
		mockPrisma.organization.count.mockResolvedValue(1);
		mockPrisma.organization.findMany.mockResolvedValue([newOrg]);

		const result = await getOnboardingFunnel();

		// Only account created = 1 step
		expect(result.orgDetails[0].stepsCompleted).toBe(1);
		expect(result.orgDetails[0].hasScreener).toBe(false);
	});
});
