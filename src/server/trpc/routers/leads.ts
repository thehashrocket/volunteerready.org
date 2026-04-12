import { z } from 'zod';
import { leadCaptureSchema } from '@/server/domain/lead-capture';
import { getLeads, submitLead } from '@/server/services/leadCaptureService';
import {
	createTRPCRouter,
	platformAdminProcedure,
	publicProcedure,
} from '@/server/trpc/init';
import { rateLimitByIp } from '@/server/trpc/rate-limit-middleware';

export const leadsRouter = createTRPCRouter({
	submit: publicProcedure
		.use(
			rateLimitByIp({
				limit: 5,
				windowSeconds: 3600,
				prefix: 'leads:submit',
			}),
		)
		.input(leadCaptureSchema)
		.mutation(async ({ input }) => {
			return submitLead(input);
		}),

	list: platformAdminProcedure
		.input(
			z
				.object({
					locationSlug: z.string().optional(),
					limit: z.number().min(1).max(100).optional(),
					offset: z.number().min(0).optional(),
				})
				.optional(),
		)
		.query(async ({ input }) => {
			return getLeads(input);
		}),
});
