import { z } from 'zod';
import {
	feedbackFilterSchema,
	feedbackSubmitSchema,
} from '@/server/domain/user-feedback';
import {
	getFeedbackStats,
	getMyFeedback,
	listFeedback,
	replyToFeedback,
	submitFeedback,
	updateFeedbackStatus,
} from '@/server/services/feedbackService';
import {
	createTRPCRouter,
	platformAdminProcedure,
	protectedProcedure,
	requireUserId,
} from '@/server/trpc/init';
import { rateLimitByUser } from '@/server/trpc/rate-limit-middleware';

export const feedbackRouter = createTRPCRouter({
	submit: protectedProcedure
		.use(
			rateLimitByUser({
				limit: 5,
				windowSeconds: 3600,
				prefix: 'feedback:submit',
			}),
		)
		.input(feedbackSubmitSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = requireUserId(ctx.session);
			return submitFeedback(userId, ctx.orgId ?? null, ctx.role ?? null, input);
		}),

	list: platformAdminProcedure
		.input(feedbackFilterSchema)
		.query(async ({ input }) => {
			return listFeedback(input);
		}),

	updateStatus: platformAdminProcedure
		.input(
			z.object({
				id: z.string(),
				status: z.enum(['NEW', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED']),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const userId = requireUserId(ctx.session);
			return updateFeedbackStatus(input.id, input.status, userId);
		}),

	reply: platformAdminProcedure
		.input(z.object({ id: z.string(), message: z.string().min(1).max(2000) }))
		.mutation(async ({ ctx, input }) => {
			const userId = requireUserId(ctx.session);
			return replyToFeedback(input.id, input.message, userId);
		}),

	myFeedback: protectedProcedure.query(async ({ ctx }) => {
		const userId = requireUserId(ctx.session);
		return getMyFeedback(userId);
	}),

	stats: platformAdminProcedure
		.input(z.object({ since: z.date().optional() }).optional())
		.query(async ({ input }) => {
			return getFeedbackStats(input?.since);
		}),
});
