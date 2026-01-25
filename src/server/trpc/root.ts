import { createTRPCRouter, publicProcedure } from "@/server/trpc/trpc";

export const appRouter = createTRPCRouter({
  health: publicProcedure.query(() => "ok"),
});

export type AppRouter = typeof appRouter;
