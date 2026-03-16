import type {
	CredentialStatus,
	CredentialType,
	PrismaClient,
} from '@/prisma/generated/client';
import { prisma } from './prisma';

type TxClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** Get all credentials for a user (across all orgs). */
export async function getCredentialsByUserId(userId: string) {
	return prisma.volunteerCredential.findMany({
		where: { userId },
		orderBy: { createdAt: 'desc' },
	});
}

/** Get all credentials for a user in a specific org. */
export async function getCredentialsByUserAndOrg(
	userId: string,
	orgId: string,
) {
	return prisma.volunteerCredential.findMany({
		where: { userId, orgId },
		orderBy: { createdAt: 'desc' },
	});
}

/**
 * Find a single credential by user, org, and type using the @@unique index.
 * O(1) lookup — prefer over getCredentialsByUserAndOrg when you only need one type.
 */
export async function findCredentialByUserOrgType(
	userId: string,
	orgId: string,
	type: CredentialType,
) {
	return prisma.volunteerCredential.findUnique({
		where: { userId_orgId_type: { userId, orgId, type } },
		select: { id: true, status: true },
	});
}

/** Get credentials for all volunteers in an org (staff view). */
export async function getCredentialsByOrg(orgId: string) {
	return prisma.volunteerCredential.findMany({
		where: { orgId },
		include: {
			user: { select: { id: true, name: true, email: true, image: true } },
		},
		orderBy: [{ userId: 'asc' }, { type: 'asc' }],
	});
}

// ---------------------------------------------------------------------------
// Writes (transactional)
// ---------------------------------------------------------------------------

export interface UpsertCredentialInput {
	userId: string;
	orgId: string;
	type: CredentialType;
	status: CredentialStatus;
	issuedAt?: Date | null;
	expiresAt?: Date | null;
	notes?: string | null;
	issuedById?: string | null;
}

/** Upsert a credential (unique on userId + orgId + type). */
export async function upsertCredential(
	tx: TxClient,
	input: UpsertCredentialInput,
) {
	const { userId, orgId, type, ...data } = input;

	return tx.volunteerCredential.upsert({
		where: {
			userId_orgId_type: { userId, orgId, type },
		},
		create: { userId, orgId, type, ...data },
		update: data,
	});
}

/** Delete a credential. */
export async function deleteCredential(
	tx: TxClient,
	userId: string,
	orgId: string,
	type: CredentialType,
) {
	return tx.volunteerCredential.delete({
		where: {
			userId_orgId_type: { userId, orgId, type },
		},
	});
}
