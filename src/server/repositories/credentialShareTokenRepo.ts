import type { PrismaClient } from '@/prisma/generated/client';
import { prisma } from '@/server/repositories/prisma';

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** Find a share token by its hash, including credential + org details. */
export async function findShareTokenByHash(tokenHash: string) {
	return prisma.credentialShareToken.findUnique({
		where: { tokenHash },
		include: {
			credential: {
				include: {
					organization: { select: { id: true, name: true } },
				},
			},
			createdBy: { select: { id: true, name: true, email: true } },
			claimedByOrg: { select: { id: true, name: true } },
		},
	});
}

/** List all share tokens created by a user, with claim info. */
export async function listShareTokensByUser(userId: string) {
	return prisma.credentialShareToken.findMany({
		where: { createdByUserId: userId },
		include: {
			credential: {
				select: {
					id: true,
					type: true,
					status: true,
					orgId: true,
					organization: { select: { name: true } },
				},
			},
			claimedByOrg: { select: { id: true, name: true } },
		},
		orderBy: { createdAt: 'desc' },
	});
}

/** Count distinct orgs that have claimed tokens for a given credential. */
export async function countClaimedOrgsForCredential(
	credentialId: string,
): Promise<number> {
	const result = await prisma.credentialShareToken.findMany({
		where: { credentialId, status: 'CLAIMED', claimedByOrgId: { not: null } },
		select: { claimedByOrgId: true },
		distinct: ['claimedByOrgId'],
	});
	return result.length;
}

/** Count verified credentials a user has in orgs OTHER than the given org. */
export async function countVerifiedCredentialsExcludingOrg(
	userId: string,
	excludeOrgId: string,
): Promise<number> {
	return prisma.volunteerCredential.count({
		where: {
			userId,
			status: 'VERIFIED',
			orgId: { not: excludeOrgId },
		},
	});
}

/** Get all verified credentials for a user across all orgs. */
export async function getVerifiedCredentialsByUser(userId: string) {
	return prisma.volunteerCredential.findMany({
		where: { userId, status: 'VERIFIED' },
		include: {
			organization: { select: { id: true, name: true } },
		},
	});
}

// ---------------------------------------------------------------------------
// Writes (transactional)
// ---------------------------------------------------------------------------

/** Create a share token inside a transaction. */
export async function createShareTokenTx(
	tx: Parameters<Parameters<PrismaClient['$transaction']>[0]>[0],
	input: {
		credentialId: string;
		createdByUserId: string;
		tokenHash: string;
		expiresAt: Date;
	},
) {
	return tx.credentialShareToken.create({
		data: {
			credentialId: input.credentialId,
			createdByUserId: input.createdByUserId,
			tokenHash: input.tokenHash,
			expiresAt: input.expiresAt,
		},
	});
}

/**
 * Mark a token as CLAIMED using an optimistic lock.
 * Returns the updated token, or null if the token was already claimed
 * (0 rows affected by the conditional update).
 */
export async function markTokenClaimedTx(
	tx: Parameters<Parameters<PrismaClient['$transaction']>[0]>[0],
	tokenId: string,
	claimedByOrgId: string,
) {
	// Optimistic lock: only update if status is still ACTIVE
	const result = await tx.credentialShareToken.updateMany({
		where: { id: tokenId, status: 'ACTIVE' },
		data: {
			status: 'CLAIMED',
			claimedByOrgId,
			claimedAt: new Date(),
		},
	});

	if (result.count === 0) {
		return null; // concurrent claim — token was already claimed
	}

	return tx.credentialShareToken.findUnique({ where: { id: tokenId } });
}

/** Mark a token as EXPIRED (volunteer revoke). */
export async function markTokenExpiredTx(
	tx: Parameters<Parameters<PrismaClient['$transaction']>[0]>[0],
	tokenId: string,
) {
	return tx.credentialShareToken.update({
		where: { id: tokenId },
		data: { status: 'EXPIRED' },
	});
}
