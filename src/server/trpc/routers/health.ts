import { createTRPCRouter, publicProcedure } from "@/server/trpc/init";

export const healthRouter = createTRPCRouter({
  ping: publicProcedure.query(() => "pong"),
});
