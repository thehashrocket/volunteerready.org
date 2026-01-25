import { getServerSession } from "next-auth";
import type { Role } from "@prisma/client";
import { authOptions, getCurrentOrgId } from "@/server/auth";
import { prisma } from "@/server/repositories/prisma";

export async function createTRPCContext() {
  const session = await getServerSession(authOptions);
  const orgId = await getCurrentOrgId();

  let role: Role | null = null;
  if (session?.user?.id && orgId) {
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId: session.user.id,
        },
      },
      select: { role: true },
    });
    role = membership?.role ?? null;
  }

  return { session, orgId, role };
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;
