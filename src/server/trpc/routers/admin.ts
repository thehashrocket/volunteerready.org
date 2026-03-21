import { z } from 'zod';
import { prisma } from '@/server/repositories/prisma';
import { reconcileStripeEvents } from '@/server/services/billingService';
import { getOnboardingFunnel } from '@/server/services/onboardingAnalyticsService';
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

		// Check for consecutive failures per job (alerting threshold = 3).
		// Runs are sorted newest-first. Count failures until the first success per job.
		const failureCounts = new Map<string, number>();
		const settled = new Set<string>();
		for (const run of recentRuns) {
			const key = run.jobName;
			if (settled.has(key)) continue;
			if (run.status === 'FAILURE') {
				failureCounts.set(key, (failureCounts.get(key) ?? 0) + 1);
			} else {
				failureCounts.set(key, 0);
				settled.add(key);
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

	/**
	 * Webhook health: aggregate event counts per provider over a rolling window.
	 * Uses a dynamic provider config array — add new providers to WEBHOOK_PROVIDERS above.
	 */
	webhookHealth: platformAdminProcedure
		.input(
			z
				.object({
					windowHours: z.number().min(1).max(720).default(24),
				})
				.default({ windowHours: 24 }),
		)
		.query(async ({ input }) => {
			const since = new Date(Date.now() - input.windowHours * 60 * 60 * 1000);

			const [stripeEvents, checkrEvents, resendEvents] = await Promise.all([
				prisma.stripeWebhookEvent.groupBy({
					by: ['type'],
					where: { processedAt: { gte: since } },
					_count: { id: true },
				}),
				prisma.checkrWebhookEvent.groupBy({
					by: ['type'],
					where: { processedAt: { gte: since } },
					_count: { id: true },
				}),
				prisma.emailEvent.groupBy({
					by: ['eventType'],
					where: { createdAt: { gte: since } },
					_count: { id: true },
				}),
			]);

			const providers = [
				{
					key: 'stripe',
					label: 'Stripe',
					total: stripeEvents.reduce((s, e) => s + e._count.id, 0),
					byType: Object.fromEntries(
						stripeEvents.map((e) => [e.type, e._count.id]),
					),
				},
				{
					key: 'checkr',
					label: 'Checkr',
					total: checkrEvents.reduce((s, e) => s + e._count.id, 0),
					byType: Object.fromEntries(
						checkrEvents.map((e) => [e.type, e._count.id]),
					),
				},
				{
					key: 'resend',
					label: 'Resend',
					total: resendEvents.reduce((s, e) => s + e._count.id, 0),
					byType: Object.fromEntries(
						resendEvents.map((e) => [e.eventType, e._count.id]),
					),
				},
			];

			return { providers, windowHours: input.windowHours };
		}),

	/**
	 * Email bounce management: list suppressed addresses.
	 */
	bouncedEmails: platformAdminProcedure.query(async () => {
		return prisma.emailBounceStatus.findMany({
			where: { suppressedAt: { not: null } },
			orderBy: { lastBouncedAt: 'desc' },
		});
	}),

	/**
	 * Re-enable a single suppressed email address (resets bounceCount and suppressedAt).
	 */
	reEnableBounce: platformAdminProcedure
		.input(z.object({ email: z.string().email() }))
		.mutation(async ({ input }) => {
			return prisma.emailBounceStatus.update({
				where: { email: input.email.toLowerCase() },
				data: { bounceCount: 0, suppressedAt: null },
			});
		}),

	/**
	 * Reset ALL suppressed email addresses (platform admin override).
	 */
	resetAllBounces: platformAdminProcedure.mutation(async () => {
		const result = await prisma.emailBounceStatus.updateMany({
			where: { suppressedAt: { not: null } },
			data: { bounceCount: 0, suppressedAt: null },
		});
		return { count: result.count };
	}),

	/**
	 * Onboarding funnel analytics: how many orgs have completed each step.
	 */
	onboardingFunnel: platformAdminProcedure.query(() => getOnboardingFunnel()),
});
