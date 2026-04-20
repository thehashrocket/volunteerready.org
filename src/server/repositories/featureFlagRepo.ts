import type { Prisma } from '@/prisma/generated/client';
import { prisma } from './prisma';

type Tx = Prisma.TransactionClient;

export async function listOrgFlags(orgId: string) {
	return prisma.featureFlag.findMany({
		where: { orgId },
		select: {
			id: true,
			key: true,
			enabled: true,
			updatedAt: true,
			updatedById: true,
			updatedBy: { select: { id: true, email: true, name: true } },
		},
		orderBy: { key: 'asc' },
	});
}

export async function getFlag(orgId: string, key: string) {
	return prisma.featureFlag.findUnique({
		where: { orgId_key: { orgId, key } },
		select: { enabled: true },
	});
}

export async function upsertFlagTx(
	tx: Tx,
	args: {
		orgId: string;
		key: string;
		enabled: boolean;
		updatedById: string;
	},
) {
	return tx.featureFlag.upsert({
		where: { orgId_key: { orgId: args.orgId, key: args.key } },
		create: {
			orgId: args.orgId,
			key: args.key,
			enabled: args.enabled,
			updatedById: args.updatedById,
		},
		update: {
			enabled: args.enabled,
			updatedById: args.updatedById,
		},
		select: {
			id: true,
			orgId: true,
			key: true,
			enabled: true,
			updatedAt: true,
			updatedById: true,
		},
	});
}

export async function getFlagWithPriorTx(tx: Tx, orgId: string, key: string) {
	return tx.featureFlag.findUnique({
		where: { orgId_key: { orgId, key } },
		select: { enabled: true },
	});
}
