import type { PrismaClient } from '@/prisma/generated/client';
import { prisma } from './prisma';

type TxClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

type CreateInput = {
	adminUserId: string;
	targetUserId: string;
	reason: string;
	expiresAt: Date;
};

export async function createImpersonationSessionTx(
	tx: TxClient,
	input: CreateInput,
) {
	return tx.impersonationSession.create({
		data: input,
		select: {
			id: true,
			adminUserId: true,
			targetUserId: true,
			reason: true,
			startedAt: true,
			expiresAt: true,
			endedAt: true,
		},
	});
}

export async function findActiveImpersonationSession(id: string) {
	return prisma.impersonationSession.findUnique({
		where: { id },
		select: {
			id: true,
			adminUserId: true,
			targetUserId: true,
			reason: true,
			startedAt: true,
			expiresAt: true,
			endedAt: true,
		},
	});
}

export async function endImpersonationSession(id: string, endedReason: string) {
	return prisma.impersonationSession.updateMany({
		where: { id, endedAt: null },
		data: { endedAt: new Date(), endedReason },
	});
}

export async function getImpersonationHistory(options: {
	adminUserId?: string;
	targetUserId?: string;
	limit?: number;
}) {
	const limit = Math.min(options.limit ?? 50, 200);
	return prisma.impersonationSession.findMany({
		where: {
			adminUserId: options.adminUserId,
			targetUserId: options.targetUserId,
		},
		orderBy: { startedAt: 'desc' },
		take: limit,
		select: {
			id: true,
			adminUserId: true,
			targetUserId: true,
			reason: true,
			startedAt: true,
			expiresAt: true,
			endedAt: true,
			endedReason: true,
			admin: { select: { id: true, email: true, name: true } },
			target: { select: { id: true, email: true, name: true } },
		},
	});
}
