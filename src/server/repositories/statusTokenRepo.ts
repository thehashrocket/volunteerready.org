import type { PrismaClient } from '@/prisma/generated/client';

export function statusTokenRepo(prisma: PrismaClient) {
	return {
		create(input: { email: string; tokenHash: string; expiresAt: Date }) {
			return prisma.applicationStatusToken.create({
				data: {
					email: input.email,
					tokenHash: input.tokenHash,
					expiresAt: input.expiresAt,
				},
				select: { id: true },
			});
		},

		findValidByHash(tokenHash: string) {
			return prisma.applicationStatusToken.findFirst({
				where: {
					tokenHash,
					usedAt: null,
					expiresAt: { gt: new Date() },
				},
				select: { id: true, email: true, expiresAt: true },
			});
		},

		markUsed(id: string) {
			return prisma.applicationStatusToken.update({
				where: { id },
				data: { usedAt: new Date() },
				select: { id: true },
			});
		},
	};
}
