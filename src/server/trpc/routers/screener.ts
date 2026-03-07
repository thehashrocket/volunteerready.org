import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { ApplicationStatus, Prisma, ScreenerQuestionType } from '@/prisma/generated/client';
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
	getOrgApplicationDetailEnriched,
	getPublicScreenerForm,
	listOrgApplications,
	updateOrgApplicationStatus,
} from '@/server/services/screener-queries';
import { generateSlug } from '@/lib/slug';
import * as qRepo from '@/server/repositories/screenerQuestionsRepo';

// ---------------------------------------------------------------------------
// configJson helpers
// ---------------------------------------------------------------------------

function buildConfigJson(input: {
	type: string;
	required: boolean;
	maxLength?: number;
	options?: string[];
	disqualifyIfFalse?: boolean;
	disqualifierReason?: string;
}): Record<string, unknown> {
	const base: Record<string, unknown> = { required: input.required };
	if (input.type === 'TEXT') {
		if (input.maxLength) base.maxLength = input.maxLength;
	} else if (input.type === 'BOOLEAN' && input.disqualifyIfFalse) {
		base.rules = {
			disqualifierRule: { operator: 'equals', value: false },
			reason: input.disqualifierReason ?? 'Disqualified.',
		};
	} else if (input.type === 'SINGLE_CHOICE') {
		base.options = input.options ?? [];
	}
	return base;
}

function buildConfigJsonPatch(
	input: {
		required?: boolean;
		maxLength?: number;
		options?: string[];
		disqualifyIfFalse?: boolean;
		disqualifierReason?: string;
	},
	type: string,
): Record<string, unknown> {
	const patch: Record<string, unknown> = {};
	if (input.required !== undefined) patch.required = input.required;
	if (type === 'TEXT' && input.maxLength !== undefined)
		patch.maxLength = input.maxLength;
	if (type === 'SINGLE_CHOICE' && input.options) patch.options = input.options;
	if (type === 'BOOLEAN' && input.disqualifyIfFalse !== undefined) {
		patch.rules = input.disqualifyIfFalse
			? {
					disqualifierRule: { operator: 'equals', value: false },
					reason: input.disqualifierReason ?? 'Disqualified.',
				}
			: null;
	}
	return patch;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const screenerRouter = createTRPCRouter({
	// ---- Volunteer-facing ----

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
			const result = await getOrgApplicationDetailEnriched(
				ctx.orgId,
				input.id,
			);
			if (!result) throw new TRPCError({ code: 'NOT_FOUND' });
			return result;
		}),

	updateApplicationStatus: adminProcedure
		.input(
			z.object({
				id: z.string().min(1),
				status: z.nativeEnum(ApplicationStatus),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			if (!ctx.orgId) {
				throw new Error('Missing org context');
			}
			return updateOrgApplicationStatus(ctx.orgId, input.id, input.status);
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

	// ---- Admin: question management ----

	listQuestions: adminProcedure.query(async ({ ctx }) => {
		return qRepo.listQuestions(ctx.orgId!);
	}),

	createQuestion: adminProcedure
		.input(
			z.object({
				prompt: z
					.string()
					.min(5, 'At least 5 characters')
					.max(500)
					.trim(),
				type: z.nativeEnum(ScreenerQuestionType),
				required: z.boolean().default(true),
				maxLength: z.number().int().positive().optional(),
				options: z.array(z.string().min(1)).min(2).optional(),
				disqualifyIfFalse: z.boolean().optional(),
				disqualifierReason: z.string().max(200).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const orgId = ctx.orgId!;
			const maxOrder = await qRepo.getMaxOrder(orgId);
			const key =
				generateSlug(input.prompt).slice(0, 50) ||
				`question-${Date.now()}`;
			return qRepo.createQuestion(orgId, {
				key,
				prompt: input.prompt,
				type: input.type,
				order: maxOrder + 10,
				configJson: buildConfigJson(input) as Prisma.InputJsonValue,
			});
		}),

	updateQuestion: adminProcedure
		.input(
			z.object({
				id: z.string().min(1),
				prompt: z.string().min(5).max(500).trim().optional(),
				required: z.boolean().optional(),
				maxLength: z.number().int().positive().optional(),
				options: z.array(z.string().min(1)).min(2).optional(),
				disqualifyIfFalse: z.boolean().optional(),
				disqualifierReason: z.string().max(200).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const orgId = ctx.orgId!;
			const question = await qRepo.getQuestion(orgId, input.id);
			if (!question) throw new TRPCError({ code: 'NOT_FOUND' });
			const existing = (question.configJson ?? {}) as Record<
				string,
				unknown
			>;
			const patch = buildConfigJsonPatch(input, question.type);
			return qRepo.updateQuestion(orgId, input.id, {
				...(input.prompt ? { prompt: input.prompt } : {}),
				configJson: { ...existing, ...patch } as Prisma.InputJsonValue,
			});
		}),

	setQuestionActive: adminProcedure
		.input(z.object({ id: z.string().min(1), isActive: z.boolean() }))
		.mutation(async ({ ctx, input }) => {
			return qRepo.updateQuestion(ctx.orgId!, input.id, {
				isActive: input.isActive,
			});
		}),

	moveQuestion: adminProcedure
		.input(
			z.object({
				id: z.string().min(1),
				direction: z.enum(['up', 'down']),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const orgId = ctx.orgId!;
			const question = await qRepo.getQuestion(orgId, input.id);
			if (!question) throw new TRPCError({ code: 'NOT_FOUND' });
			const adjacent = await qRepo.findAdjacentQuestion(
				orgId,
				question.order,
				input.direction,
			);
			if (!adjacent) return { moved: false };
			await qRepo.swapOrders(
				orgId,
				question.id,
				question.order,
				adjacent.id,
				adjacent.order,
			);
			return { moved: true };
		}),

	deleteQuestion: adminProcedure
		.input(z.object({ id: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const orgId = ctx.orgId!;
			const question = await qRepo.getQuestion(orgId, input.id);
			if (!question) throw new TRPCError({ code: 'NOT_FOUND' });
			if (await qRepo.questionHasAnswers(input.id)) {
				throw new TRPCError({
					code: 'PRECONDITION_FAILED',
					message:
						'This question has volunteer answers. Disable it instead of deleting.',
				});
			}
			await qRepo.deleteQuestion(orgId, input.id);
			return { deleted: true };
		}),
});
