import type { PrismaClient } from '@/prisma/generated/client';

export function volunteerStatusRepo(prisma: PrismaClient) {
	return {
		listByEmail(email: string) {
			return prisma.volunteerApplication.findMany({
				where: { submittedByEmail: email },
				orderBy: { submittedAt: 'desc' },
				select: {
					id: true,
					submittedAt: true,
					status: true,
					screeningStatus: true,
					organization: { select: { name: true, slug: true } },
				},
			});
		},
	};
}
