import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/server/repositories/prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma as any),
  session: { strategy: "database" },
  providers: [],
  callbacks: {
    session: async ({ session, user }) => {
      // user.id is available with database sessions
      if (session.user && user?.id) {
        (session.user as any).id = user.id;
      }
      // With database strategy, NextAuth includes session.sessionToken
      // on the server side in many cases, but it may not be present on the client.
      // We'll *also* copy it into session so tRPC context can use it.
      const rawSessionToken = (session as any).sessionToken ?? null;

      if (rawSessionToken) {
        (session as any).sessionToken = rawSessionToken;

        const dbSession = await prisma.session.findUnique({
          where: { sessionToken: rawSessionToken },
          select: { currentOrgId: true },
        });

        (session as any).currentOrgId = dbSession?.currentOrgId ?? null;
      } else {
        (session as any).currentOrgId = null;
      }
      return session;
    },
  },
};

export async function getCurrentOrgId() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return null;

  const membership = await prisma.organizationMember.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { organizationId: true },
  });

  return membership?.organizationId ?? null;
}
