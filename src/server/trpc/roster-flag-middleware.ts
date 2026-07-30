import { TRPCError } from '@trpc/server';
import { isRosterEnabledForOrg } from '@/server/services/featureFlagService';
import { staffProcedure } from '@/server/trpc/init';

/**
 * Staff procedure that also enforces the `staff_created_volunteers` flag.
 *
 * The flag was originally checked ONLY in two Server Component layouts, which
 * gated the nav item and the page. That is not a kill switch: every procedure
 * built on this is a live HTTP endpoint, so any STAFF user at a non-enabled org
 * could POST straight to tRPC and `add` — which mints a global `User` row and
 * sends outbound mail to a third party. `volunteers/layout.tsx` reasons about
 * exactly this bypass class for the route ("anyone can type the URL") and then
 * closed only the page. The same argument applies with more force to the
 * mutations.
 *
 * It lives here rather than in `routers/volunteers.ts` because the roster's
 * central mutation does NOT live in that router: `assignVolunteerToShift` is on
 * `shifts`, since it acts on a shift and belongs beside the other shift writes.
 * The design's gating diagram lists the assign picker as GATED alongside the
 * roster page, so both routers have to reach the same predicate — and a
 * hand-copied flag check in a second router is the copy that gets missed when
 * the flag is retired.
 *
 * The predicate itself is `isRosterEnabledForOrg` in `featureFlagService`,
 * shared with the CSV export route and the two onboarding surfaces — none of
 * which are procedures, so none would be found by grepping this file.
 *
 * One indexed lookup per call, mirroring the org-suspension check
 * `orgProcedure` already performs. `ctx.orgId` is guaranteed non-null by
 * `orgProcedure`.
 */
export const rosterProcedure = staffProcedure.use(async ({ ctx, next }) => {
	if (!(await isRosterEnabledForOrg(ctx.orgId))) {
		throw new TRPCError({
			code: 'FORBIDDEN',
			message: 'The volunteer roster is not enabled for this organization.',
		});
	}
	return next();
});
