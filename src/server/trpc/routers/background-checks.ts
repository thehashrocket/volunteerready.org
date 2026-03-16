import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { checkrAdapter } from '@/server/lib/adapters/background-check/checkr';
import {
	cancelBackgroundCheck,
	disconnectCheckrAccount,
	finalizeAdverseAction,
	getCheckrConnectionStatus,
	initiateBackgroundCheck,
	listOrgBackgroundChecks,
	resolveFcra,
	sendPreAdverseNotice,
} from '@/server/services/backgroundCheckService';
import {
	adminProcedure,
	createTRPCRouter,
	planTierProcedure,
	roleRank,
	staffProcedure,
} from '@/server/trpc/init';

export const backgroundChecksRouter = createTRPCRouter({
	/**
	 * Initiate a background check on a volunteer.
	 * Requires PRO plan + STAFF role minimum.
	 *
	 * SECURITY: The pii field contains SSN/DOB which are never stored or logged.
	 * tRPC input validation runs first (Zod), then the service layer handles
	 * the Checkr API call and DB writes.
	 */
	initiate: planTierProcedure('PRO')
		.use(({ ctx, next }) => {
			if (!ctx.role || roleRank[ctx.role] < roleRank.STAFF) {
				throw new TRPCError({
					code: 'FORBIDDEN',
					message: 'Staff or higher role required.',
				});
			}
			return next({ ctx: { role: ctx.role } });
		})
		.input(
			z.object({
				userId: z.string().min(1),
				pii: z.object({
					firstName: z.string().min(1).max(100),
					lastName: z.string().min(1).max(100),
					email: z.string().email(),
					dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
					ssn: z.string().regex(/^\d{9}$/, 'Must be exactly 9 digits'),
				}),
				packageName: z.string().optional(),
			}),
		)
		.mutation(({ ctx, input }) =>
			initiateBackgroundCheck({
				orgId: ctx.orgId,
				userId: input.userId,
				actorId: ctx.session?.user?.id ?? '',
				pii: input.pii,
				packageName: input.packageName,
			}),
		),

	/** List all background check requests for the current org. Staff+. */
	listByOrg: staffProcedure.query(({ ctx }) =>
		listOrgBackgroundChecks(ctx.orgId),
	),

	/** Cancel a PENDING or CONSIDER background check request. Staff+. */
	cancel: staffProcedure
		.input(z.object({ requestId: z.string().min(1) }))
		.mutation(({ ctx, input }) =>
			cancelBackgroundCheck(
				input.requestId,
				ctx.orgId,
				ctx.session?.user?.id ?? '',
			),
		),

	// ---------------------------------------------------------------------------
	// FCRA Adverse Action — Staff+
	// ---------------------------------------------------------------------------

	/** Send a pre-adverse action notice to the volunteer. Staff+. */
	sendPreAdverseNotice: staffProcedure
		.input(z.object({ requestId: z.string().min(1) }))
		.mutation(({ ctx, input }) =>
			sendPreAdverseNotice(
				input.requestId,
				ctx.orgId,
				ctx.session?.user?.id ?? '',
			),
		),

	/** Finalize adverse action after the FCRA waiting period. Staff+. */
	finalizeAdverseAction: staffProcedure
		.input(z.object({ requestId: z.string().min(1) }))
		.mutation(({ ctx, input }) =>
			finalizeAdverseAction(
				input.requestId,
				ctx.orgId,
				ctx.session?.user?.id ?? '',
			),
		),

	/** Resolve FCRA favorably (called after credential issuance). Staff+. */
	resolveFcra: staffProcedure
		.input(z.object({ requestId: z.string().min(1) }))
		.mutation(({ ctx, input }) =>
			resolveFcra(input.requestId, ctx.orgId, ctx.session?.user?.id ?? ''),
		),

	// ---------------------------------------------------------------------------
	// Checkr Partner API — OAuth connect/disconnect (Admin+ only)
	// ---------------------------------------------------------------------------

	/** Returns the Checkr Partner OAuth authorization URL. Admin+ only. */
	getCheckrOAuthUrl: adminProcedure.query(({ ctx }) => {
		// Use orgId as state for CSRF — validated in the callback route
		const url = checkrAdapter.getOAuthUrl(ctx.orgId);
		return { url };
	}),

	/** Returns whether this org has connected their Checkr account. Staff+. */
	getCheckrStatus: staffProcedure.query(({ ctx }) =>
		getCheckrConnectionStatus(ctx.orgId),
	),

	/**
	 * Disconnect the org's Checkr account (remove stored access token).
	 * Admin+ only. Does not cancel in-flight background checks.
	 */
	disconnectCheckr: adminProcedure.mutation(({ ctx }) =>
		disconnectCheckrAccount(ctx.orgId, ctx.session?.user?.id ?? ''),
	),
});
