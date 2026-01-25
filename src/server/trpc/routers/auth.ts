import { createTRPCRouter, publicProcedure } from '@/server/trpc/init';

export const authRouter = createTRPCRouter({
	getSession: publicProcedure.query(({ ctx }) => ctx.session),
});
