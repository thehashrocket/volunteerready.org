import { z } from 'zod';
import { prisma } from '@/server/repositories/prisma';
import { reconcileStripeEvents } from '@/server/services/billingService';
import { createTRPCRouter, platformAdminProcedure } from '@/server/trpc/init';

export const adminRouter = createTRPCRouter({
	/**
	 * Cron health dashboard: recent runs for all cron jobs.
	 */
	cronHealth: platformAdminProcedure.query(async () => {
		const recentRuns = await prisma.cronJobRun.findMany({
			orderBy: { startedAt: 'desc' },
			take: 50,
		});

		// Group by job name to get latest run per job
		const jobMap = new Map<string, (typeof recentRuns)[0]>();
		for (const run of recentRuns) {
			if (!jobMap.has(run.jobName)) {
				jobMap.set(run.jobName, run);
			}
		}

		// Check for consecutive failures (alerting threshold = 3)
		const failureCounts = new Map<string, number>();
		for (const run of recentRuns) {
			const key = run.jobName;
			if (run.status === 'FAILURE') {
				failureCounts.set(key, (failureCounts.get(key) ?? 0) + 1);
			} else {
				// Reset on success — we only care about consecutive failures
				if (!failureCounts.has(key)) {
					failureCounts.set(key, 0);
				}
				break;
			}
		}

		return {
			latestByJob: Object.fromEntries(jobMap),
			recentRuns,
			alerts: Array.from(failureCounts.entries())
				.filter(([, count]) => count >= 3)
				.map(([jobName, count]) => ({
					jobName,
					consecutiveFailures: count,
				})),
		};
	}),

	/**
	 * Stripe reconciliation: replay missed webhook events.
	 */
	stripeReconcile: platformAdminProcedure
		.input(
			z.object({
				windowHours: z.number().min(1).max(720).default(24),
			}),
		)
		.mutation(async ({ input }) => {
			return reconcileStripeEvents({
				windowHours: input.windowHours,
			});
		}),
});
