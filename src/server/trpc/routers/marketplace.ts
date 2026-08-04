import { z } from 'zod';
import {
	getThisWeekendOpportunities,
	listMarketplaceOrgs,
	searchMarketplaceOpportunities,
} from '@/server/repositories/publicOpportunityRepo';
import {
	getMyInterests,
	toggleInterest,
} from '@/server/services/marketplaceService';
import {
	createTRPCRouter,
	protectedProcedure,
	publicProcedure,
	requireUserId,
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
			return getMyInterests(requireUserId(ctx.session));
		}),

	/** Toggle interest on a marketplace opportunity. */
	toggleInterest: protectedProcedure
		.use(interestLimiter)
		.input(z.object({ opportunityId: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			return toggleInterest(requireUserId(ctx.session), input.opportunityId);
		}),
});
