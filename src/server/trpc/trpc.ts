import { TRPCError, initTRPC } from "@trpc/server";
import { Role } from "@prisma/client";
import type { TRPCContext } from "@/server/trpc/context";

const t = initTRPC.context<TRPCContext>().create();

const roleRank: Record<Role, number> = {
  READONLY: 0,
  STAFF: 1,
  ADMIN: 2,
  OWNER: 3,
};

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

export const requireRole = (minRole: Role) =>
  t.middleware(({ ctx, next }) => {
    if (!ctx.session?.user?.id) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    if (!ctx.role || roleRank[ctx.role] < roleRank[minRole]) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    return next({
      ctx: {
        ...ctx,
        role: ctx.role,
      },
    });
  });

export const protectedProcedure = t.procedure.use(requireRole(Role.READONLY));
