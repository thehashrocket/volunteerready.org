import type { PrismaClient } from '@/prisma/generated/client';
import { prisma } from './prisma';

type TxClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

/** Find VERIFIED credentials with expiresAt in the past. */
export async function findExpiredCredentials(limit = 500) {
	return prisma.volunteerCredential.findMany({
		where: {
			status: 'VERIFIED',
			expiresAt: { lt: new Date() },
		},
		select: { id: true, userId: true, orgId: true, type: true },
		take: limit,
	});
}

/** Mark a single credential as EXPIRED inside a transaction. */
export async function markCredentialExpiredTx(
	tx: TxClient,
	credentialId: string,
) {
	return tx.volunteerCredential.update({
		where: { id: credentialId },
		data: { status: 'EXPIRED' },
	});
}

/** Find ACTIVE share tokens with expiresAt in the past. */
export async function findExpiredShareTokens(limit = 500) {
	return prisma.credentialShareToken.findMany({
		where: {
			status: 'ACTIVE',
			expiresAt: { lt: new Date() },
		},
		select: { id: true },
		take: limit,
	});
}
