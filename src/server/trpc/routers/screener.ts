import { z } from 'zod';
import { ApplicationStatus } from '@/prisma/generated/client';
import {
	screenerResponseSchema,
	volunteerProfileSchema,
} from '@/server/domain/volunteer-screening';
import { submitVolunteerApplication } from '@/server/services/volunteer-screening';
import {
	getApplicationDetail,
	listApplications,
} from '@/server/repositories/volunteer-applications';
import { getPublicFormByOrgSlug } from '@/server/repositories/publicApplyRepo';
import {
	adminProcedure,
	createTRPCRouter,
	publicProcedure,
} from '@/server/trpc/init';

export const screenerRouter = createTRPCRouter({
	getPublicForm: publicProcedure
		.input(z.object({ orgSlug: z.string().min(1) }))
		.query(async ({ input }) => {
			return getPublicFormByOrgSlug(input.orgSlug);
		}),
	submit: publicProcedure
		.input(
			z.object({
				orgId: z.string(),
				submittedByEmail: z.string().email(),
				profile: volunteerProfileSchema,
				responses: z.array(screenerResponseSchema),
			}),
		)
		.mutation(async ({ input }) => {
			return submitVolunteerApplication(input.orgId, {
				submittedByEmail: input.submittedByEmail,
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
			return listApplications(ctx.orgId, input.status, {
				page: input.page,
				pageSize: input.pageSize,
			});
		}),
	detail: adminProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			if (!ctx.orgId) {
				throw new Error('Missing org context');
			}
			return getApplicationDetail(ctx.orgId, input.id);
		}),
});
