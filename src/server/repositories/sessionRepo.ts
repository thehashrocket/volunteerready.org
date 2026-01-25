import type { PrismaClient } from '@/prisma/generated/client';

export function sessionRepo(prisma: PrismaClient) {
	return {
		async setCurrentOrgBySessionToken(
			sessionToken: string,
			orgId: string | null,
		) {
			return prisma.session.update({
				where: { sessionToken },
				data: { currentOrgId: orgId },
				select: { id: true, userId: true, currentOrgId: true },
			});
		},

		async getBySessionToken(sessionToken: string) {
			return prisma.session.findUnique({
				where: { sessionToken },
				select: { id: true, userId: true, currentOrgId: true },
			});
		},
	};
}
