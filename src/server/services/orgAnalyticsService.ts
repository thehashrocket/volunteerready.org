/**
 * Org Analytics Service — orchestrates dashboard aggregate queries.
 *
 * Architecture:
 *   analyticsRouter (tRPC)
 *     └─→ getOrgAnalyticsDashboard(orgId, days)
 *           ├─→ getApplicationFunnel()    [parallel]
 *           ├─→ getRetentionStats()       [parallel, null for all-time]
 *           ├─→ getAvgFillRate()          [parallel]
 *           └─→ getTopVolunteers()        [parallel]
 */

import {
	type ApplicationFunnelStats,
	getApplicationFunnel,
	getAvgFillRate,
	getRetentionStats,
	getTopVolunteers,
	type RetentionStats,
	type TopVolunteerRow,
} from '@/server/repositories/orgAnalyticsRepo';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type OrgAnalyticsDashboard = {
	funnel: ApplicationFunnelStats;
	/**
	 * Null when days is null (all-time) — retention comparison requires a
	 * defined period boundary to compute "returning" meaningfully.
	 */
	retention: RetentionStats | null;
	/** Average fill rate across non-cancelled shifts, 0–100 integer. */
	avgFillRate: number;
	topVolunteers: TopVolunteerRow[];
	/** Selected period in days; null = all-time. */
	days: number | null;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Epoch: used as fromDate for all-time queries to include all records. */
const ALL_TIME_EPOCH = new Date(0);

const DAYS_TO_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Fetch all analytics data for the org dashboard in parallel.
 *
 * @param orgId  The organization to report on.
 * @param days   Number of days back to include; null = all-time.
 */
export async function getOrgAnalyticsDashboard(
	orgId: string,
	days: number | null,
): Promise<OrgAnalyticsDashboard> {
	const fromDate =
		days !== null ? new Date(Date.now() - days * DAYS_TO_MS) : ALL_TIME_EPOCH;

	const [funnel, retention, avgFillRate, topVolunteers] = await Promise.all([
		getApplicationFunnel(orgId, fromDate),
		// Retention comparison is undefined for all-time (no "prior period").
		days !== null ? getRetentionStats(orgId, fromDate) : Promise.resolve(null),
		getAvgFillRate(orgId, fromDate),
		getTopVolunteers(orgId, 10, fromDate),
	]);

	return {
		funnel,
		retention,
		avgFillRate,
		topVolunteers,
		days,
	};
}
