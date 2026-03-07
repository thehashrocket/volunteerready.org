import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { orgService } from '@/server/services/orgService';
import { createTRPCRouter, protectedProcedure } from '@/server/trpc/init';

export const onboardingRouter = createTRPCRouter({
	createOrg: protectedProcedure
		.input(
			z.object({
				name: z
					.string()
					.min(2, 'Organization name must be at least 2 characters')
					.max(100, 'Organization name must be 100 characters or fewer')
					.trim(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session?.user?.id;
			if (!userId) {
				throw new TRPCError({ code: 'UNAUTHORIZED' });
			}

			const sessionToken = ctx.sessionToken;
			if (!sessionToken) {
				throw new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: 'Missing session token.',
				});
			}

			return orgService(ctx.prisma).createOrg({
				name: input.name,
				userId,
				sessionToken,
			});
		}),
});
