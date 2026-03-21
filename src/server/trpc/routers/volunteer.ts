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
		return getVolunteerDashboard(requireUserId(session), session.user?.email);
	}),
});
