import { z } from 'zod';
import {
	createBulkImportJob,
	getImportJob,
	listImportJobs,
} from '@/server/services/bulk-import-service';
import {
	adminProcedure,
	createTRPCRouter,
	requireUserId,
} from '@/server/trpc/init';

export const bulkImportRouter = createTRPCRouter({
	/**
	 * Start a bulk import from CSV content.
	 * Accepts the raw CSV string (client reads the file, sends text).
	 */
	start: adminProcedure
		.input(
			z.object({
				fileName: z.string().min(1).max(255),
				csvContent: z.string().min(1).max(5_000_000), // ~5MB max
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const userId = requireUserId(ctx.session);
			return createBulkImportJob({
				orgId: ctx.orgId,
				uploadedById: userId,
				fileName: input.fileName,
				csvContent: input.csvContent,
			});
		}),

	/** Get a specific import job's status. */
	get: adminProcedure
		.input(z.object({ jobId: z.string().min(1) }))
		.query(async ({ ctx, input }) => {
			return getImportJob(input.jobId, ctx.orgId);
		}),

	/** List recent import jobs for the org. */
	list: adminProcedure.query(async ({ ctx }) => {
		return listImportJobs(ctx.orgId);
	}),
});
