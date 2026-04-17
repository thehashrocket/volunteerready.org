import {
	createDefaultQuestionInput,
	createSkillFamilyInput,
	createSkillInput,
	updateDefaultQuestionInput,
	updateSkillFamilyInput,
	updateSkillInput,
} from '@/server/domain/platform-catalog';
import {
	createDefaultQuestion,
	createSkill,
	createSkillFamily,
	getCatalog,
	getDefaultQuestions,
	updateDefaultQuestion,
	updateSkill,
	updateSkillFamily,
} from '@/server/services/platformCatalogService';
import {
	createTRPCRouter,
	platformAdminProcedure,
	requireRealUserId,
} from '@/server/trpc/init';

export const platformCatalogRouter = createTRPCRouter({
	getCatalog: platformAdminProcedure.query(async () => {
		return getCatalog();
	}),
	getDefaultQuestions: platformAdminProcedure.query(async () => {
		return getDefaultQuestions();
	}),

	createFamily: platformAdminProcedure
		.input(createSkillFamilyInput)
		.mutation(async ({ ctx, input }) => {
			const actorId = requireRealUserId(ctx);
			return createSkillFamily({ ...input, actorId });
		}),
	updateFamily: platformAdminProcedure
		.input(updateSkillFamilyInput)
		.mutation(async ({ ctx, input }) => {
			const actorId = requireRealUserId(ctx);
			return updateSkillFamily({ ...input, actorId });
		}),

	createSkill: platformAdminProcedure
		.input(createSkillInput)
		.mutation(async ({ ctx, input }) => {
			const actorId = requireRealUserId(ctx);
			return createSkill({ ...input, actorId });
		}),
	updateSkill: platformAdminProcedure
		.input(updateSkillInput)
		.mutation(async ({ ctx, input }) => {
			const actorId = requireRealUserId(ctx);
			return updateSkill({ ...input, actorId });
		}),

	createDefaultQuestion: platformAdminProcedure
		.input(createDefaultQuestionInput)
		.mutation(async ({ ctx, input }) => {
			const actorId = requireRealUserId(ctx);
			return createDefaultQuestion({ ...input, actorId });
		}),
	updateDefaultQuestion: platformAdminProcedure
		.input(updateDefaultQuestionInput)
		.mutation(async ({ ctx, input }) => {
			const actorId = requireRealUserId(ctx);
			return updateDefaultQuestion({ ...input, actorId });
		}),
});
