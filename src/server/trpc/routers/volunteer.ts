import { TRPCError } from '@trpc/server';
import { getVolunteerDashboard } from '@/server/services/volunteerDashboardService';
import {
	createTRPCRouter,
	protectedProcedure,
	requireUserId,
} from '@/server/trpc/init';

export const volunteerRouter = createTRPCRouter({
	/** Volunteer dashboard — upcoming shifts, pending apps, expiring creds, impact, recommendations. */
	getDashboard: protectedProcedure.query(({ ctx }) => {
		const { session } = ctx;
		if (!session) throw new TRPCError({ code: 'UNAUTHORIZED' });
		// Id only. `session.user.email` is the REAL admin's under impersonation
		// while `id` is the target's, so passing both described two people.
		return getVolunteerDashboard(requireUserId(session));
	}),
});
