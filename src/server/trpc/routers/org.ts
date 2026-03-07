import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { orgService } from '@/server/services/orgService';
import {
	createTRPCRouter,
	orgProcedure,
	protectedProcedure,
} from '@/server/trpc/init';

export const orgRouter = createTRPCRouter({
	getCurrentOrg: orgProcedure.query(async ({ ctx }) => {
		const orgId = ctx.orgId;
		if (!orgId) {
			throw new TRPCError({ code: 'FORBIDDEN' });
		}
		return ctx.prisma.organization.findUnique({
			where: { id: orgId },
		});
	}),
	listOrgs: protectedProcedure.query(async ({ ctx }) => {
		const userId = ctx.session?.user?.id;
		if (!userId) {
			throw new TRPCError({ code: 'UNAUTHORIZED' });
		}
		const memberships = await ctx.prisma.organizationMember.findMany({
			where: { userId },
			include: { organization: true },
		});

		return memberships.map((membership) => membership.organization);
	}),
	switchOrg: protectedProcedure
		.input(z.object({ orgId: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session?.user?.id;
			if (!userId) {
				throw new TRPCError({ code: 'UNAUTHORIZED' });
			}

			// We need the session token to update the DB Session row.
			const sessionToken = ctx.sessionToken;
			if (!sessionToken) {
				throw new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: 'Missing session token in tRPC context.',
				});
			}

			const svc = orgService(ctx.prisma);
			const result = await svc.switchOrgForSession({
				userId,
				sessionToken,
				targetOrgId: input.orgId,
			});

			return result; // { orgId, role }
		}),
});
