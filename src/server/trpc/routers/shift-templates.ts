import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { getPlanLimits } from '@/server/domain/billing';
import {
	createShiftTemplateSchema,
	generateShiftsSchema,
	updateShiftTemplateSchema,
} from '@/server/domain/shift';
import {
	createNewTemplate,
	generateShiftsFromTemplate,
	getOrgTemplateCount,
	listOrgTemplates,
	removeTemplate,
	updateExistingTemplate,
} from '@/server/services/shiftTemplateService';
import {
	createTRPCRouter,
	planTierProcedure,
	requireUserId,
	staffProcedure,
} from '@/server/trpc/init';

export const shiftTemplatesRouter = createTRPCRouter({
	/** List all shift templates for the org. */
	list: staffProcedure.query(({ ctx }) => listOrgTemplates(ctx.orgId)),

	/** Create a new shift template. Plan-gated to STARTER+. */
	create: planTierProcedure('STARTER')
		.input(createShiftTemplateSchema)
		.mutation(async ({ ctx, input }) => {
			const limits = getPlanLimits(ctx.planTier);
			if (limits.maxShiftTemplates !== null) {
				const count = await getOrgTemplateCount(ctx.orgId);
				if (count >= limits.maxShiftTemplates) {
					throw new TRPCError({
						code: 'FORBIDDEN',
						message: `Your plan allows up to ${limits.maxShiftTemplates} shift templates. Upgrade to create more.`,
					});
				}
			}
			return createNewTemplate(
				{ ...input, orgId: ctx.orgId },
				requireUserId(ctx.session),
			);
		}),

	/** Update an existing template. */
	update: planTierProcedure('STARTER')
		.input(updateShiftTemplateSchema.extend({ id: z.string() }))
		.mutation(({ ctx, input }) =>
			updateExistingTemplate(input, ctx.orgId, requireUserId(ctx.session)),
		),

	/** Delete a template. */
	remove: planTierProcedure('STARTER')
		.input(z.object({ id: z.string() }))
		.mutation(({ ctx, input }) =>
			removeTemplate(input.id, ctx.orgId, requireUserId(ctx.session)),
		),

	/** Generate concrete shifts from a template for N weeks. */
	generate: planTierProcedure('STARTER')
		.input(generateShiftsSchema)
		.mutation(({ ctx, input }) =>
			generateShiftsFromTemplate(
				input.templateId,
				input.weeks,
				input.startDate,
				ctx.orgId,
				requireUserId(ctx.session),
			),
		),
});
