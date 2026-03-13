import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { listSkillFamilies } from '@/server/repositories/skillCatalogRepo';
import { getSkillsForUser } from '@/server/repositories/volunteerSkillRepo';
import {
	getMatchedOpportunities,
	scoreApplicationsForOpportunity,
	updateVolunteerSkills,
} from '@/server/services/volunteerMatchingService';
import {
	createTRPCRouter,
	protectedProcedure,
	publicProcedure,
	staffProcedure,
} from '@/server/trpc/init';

/** Extract userId from session, throwing if somehow missing (should never happen after protectedProcedure). */
function requireUserId(session: { user?: { id?: string } } | null): string {
	const id = session?.user?.id;
	if (!id) throw new TRPCError({ code: 'UNAUTHORIZED' });
	return id;
}

export const matchingRouter = createTRPCRouter({
	/** Return the full skill catalog grouped by family. */
	getSkillCatalog: publicProcedure.query(() => listSkillFamilies()),

	/** Return the authenticated user's skill list. */
	getMySkills: protectedProcedure.query(({ ctx }) =>
		getSkillsForUser(requireUserId(ctx.session)),
	),

	/** Replace the authenticated user's skill list (with audit logging). */
	updateMySkills: protectedProcedure
		.input(
			z.object({
				skillIds: z.array(z.string().cuid()).max(50),
			}),
		)
		.mutation(({ ctx, input }) =>
			updateVolunteerSkills(requireUserId(ctx.session), input.skillIds),
		),

	/** Get published opportunities for an org, scored against the user's skills. */
	getRecommendations: protectedProcedure
		.input(z.object({ orgSlug: z.string().min(1) }))
		.query(({ ctx, input }) =>
			getMatchedOpportunities(requireUserId(ctx.session), input.orgSlug),
		),

	/** Score all applicants for an opportunity against its skill requirements (staff only). */
	getApplicationScores: staffProcedure
		.input(z.object({ opportunityId: z.string().min(1) }))
		.query(({ ctx, input }) =>
			scoreApplicationsForOpportunity(ctx.orgId, input.opportunityId),
		),
});
