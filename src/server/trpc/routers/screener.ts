import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { generateSlug } from '@/lib/slug';
import {
	ApplicationSource,
	ApplicationStatus,
	type Prisma,
	ScreenerQuestionType,
} from '@/prisma/generated/client';
import { volunteerEmailSchema } from '@/server/domain/org-volunteer';
import { screenerQuestionConfigSchema } from '@/server/domain/screener/configSchema';
import {
	screenerResponseSchema,
	volunteerProfileSchema,
} from '@/server/domain/volunteer-screening';
import * as qRepo from '@/server/repositories/screenerQuestionsRepo';
import {
	claimApplication,
	getMyApplicationDetail,
	getMyApplicationStatusTimeline,
	listClaimableApplications,
	listMyApplications,
} from '@/server/services/my-applications';
import {
	checkAnonymousEmailApplication,
	checkExistingApplicationForUser,
	dismissOnboardingChecklist,
	getAppliedOpportunitiesCrossOrg,
	getAppliedOpportunitiesForUser,
	getImpactReport,
	getOnboardingBaseline,
	getOrgActivityFeed,
	getOrgApplicationDetailEnriched,
	getOrgDashboardStats,
	getPublicScreenerForm,
	listOrgApplications,
	saveOnboardingBaseline,
	updateOrgApplicationStatus,
} from '@/server/services/screener-queries';
import { submitVolunteerApplication } from '@/server/services/volunteer-screening';
import {
	adminProcedure,
	createTRPCRouter,
	protectedProcedure,
	publicProcedure,
} from '@/server/trpc/init';
import {
	rateLimitByIp,
	rateLimitByUser,
} from '@/server/trpc/rate-limit-middleware';

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
	// Validate through the canonical schema before persisting
	return screenerQuestionConfigSchema.parse(base);
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
	existing: Record<string, unknown>,
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
	// Merge with existing config and validate through the canonical schema
	return screenerQuestionConfigSchema.parse({ ...existing, ...patch });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const screenerRouter = createTRPCRouter({
	// ---- Volunteer-facing ----

	submit: publicProcedure
		.use(
			rateLimitByIp({ limit: 3, windowSeconds: 60, prefix: 'screener:submit' }),
		)
		.input(
			z.object({
				orgId: z.string(),
				opportunityId: z.string().optional(),
				// Normalized on write so the stored value stays canonical. T1's
				// migration backfilled this column but installed its trigger on
				// `User` only, leaving this public path as the one writer that
				// could re-dirty it — which then forces every reader to choose
				// between missing rows and an unsafe ILIKE match.
				// `volunteerEmailSchema` rather than a bare `.email()`: it carries the
				// RFC 5321 254-char cap, and its own comment names this the one
				// unbounded write in an otherwise bounded schema set. This is a
				// publicProcedure, so an uncapped address is an unbounded row write.
				// It also trims before validating, so whitespace-padded input is
				// accepted rather than rejected.
				submittedByEmail: volunteerEmailSchema,
				profile: volunteerProfileSchema,
				responses: z.array(screenerResponseSchema),
				shareCredentials: z.boolean().optional(),
				source: z
					.enum([ApplicationSource.DIRECT, ApplicationSource.MARKETPLACE])
					.optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			if (ctx.sessionToken && !ctx.orgId) {
				await ctx.prisma.session.update({
					where: { sessionToken: ctx.sessionToken },
					data: { currentOrgId: input.orgId },
				});
			}

			const result = await submitVolunteerApplication(input.orgId, {
				submittedByEmail: input.submittedByEmail,
				submittedByUserId: ctx.session?.user?.id ?? null,
				opportunityId: input.opportunityId ?? null,
				profile: input.profile,
				responses: input.responses,
				source: input.source ?? null,
			});

			// "Bring my credentials" — share all verified creds with this org
			// Silently ignored for unauthenticated users (no userId to look up)
			// Skipped for duplicate submissions (no new application was created)
			// Wrapped in try/catch: credential sharing must not fail the application
			const isDuplicate = 'duplicate' in result && result.duplicate;
			const userId = ctx.session?.user?.id;
			if (input.shareCredentials && userId && !isDuplicate) {
				try {
					const { shareAllOnApply } = await import(
						'@/server/services/credentialShareService'
					);
					await shareAllOnApply(userId, input.orgId);
				} catch {
					console.error(
						'[screener.submit] shareAllOnApply failed — application was saved',
					);
				}
			}

			return result;
		}),

	list: adminProcedure
		.input(
			z.object({
				status: z.nativeEnum(ApplicationStatus).optional(),
				opportunityId: z.string().optional(),
				page: z.number().int().positive().optional(),
				pageSize: z.number().int().positive().max(200).optional(),
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
			const result = await getOrgApplicationDetailEnriched(ctx.orgId, input.id);
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
			return updateOrgApplicationStatus(
				ctx.orgId,
				input.id,
				input.status,
				ctx.session?.user?.id,
			);
		}),

	getDashboardStats: adminProcedure.query(async ({ ctx }) => {
		if (!ctx.orgId) {
			throw new Error('Missing org context');
		}
		return getOrgDashboardStats(ctx.orgId);
	}),

	dismissOnboardingChecklist: adminProcedure.mutation(async ({ ctx }) => {
		if (!ctx.orgId) {
			throw new Error('Missing org context');
		}
		return dismissOnboardingChecklist(ctx.orgId);
	}),

	getOnboardingBaseline: adminProcedure.query(async ({ ctx }) => {
		if (!ctx.orgId) {
			throw new Error('Missing org context');
		}
		return getOnboardingBaseline(ctx.orgId);
	}),

	saveOnboardingBaseline: adminProcedure
		.input(
			z.object({
				volunteerCount: z.number().min(0).max(10000),
				hoursPerWeek: z.number().min(0).max(168),
				currentProcess: z.string().max(1000),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			if (!ctx.orgId) {
				throw new Error('Missing org context');
			}
			return saveOnboardingBaseline(ctx.orgId, input);
		}),

	getImpactReport: adminProcedure.query(async ({ ctx }) => {
		if (!ctx.orgId) {
			throw new Error('Missing org context');
		}
		return getImpactReport(ctx.orgId);
	}),

	getActivityFeed: adminProcedure.query(async ({ ctx }) => {
		if (!ctx.orgId) {
			throw new Error('Missing org context');
		}
		return getOrgActivityFeed(ctx.orgId);
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
		return listMyApplications(userId);
	}),

	/**
	 * Anonymous applications submitted under this user's address, offered for
	 * explicit confirmation. Deliberately not auto-attached — see
	 * `listClaimableApplications()` for why.
	 */
	claimableApplications: protectedProcedure
		.use(
			rateLimitByUser({
				limit: 30,
				windowSeconds: 60,
				prefix: 'screener:claimable',
			}),
		)
		.query(async ({ ctx }) => {
			const userId = ctx.session?.user?.id;
			if (!userId) {
				throw new TRPCError({ code: 'UNAUTHORIZED' });
			}
			// Deliberately NOT ctx.session.user.email — see
			// listClaimableApplications. Under impersonation that address
			// belongs to the real admin, not to this id.
			return listClaimableApplications(userId);
		}),

	claimApplication: protectedProcedure
		.use(
			rateLimitByUser({
				limit: 10,
				windowSeconds: 60,
				prefix: 'screener:claim',
			}),
		)
		.input(z.object({ id: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session?.user?.id;
			if (!userId) {
				throw new TRPCError({ code: 'UNAUTHORIZED' });
			}
			return claimApplication(userId, input.id);
		}),

	myApplicationDetail: protectedProcedure
		.input(z.object({ id: z.string().min(1) }))
		.query(async ({ ctx, input }) => {
			const userId = ctx.session?.user?.id;
			if (!userId) {
				throw new Error('Missing session user');
			}
			return getMyApplicationDetail(userId, input.id);
		}),

	withdrawApplication: protectedProcedure
		.input(z.object({ id: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session?.user?.id;
			if (!userId) throw new TRPCError({ code: 'UNAUTHORIZED' });
			const { withdrawVolunteerApplication } = await import(
				'@/server/services/volunteerApplicationService'
			);
			return withdrawVolunteerApplication(userId, input.id);
		}),

	myApplicationTimeline: protectedProcedure
		.input(z.object({ id: z.string().min(1) }))
		.query(async ({ ctx, input }) => {
			const userId = ctx.session?.user?.id;
			if (!userId) {
				throw new Error('Missing session user');
			}
			return getMyApplicationStatusTimeline(userId, input.id);
		}),

	/**
	 * Check if the current user has already applied to a specific opportunity.
	 * Used by the apply form to show the interception card.
	 */
	checkExistingApplication: protectedProcedure
		.input(
			z.object({
				orgId: z.string().min(1),
				opportunityId: z.string().min(1),
			}),
		)
		.query(async ({ ctx, input }) => {
			const userId = ctx.session?.user?.id;
			if (!userId) return null;
			return checkExistingApplicationForUser(
				input.orgId,
				userId,
				input.opportunityId,
			);
		}),

	/**
	 * For a list of opportunity IDs, return which ones the user has already applied to.
	 * Used by the opportunities listing to show "Already Applied" badges.
	 */
	getMyAppliedOpportunities: protectedProcedure
		.use(
			rateLimitByUser({
				limit: 30,
				windowSeconds: 60,
				prefix: 'screener:applied',
			}),
		)
		.input(
			z.object({
				orgId: z.string().min(1),
				opportunityIds: z.array(z.string().min(1)).max(200),
			}),
		)
		.query(async ({ ctx, input }) => {
			const userId = ctx.session?.user?.id;
			if (!userId) return {};
			return getAppliedOpportunitiesForUser(
				input.orgId,
				userId,
				input.opportunityIds,
			);
		}),

	/**
	 * Check if an anonymous email has already been used to apply to an opportunity.
	 * Returns { exists: true } if found; null otherwise. Soft-block only.
	 */
	checkAnonymousApplication: publicProcedure
		.use(
			rateLimitByIp({
				limit: 10,
				windowSeconds: 60,
				prefix: 'screener:anon-dedup',
			}),
		)
		.input(
			z.object({
				orgId: z.string().min(1),
				// Must normalize to match `submit`, which now stores canonical.
				// This reader compares against stored rows by exact equality, so an
				// applicant typing `Jane@Example.com` would get no duplicate warning
				// and submit a second application — silently regressing the
				// duplicate-prevention control.
				email: volunteerEmailSchema,
				opportunityId: z.string().min(1),
			}),
		)
		.query(async ({ input }) => {
			return checkAnonymousEmailApplication(
				input.orgId,
				input.email,
				input.opportunityId,
			);
		}),

	/**
	 * Cross-org version: returns applied opportunities across all orgs.
	 * Used by /app/browse which shows opportunities from all organizations.
	 * Only returns the authenticated user's own data.
	 */
	getMyAppliedOpportunitiesCrossOrg: protectedProcedure
		.use(
			rateLimitByUser({
				limit: 30,
				windowSeconds: 60,
				prefix: 'screener:applied-cross',
			}),
		)
		.input(z.object({ opportunityIds: z.array(z.string().min(1)).max(200) }))
		.query(async ({ ctx, input }) => {
			const userId = ctx.session?.user?.id;
			if (!userId) return {};
			return getAppliedOpportunitiesCrossOrg(userId, input.opportunityIds);
		}),

	// ---- Admin: question management ----

	listQuestions: adminProcedure
		.input(
			z
				.object({
					cursor: z.string().optional(),
					limit: z.number().int().positive().max(100).optional(),
				})
				.optional(),
		)
		.query(async ({ ctx, input }) => {
			return qRepo.listQuestions(ctx.orgId, {
				cursor: input?.cursor,
				limit: input?.limit,
			});
		}),

	createQuestion: adminProcedure
		.input(
			z.object({
				prompt: z.string().min(5, 'At least 5 characters').max(500).trim(),
				type: z.nativeEnum(ScreenerQuestionType),
				required: z.boolean().default(true),
				maxLength: z.number().int().positive().optional(),
				options: z.array(z.string().min(1)).min(2).optional(),
				disqualifyIfFalse: z.boolean().optional(),
				disqualifierReason: z.string().max(200).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const orgId = ctx.orgId;
			const maxOrder = await qRepo.getMaxOrder(orgId);
			const key =
				generateSlug(input.prompt).slice(0, 50) || `question-${Date.now()}`;
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
			const orgId = ctx.orgId;
			const question = await qRepo.getQuestion(orgId, input.id);
			if (!question) throw new TRPCError({ code: 'NOT_FOUND' });
			const existing = (question.configJson ?? {}) as Record<string, unknown>;
			const validatedConfig = buildConfigJsonPatch(
				input,
				question.type,
				existing,
			);
			return qRepo.updateQuestion(orgId, input.id, {
				...(input.prompt ? { prompt: input.prompt } : {}),
				configJson: validatedConfig as Prisma.InputJsonValue,
			});
		}),

	setQuestionActive: adminProcedure
		.input(z.object({ id: z.string().min(1), isActive: z.boolean() }))
		.mutation(async ({ ctx, input }) => {
			return qRepo.updateQuestion(ctx.orgId, input.id, {
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
			const orgId = ctx.orgId;
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
			const orgId = ctx.orgId;
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
