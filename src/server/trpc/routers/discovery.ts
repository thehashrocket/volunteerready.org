import { z } from 'zod';
import {
	inviteToApply,
	searchPublicVolunteers,
} from '@/server/services/volunteerDiscoveryService';
import { createTRPCRouter, staffProcedure } from '@/server/trpc/init';

export const discoveryRouter = createTRPCRouter({
	searchVolunteers: staffProcedure
		.input(
			z.object({
				skillIds: z.array(z.string()).optional(),
				credentialTypes: z.array(z.string()).optional(),
				city: z.string().optional(),
				state: z.string().optional(),
				availability: z.string().optional(),
				cursor: z.string().optional(),
			}),
		)
		.query(async ({ input }) => {
			return searchPublicVolunteers(input);
		}),

	inviteToApply: staffProcedure
		.input(
			z.object({
				volunteerId: z.string(),
				opportunityId: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return inviteToApply({
				...input,
				orgId: ctx.orgId,
				actorId: ctx.session.user.id,
			});
		}),
});
