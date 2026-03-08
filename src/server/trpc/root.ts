import { createTRPCRouter } from '@/server/trpc/init';
import { authRouter } from '@/server/trpc/routers/auth';
import { healthRouter } from '@/server/trpc/routers/health';
import { matchingRouter } from '@/server/trpc/routers/matching';
import { membersRouter } from '@/server/trpc/routers/members';
import { onboardingRouter } from '@/server/trpc/routers/onboarding';
import { opportunitiesRouter } from '@/server/trpc/routers/opportunities';
import { orgRouter } from '@/server/trpc/routers/org';
import { screenerRouter } from '@/server/trpc/routers/screener';
import { statusRouter } from '@/server/trpc/routers/status';

export const appRouter = createTRPCRouter({
	auth: authRouter,
	health: healthRouter,
	matching: matchingRouter,
	members: membersRouter,
	onboarding: onboardingRouter,
	opportunities: opportunitiesRouter,
	org: orgRouter,
	screener: screenerRouter,
	status: statusRouter,
});

export type AppRouter = typeof appRouter;
