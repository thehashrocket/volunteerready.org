import { prisma } from './prisma';

export async function getSessionByToken(sessionToken: string) {
	return prisma.session.findUnique({
		where: { sessionToken },
		select: { id: true, userId: true, currentOrgId: true },
	});
}
