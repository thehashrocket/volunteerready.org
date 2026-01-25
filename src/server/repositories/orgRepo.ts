import type { PrismaClient } from "@/prisma/generated/client";

export function orgRepo(prisma: PrismaClient) {
  return {
    async userIsMemberOfOrg(userId: string, orgId: string) {
      const membership = await prisma.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId: orgId, userId } },
        select: { role: true },
      });
      return membership; // null if not member
    },

    async getFirstOrgForUser(userId: string) {
      const m = await prisma.organizationMember.findFirst({
        where: { userId },
        orderBy: { createdAt: "asc" },
        select: { organizationId: true, role: true },
      });
      return m; // {orgId, role} | null
    },
  };
}
