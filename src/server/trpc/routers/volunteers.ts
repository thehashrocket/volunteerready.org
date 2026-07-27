import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { STAFF_CREATED_VOLUNTEERS_FLAG } from '@/server/domain/feature-flags';
import {
	addVolunteerSchema,
	toClientResult,
} from '@/server/domain/org-volunteer';
import { isFeatureEnabled } from '@/server/services/featureFlagService';
import {
	addVolunteer,
	getRoster,
	getRosterCount,
	removeVolunteer,
	restoreVolunteer,
} from '@/server/services/staffVolunteerService';
import { createTRPCRouter, staffProcedure } from '@/server/trpc/init';

/**
 * Staff procedure that also enforces the roster feature flag.
 *
 * The flag was originally checked ONLY in two Server Component layouts, which
 * gated the nav item and the page. That is not a kill switch: every procedure
 * below is a live HTTP endpoint, so any STAFF user at a non-enabled org could
 * POST straight to tRPC and `add` — which mints a global `User` row and sends
 * outbound mail to a third party. `volunteers/layout.tsx` reasons about exactly
 * this bypass class for the route ("anyone can type the URL") and then closed
 * only the page. The same argument applies with more force to the mutations.
 *
 * One indexed lookup per call, mirroring the org-suspension check orgProcedure
 * already performs. `ctx.orgId` is guaranteed non-null by orgProcedure.
 */
const rosterProcedure = staffProcedure.use(async ({ ctx, next }) => {
	if (!(await isFeatureEnabled(ctx.orgId, STAFF_CREATED_VOLUNTEERS_FLAG))) {
		throw new TRPCError({
			code: 'FORBIDDEN',
			message: 'The volunteer roster is not enabled for this organization.',
		});
	}
	return next();
});

/**
 * Staff-created volunteer roster.
 *
 * `staffProcedure` (not adminProcedure): maintaining the roster is the daily job
 * of a volunteer coordinator, who is frequently STAFF rather than ADMIN.
 * `orgProcedure` already guarantees ctx.orgId is the caller's own org, so every
 * query and mutation here is org-scoped by construction.
 */
type AuditCtx = {
	session?: { user?: { id?: string | null } | null } | null;
	realUserId?: string | null;
};

/** The user the action is attributed to — the impersonated target, if any. */
function effectiveUserId(ctx: AuditCtx): string | null {
	return ctx.session?.user?.id ?? null;
}

/**
 * The real admin behind an impersonated action, or null.
 *
 * `ctx.realUserId` is set for EVERY logged-in request, not only impersonated
 * ones (`trpc/init.ts:42`), so it must be compared against the effective user
 * before being stamped. Stamping it unconditionally would mark every audit row
 * as impersonated and make `queryAuditLog`'s `impersonatedOnly` filter useless.
 * Same expression as `routers/company.ts:58`.
 */
function impersonatedBy(ctx: AuditCtx): string | null {
	const effective = effectiveUserId(ctx);
	return ctx.realUserId && ctx.realUserId !== effective ? ctx.realUserId : null;
}

export const volunteersRouter = createTRPCRouter({
	list: rosterProcedure
		.input(
			z.object({
				// Bounded: an unbounded cursor is an unvalidated row id, and an
				// unbounded search compiles to ILIKE '%…%' over the org's roster.
				cursor: z.string().max(64).nullish(),
				search: z.string().max(100).nullish(),
			}),
		)
		.query(({ ctx, input }) =>
			getRoster({
				orgId: ctx.orgId,
				cursor: input.cursor,
				search: input.search,
			}),
		),

	count: rosterProcedure.query(({ ctx }) => getRosterCount(ctx.orgId)),

	// SECURITY: mapped through toClientResult so the internal AddVolunteerOutcome
	// never reaches the client. Returning it would let a coordinator read
	// `LINKED_UNCLAIMED` off the network tab and learn that another organisation
	// already has this person on its roster — the disclosure Security §7 refused.
	add: rosterProcedure
		.input(addVolunteerSchema)
		.mutation(async ({ ctx, input }) =>
			toClientResult(
				await addVolunteer({
					orgId: ctx.orgId,
					displayName: input.displayName,
					email: input.email,
					phone: input.phone,
					actorId: effectiveUserId(ctx),
					impersonatedBy: impersonatedBy(ctx),
				}),
			),
		),

	remove: rosterProcedure
		.input(z.object({ volunteerId: z.string().min(1) }))
		.mutation(({ ctx, input }) =>
			removeVolunteer({
				orgId: ctx.orgId,
				volunteerId: input.volunteerId,
				actorId: effectiveUserId(ctx),
				impersonatedBy: impersonatedBy(ctx),
			}),
		),

	restore: rosterProcedure
		.input(z.object({ volunteerId: z.string().min(1) }))
		.mutation(({ ctx, input }) =>
			restoreVolunteer({
				orgId: ctx.orgId,
				volunteerId: input.volunteerId,
				actorId: effectiveUserId(ctx),
				impersonatedBy: impersonatedBy(ctx),
			}),
		),
});
