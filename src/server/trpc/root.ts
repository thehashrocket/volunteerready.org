import { createTRPCRouter } from '@/server/trpc/init';
import { authRouter } from '@/server/trpc/routers/auth';
import { healthRouter } from '@/server/trpc/routers/health';
import { orgRouter } from '@/server/trpc/routers/org';
import { screenerRouter } from '@/server/trpc/routers/screener';
import { statusRouter } from '@/server/trpc/routers/status';

export const appRouter = createTRPCRouter({
	auth: authRouter,
	health: healthRouter,
	org: orgRouter,
	screener: screenerRouter,
	status: statusRouter,
});

export type AppRouter = typeof appRouter;
