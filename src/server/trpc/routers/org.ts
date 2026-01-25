import { z } from "zod";
import { createTRPCRouter, orgProcedure, protectedProcedure } from "@/server/trpc/init";

export const orgRouter = createTRPCRouter({
  getCurrentOrg: orgProcedure.query(async ({ ctx }) => {
    return ctx.prisma.organization.findUnique({
      where: { id: ctx.orgId },
    });
  }),
  listOrgs: protectedProcedure.query(async ({ ctx }) => {
    const memberships = await ctx.prisma.organizationMember.findMany({
      where: { userId: ctx.session?.user?.id },
      include: { organization: true },
    });

    return memberships.map((membership) => membership.organization);
  }),
  switchOrg: protectedProcedure
    .input(z.object({ orgId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const membership = await ctx.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: input.orgId,
            userId: ctx.session?.user?.id ?? "",
          },
        },
        include: { organization: true },
      });

      if (!membership) {
        return null;
      }

      return membership.organization;
    }),
});
