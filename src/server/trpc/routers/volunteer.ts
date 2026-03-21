import { getVolunteerDashboard } from '@/server/services/volunteerDashboardService';
import {
	createTRPCRouter,
	protectedProcedure,
	requireUserId,
} from '@/server/trpc/init';

export const volunteerRouter = createTRPCRouter({
	/** Volunteer dashboard — upcoming shifts, pending apps, expiring creds, impact, recommendations. */
	getDashboard: protectedProcedure.query(({ ctx }) =>
		getVolunteerDashboard(requireUserId(ctx.session), ctx.session.user?.email),
	),
});
