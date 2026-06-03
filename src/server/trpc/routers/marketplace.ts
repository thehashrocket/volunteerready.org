import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { Prisma } from '@/prisma/generated/client';
import {
	getThisWeekendOpportunities,
	listMarketplaceOrgs,
	searchMarketplaceOpportunities,
} from '@/server/repositories/publicOpportunityRepo';
import {
	createTRPCRouter,
	protectedProcedure,
	publicProcedure,
} from '@/server/trpc/init';
import {
	rateLimitByIp,
	rateLimitByUser,
} from '@/server/trpc/rate-limit-middleware';

const browseLimiter = rateLimitByIp({
	limit: 120,
	windowSeconds: 60,
	prefix: 'marketplace:browse',
});

const interestLimiter = rateLimitByUser({
	limit: 60,
	windowSeconds: 60,
	prefix: 'marketplace:interest',
});

export const marketplaceRouter = createTRPCRouter({
	/** Search or browse marketplace opportunities with cursor pagination. */
	searchOpportunities: publicProcedure
		.use(browseLimiter)
		.input(
			z.object({
				query: z.string().max(200).optional(),
				cursor: z.string().optional(),
				isRemote: z.boolean().optional(),
				limit: z.number().int().min(1).max(50).optional(),
			}),
		)
		.query(async ({ input }) => {
			return searchMarketplaceOpportunities(input);
		}),

	/** Fetch opportunities starting in the next 3 days ("This Weekend" section). */
	getThisWeekend: publicProcedure.use(browseLimiter).query(async () => {
		return getThisWeekendOpportunities();
	}),

	/** List marketplace-visible organizations with cursor pagination. */
	getOrganizations: publicProcedure
		.use(browseLimiter)
		.input(
			z.object({
				cursor: z.string().optional(),
				verified: z.boolean().optional(),
				location: z.string().max(100).optional(),
				limit: z.number().int().min(1).max(50).optional(),
			}),
		)
		.query(async ({ input }) => {
			return listMarketplaceOrgs(input);
		}),

	/** Return the set of marketplace-visible PUBLISHED opportunityIds the current user has expressed interest in. */
	getMyInterests: protectedProcedure
		.use(interestLimiter)
		.query(async ({ ctx }) => {
			const userId = ctx.session.user.id;
			const rows = await ctx.prisma.opportunityInterest.findMany({
				where: {
					userId,
					opportunity: {
						status: 'PUBLISHED',
						organization: { marketplaceVisible: true },
					},
				},
				select: { opportunityId: true },
			});
			return rows.map((r) => r.opportunityId);
		}),

	/**
	 * Toggle interest on a marketplace opportunity.
	 * Only allows interest on PUBLISHED opportunities in marketplace-visible orgs.
	 * P2002/P2025 errors are caught to handle concurrent toggle races gracefully.
	 */
	toggleInterest: protectedProcedure
		.use(interestLimiter)
		.input(z.object({ opportunityId: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			// Verify the opportunity is visible on the marketplace before recording interest
			const opportunity = await ctx.prisma.volunteerOpportunity.findFirst({
				where: {
					id: input.opportunityId,
					status: 'PUBLISHED',
					organization: { marketplaceVisible: true },
				},
				select: { id: true },
			});
			if (!opportunity) {
				throw new TRPCError({
					code: 'NOT_FOUND',
					message: 'Opportunity not found on marketplace.',
				});
			}

			const existing = await ctx.prisma.opportunityInterest.findUnique({
				where: {
					userId_opportunityId: { userId, opportunityId: input.opportunityId },
				},
			});
			if (existing) {
				try {
					await ctx.prisma.opportunityInterest.delete({
						where: {
							userId_opportunityId: {
								userId,
								opportunityId: input.opportunityId,
							},
						},
					});
				} catch (e) {
					// P2025: concurrent request already deleted it — still idempotently "not interested"
					if (
						!(
							e instanceof Prisma.PrismaClientKnownRequestError &&
							e.code === 'P2025'
						)
					)
						throw e;
				}
				return { interested: false };
			}
			try {
				await ctx.prisma.opportunityInterest.create({
					data: { userId, opportunityId: input.opportunityId },
				});
			} catch (e) {
				// P2002: concurrent request already created it — still idempotently "interested"
				if (
					!(
						e instanceof Prisma.PrismaClientKnownRequestError &&
						e.code === 'P2002'
					)
				)
					throw e;
			}
			return { interested: true };
		}),
});
