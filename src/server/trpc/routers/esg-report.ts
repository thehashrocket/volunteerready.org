import { esgReportInputSchema } from '@/server/domain/esg-report';
import { generateESGReport } from '@/server/services/employerReportService';
import { companyPlanTierProcedure, createTRPCRouter } from '@/server/trpc/init';

export const esgReportRouter = createTRPCRouter({
	getSummary: companyPlanTierProcedure('PRO')
		.input(esgReportInputSchema)
		.query(async ({ ctx, input }) => {
			const actorId = ctx.session?.user?.id ?? '';
			return generateESGReport({
				companyId: ctx.companyId,
				actorId,
				dateRange: { from: input.from ?? null, to: input.to ?? null },
			});
		}),
});
