import { z } from 'zod';
import { ApplicationStatus } from '@/prisma/generated/client';
import {
	screenerResponseSchema,
	volunteerProfileSchema,
} from '@/server/domain/volunteer-screening';
import { submitVolunteerApplication } from '@/server/services/volunteer-screening';
import {
	adminProcedure,
	createTRPCRouter,
	protectedProcedure,
	publicProcedure,
} from '@/server/trpc/init';
import {
	getMyApplicationDetail,
	listMyApplications,
} from '@/server/services/my-applications';
import {
	getOrgApplicationDetail,
	getPublicScreenerForm,
	listOrgApplications,
} from '@/server/services/screener-queries';

export const screenerRouter = createTRPCRouter({
	submit: publicProcedure
		.input(
			z.object({
				orgId: z.string(),
				submittedByEmail: z.string().email(),
				profile: volunteerProfileSchema,
				responses: z.array(screenerResponseSchema),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			if (ctx.sessionToken && !ctx.orgId) {
				await ctx.prisma.session.update({
					where: { sessionToken: ctx.sessionToken },
					data: { currentOrgId: input.orgId },
				});
			}

			return submitVolunteerApplication(input.orgId, {
				submittedByEmail: input.submittedByEmail,
				submittedByUserId: ctx.session?.user?.id ?? null,
				profile: input.profile,
				responses: input.responses,
			});
		}),

	list: adminProcedure
		.input(
			z.object({
				status: z.nativeEnum(ApplicationStatus).optional(),
				page: z.number().int().positive().optional(),
				pageSize: z.number().int().positive().max(100).optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			if (!ctx.orgId) {
				throw new Error('Missing org context');
			}
			return listOrgApplications(ctx.orgId, input);
		}),
	detail: adminProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			if (!ctx.orgId) {
				throw new Error('Missing org context');
			}
			return getOrgApplicationDetail(ctx.orgId, input.id);
		}),
	getPublicForm: publicProcedure
		.input(z.object({ orgSlug: z.string().min(1) }))
		.query(async ({ input }) => {
			return getPublicScreenerForm(input.orgSlug);
		}),
	myApplications: protectedProcedure.query(async ({ ctx }) => {
		const userId = ctx.session?.user?.id;
		if (!userId) {
			throw new Error('Missing session user');
		}
		return listMyApplications(userId, ctx.session?.user?.email ?? null);
	}),
	myApplicationDetail: protectedProcedure
		.input(z.object({ id: z.string().min(1) }))
		.query(async ({ ctx, input }) => {
			const userId = ctx.session?.user?.id;
			if (!userId) {
				throw new Error('Missing session user');
			}
			return getMyApplicationDetail(
				userId,
				input.id,
				ctx.session?.user?.email ?? null,
			);
		}),
});
