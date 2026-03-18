/**
 * Unit tests for orgAnalyticsService.
 *
 * All repo functions are mocked — tests verify orchestration logic:
 * - dates are computed correctly from `days`
 * - retention is skipped (null) when days is null (all-time)
 * - all 4 queries run in parallel and the result is assembled correctly
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoist mocks
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
	getApplicationFunnel: vi.fn(),
	getRetentionStats: vi.fn(),
	getAvgFillRate: vi.fn(),
	getTopVolunteers: vi.fn(),
}));

vi.mock('@/server/repositories/orgAnalyticsRepo', () => ({
	getApplicationFunnel: mocks.getApplicationFunnel,
	getRetentionStats: mocks.getRetentionStats,
	getAvgFillRate: mocks.getAvgFillRate,
	getTopVolunteers: mocks.getTopVolunteers,
}));

import { getOrgAnalyticsDashboard } from './orgAnalyticsService';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ORG_ID = 'org-test-123';

const EMPTY_FUNNEL = {
	submitted: 0,
	approved: 0,
	shifted: 0,
	credentialed: 0,
};

const EMPTY_RETENTION = {
	activeVolunteers: 0,
	returningVolunteers: 0,
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
	vi.clearAllMocks();
	mocks.getApplicationFunnel.mockResolvedValue(EMPTY_FUNNEL);
	mocks.getRetentionStats.mockResolvedValue(EMPTY_RETENTION);
	mocks.getAvgFillRate.mockResolvedValue(0);
	mocks.getTopVolunteers.mockResolvedValue([]);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getOrgAnalyticsDashboard', () => {
	describe('days = null (all-time)', () => {
		it('calls getApplicationFunnel with epoch date (new Date(0))', async () => {
			await getOrgAnalyticsDashboard(ORG_ID, null);

			const [, fromDate] = mocks.getApplicationFunnel.mock.calls[0];
			expect(fromDate.getTime()).toBe(0);
		});

		it('does NOT call getRetentionStats — retention is undefined for all-time', async () => {
			await getOrgAnalyticsDashboard(ORG_ID, null);

			expect(mocks.getRetentionStats).not.toHaveBeenCalled();
		});

		it('returns retention = null', async () => {
			const result = await getOrgAnalyticsDashboard(ORG_ID, null);

			expect(result.retention).toBeNull();
		});

		it('returns days = null in the result', async () => {
			const result = await getOrgAnalyticsDashboard(ORG_ID, null);

			expect(result.days).toBeNull();
		});
	});

	describe('days = 30 (30-day window)', () => {
		it('calls getRetentionStats with the same fromDate as the funnel', async () => {
			const before = Date.now();
			await getOrgAnalyticsDashboard(ORG_ID, 30);
			const after = Date.now();

			expect(mocks.getRetentionStats).toHaveBeenCalledOnce();
			const [, fromDate] = mocks.getRetentionStats.mock.calls[0];
			const expectedMs = 30 * 24 * 60 * 60 * 1000;
			// fromDate should be ~30 days ago
			expect(fromDate.getTime()).toBeGreaterThanOrEqual(before - expectedMs);
			expect(fromDate.getTime()).toBeLessThanOrEqual(after - expectedMs + 100);
		});

		it('returns retention from the repo', async () => {
			const retention = { activeVolunteers: 5, returningVolunteers: 3 };
			mocks.getRetentionStats.mockResolvedValue(retention);

			const result = await getOrgAnalyticsDashboard(ORG_ID, 30);

			expect(result.retention).toEqual(retention);
		});

		it('returns days = 30 in the result', async () => {
			const result = await getOrgAnalyticsDashboard(ORG_ID, 30);

			expect(result.days).toBe(30);
		});
	});

	describe('result assembly', () => {
		it('assembles all 4 repo results into the dashboard shape', async () => {
			const funnel = {
				submitted: 10,
				approved: 7,
				shifted: 5,
				credentialed: 3,
			};
			const retention = { activeVolunteers: 8, returningVolunteers: 4 };
			const avgFillRate = 72;
			const topVolunteers = [
				{
					userId: 'u1',
					displayName: 'Alice',
					totalHours: 12.5,
					verifiedCredentialCount: 2,
					lastActiveAt: new Date('2026-01-15'),
				},
			];

			mocks.getApplicationFunnel.mockResolvedValue(funnel);
			mocks.getRetentionStats.mockResolvedValue(retention);
			mocks.getAvgFillRate.mockResolvedValue(avgFillRate);
			mocks.getTopVolunteers.mockResolvedValue(topVolunteers);

			const result = await getOrgAnalyticsDashboard(ORG_ID, 90);

			expect(result).toEqual({
				funnel,
				retention,
				avgFillRate,
				topVolunteers,
				days: 90,
			});
		});

		it('calls getTopVolunteers with orgId, limit=10, and fromDate', async () => {
			await getOrgAnalyticsDashboard(ORG_ID, 30);

			expect(mocks.getTopVolunteers).toHaveBeenCalledWith(
				ORG_ID,
				10,
				expect.any(Date),
			);
		});
	});

	describe('parallel execution', () => {
		it('calls all 4 repo functions for a date-range query', async () => {
			await getOrgAnalyticsDashboard(ORG_ID, 90);

			expect(mocks.getApplicationFunnel).toHaveBeenCalledOnce();
			expect(mocks.getRetentionStats).toHaveBeenCalledOnce();
			expect(mocks.getAvgFillRate).toHaveBeenCalledOnce();
			expect(mocks.getTopVolunteers).toHaveBeenCalledOnce();
		});

		it('calls only 3 repo functions for all-time (retention skipped)', async () => {
			await getOrgAnalyticsDashboard(ORG_ID, null);

			expect(mocks.getApplicationFunnel).toHaveBeenCalledOnce();
			expect(mocks.getRetentionStats).not.toHaveBeenCalled();
			expect(mocks.getAvgFillRate).toHaveBeenCalledOnce();
			expect(mocks.getTopVolunteers).toHaveBeenCalledOnce();
		});
	});
});
