import { z } from 'zod';
import { getOrgAnalyticsDashboard } from '@/server/services/orgAnalyticsService';
import { createTRPCRouter, planTierProcedure } from '@/server/trpc/init';

export const analyticsRouter = createTRPCRouter({
	/**
	 * Org analytics dashboard — PRO plan required.
	 *
	 * Returns funnel, retention, fill rate, and top volunteers for the
	 * selected period. Client handles the upgrade prompt when FORBIDDEN.
	 *
	 * @param days  Period in days (30 / 90 / 365). Omit or pass null for all-time.
	 */
	getDashboard: planTierProcedure('PRO')
		.input(
			z
				.object({
					days: z.number().int().positive().nullable().optional(),
				})
				.optional(),
		)
		.query(async ({ ctx, input }) => {
			const days = input?.days ?? 90;
			return getOrgAnalyticsDashboard(ctx.orgId, days === 0 ? null : days);
		}),
});
