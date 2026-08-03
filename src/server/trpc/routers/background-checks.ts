import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { checkrAdapter } from '@/server/lib/adapters/background-check/checkr';
import {
	cancelBackgroundCheck,
	connectSterlingAccount,
	disconnectCheckrAccount,
	disconnectSterlingAccount,
	finalizeAdverseAction,
	getCheckrConnectionStatus,
	getSterlingConnectionStatus,
	initiateBackgroundCheck,
	issueCredentialAndResolveFcra,
	listOrgBackgroundChecks,
	resolveFcra,
	sendPreAdverseNotice,
} from '@/server/services/backgroundCheckService';
import { impersonatedBy } from '@/server/trpc/audit-actor';
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
					/**
					 * `.trim()` before `.email()`, matching `volunteerEmailSchema`.
					 * Without it a pasted address carrying a trailing space fails Zod
					 * — which arrives as a tRPC-manufactured BAD_REQUEST that
					 * `errorFormatter` redacts to generic copy, so the coordinator
					 * is refused with no way to learn why. It also made the service's
					 * whitespace tolerance unreachable from the API surface it
					 * guards. Caught by the Codex adversarial pass.
					 */
					email: z.string().trim().email(),
					dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
					ssn: z.string().regex(/^\d{9}$/, 'Must be exactly 9 digits'),
				}),
				packageName: z.string().optional(),
				/**
				 * `z.boolean()`, NOT `z.literal(true)`. The refusal belongs in the
				 * service so it can carry copy the coordinator actually reads —
				 * a Zod failure arrives as a tRPC-manufactured BAD_REQUEST whose
				 * message comes from the cause, which `errorFormatter` redacts.
				 * See Guard 0 in backgroundCheckService.ts.
				 */
				consentAttested: z.boolean(),
			}),
		)
		.mutation(({ ctx, input }) =>
			initiateBackgroundCheck({
				orgId: ctx.orgId,
				userId: input.userId,
				actorId: ctx.session?.user?.id ?? '',
				pii: input.pii,
				packageName: input.packageName,
				consentAttested: input.consentAttested,
				// `actorId` above is the EFFECTIVE user — `createTRPCContext`
				// rewrites `session.user.id` to the impersonated target — and that
				// id is what lands in `consentAttestedBy`. Without this, a platform
				// admin impersonating a coordinator produces evidence naming that
				// coordinator as having sworn they hold a signed FCRA
				// authorization. `impersonatedBy()` does the realUserId-vs-effective
				// comparison; never stamp `ctx.realUserId` raw.
				impersonatedBy: impersonatedBy(ctx),
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

	/** Atomically issue a BACKGROUND_CHECK credential and resolve FCRA. Staff+. */
	issueAndResolve: staffProcedure
		.input(
			z.object({
				requestId: z.string().min(1),
				notes: z.string().max(500).nullable().optional(),
				expiresAt: z.coerce
					.date()
					.refine((d) => d > new Date(), {
						message: 'Expiration date must be in the future',
					})
					.nullable()
					.optional(),
			}),
		)
		.mutation(({ ctx, input }) =>
			issueCredentialAndResolveFcra(
				input.requestId,
				ctx.orgId,
				ctx.session?.user?.id ?? '',
				{
					notes: input.notes,
					expiresAt: input.expiresAt,
				},
			),
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

	// ---------------------------------------------------------------------------
	// Sterling — API key connect/disconnect (Admin+ only)
	// ---------------------------------------------------------------------------

	/**
	 * Connect a Sterling account by storing an encrypted API key.
	 * Sterling uses API keys (not OAuth) — admin pastes the key in settings.
	 * Admin+ only.
	 */
	connectSterling: adminProcedure
		.input(
			z.object({
				apiKey: z.string().min(1, 'API key is required'),
				accountId: z.string().min(1, 'Account ID is required'),
			}),
		)
		.mutation(({ ctx, input }) =>
			connectSterlingAccount(
				ctx.orgId,
				input.apiKey,
				input.accountId,
				ctx.session?.user?.id ?? '',
			),
		),

	/** Returns whether this org has connected their Sterling account. Staff+. */
	getSterlingStatus: staffProcedure.query(({ ctx }) =>
		getSterlingConnectionStatus(ctx.orgId),
	),

	/**
	 * Disconnect the org's Sterling account (remove stored API key).
	 * Admin+ only. Does not cancel in-flight background checks.
	 */
	disconnectSterling: adminProcedure.mutation(({ ctx }) =>
		disconnectSterlingAccount(ctx.orgId, ctx.session?.user?.id ?? ''),
	),
});
