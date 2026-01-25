import type { PrismaClient } from '@/prisma/generated/client';
import { Prisma } from '@/prisma/generated/client';

export function auditRepo(prisma: PrismaClient) {
	return {
		async write(input: {
			orgId: string;
			actorId?: string | null;
			action: string;
			entityType: string;
			entityId?: string | null;
			metadata?: any;
		}) {
			return prisma.auditLog.create({
				data: {
					orgId: input.orgId,
					actorId: input.actorId ?? null,
					action: input.action,
					entityType: input.entityType,
					entityId: input.entityId ?? null,
					metadata: input.metadata as Prisma.InputJsonValue,
				},
				select: { id: true },
			});
		},
	};
}
