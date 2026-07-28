import { z } from 'zod';
import {
	addVolunteerSchema,
	toClientResult,
} from '@/server/domain/org-volunteer';
import {
	addVolunteer,
	getRoster,
	getRosterCount,
	removeVolunteer,
	restoreVolunteer,
} from '@/server/services/staffVolunteerService';
import { effectiveUserId, impersonatedBy } from '@/server/trpc/audit-actor';
import { createTRPCRouter } from '@/server/trpc/init';
// Shared with routers/shifts.ts, which carries the roster's central mutation.
import { rosterProcedure } from '@/server/trpc/roster-flag-middleware';

/**
 * Staff-created volunteer roster.
 *
 * `staffProcedure` (not adminProcedure): maintaining the roster is the daily job
 * of a volunteer coordinator, who is frequently STAFF rather than ADMIN.
 * `orgProcedure` already guarantees ctx.orgId is the caller's own org, so every
 * query and mutation here is org-scoped by construction.
 */
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
