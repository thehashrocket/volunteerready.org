import { esgReportInputSchema } from '@/server/domain/esg-report';
import { generateESGReport } from '@/server/services/employerReportService';
import { companyScopedProcedure, createTRPCRouter } from '@/server/trpc/init';

export const esgReportRouter = createTRPCRouter({
	getSummary: companyScopedProcedure({ minRole: 'ADMIN', minPlanTier: 'PRO' })
		.input(esgReportInputSchema)
		.query(async ({ ctx, input }) => {
			const actorId = ctx.session?.user?.id ?? '';
			return generateESGReport({
				companyId: ctx.companyId,
				actorId,
				impersonatedBy:
					ctx.realUserId && ctx.realUserId !== actorId ? ctx.realUserId : null,
				dateRange: { from: input.from ?? null, to: input.to ?? null },
			});
		}),
});
