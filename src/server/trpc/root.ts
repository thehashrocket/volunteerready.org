import { createTRPCRouter } from "@/server/trpc/init";
import { authRouter } from "@/server/trpc/routers/auth";
import { healthRouter } from "@/server/trpc/routers/health";
import { orgRouter } from "@/server/trpc/routers/org";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  health: healthRouter,
  org: orgRouter,
});

export type AppRouter = typeof appRouter;
