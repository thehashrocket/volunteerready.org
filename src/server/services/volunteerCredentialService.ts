import { writeAuditLogTx } from '@/server/repositories/auditRepo';
import { prisma } from '@/server/repositories/prisma';
import {
	deleteCredential,
	getCredentialsByOrg,
	getCredentialsByUserAndOrg,
	getCredentialsByUserId,
	type UpsertCredentialInput,
	upsertCredential,
} from '@/server/repositories/volunteerCredentialRepo';

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** Get all credentials for a volunteer (cross-org). */
export async function getMyCredentials(userId: string) {
	return getCredentialsByUserId(userId);
}

/** Get credentials for a volunteer in a specific org. */
export async function getVolunteerCredentialsInOrg(
	userId: string,
	orgId: string,
) {
	return getCredentialsByUserAndOrg(userId, orgId);
}

/** Get all credentials in an org (staff view). */
export async function getOrgCredentials(orgId: string) {
	return getCredentialsByOrg(orgId);
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/** Issue or update a credential with audit logging. */
export async function issueCredential(
	input: UpsertCredentialInput,
	actorId: string,
) {
	return prisma.$transaction(async (tx) => {
		const credential = await upsertCredential(tx, {
			...input,
			issuedById: actorId,
		});

		await writeAuditLogTx(tx, {
			orgId: input.orgId,
			actorId,
			action: 'CREDENTIAL_ISSUED',
			entityType: 'VolunteerCredential',
			entityId: credential.id,
			metadata: {
				userId: input.userId,
				type: input.type,
				status: input.status,
			},
		});

		return credential;
	});
}

/** Revoke a credential with audit logging. */
export async function revokeCredential(
	userId: string,
	orgId: string,
	type: UpsertCredentialInput['type'],
	actorId: string,
) {
	return prisma.$transaction(async (tx) => {
		const credential = await upsertCredential(tx, {
			userId,
			orgId,
			type,
			status: 'REVOKED',
		});

		await writeAuditLogTx(tx, {
			orgId,
			actorId,
			action: 'CREDENTIAL_REVOKED',
			entityType: 'VolunteerCredential',
			entityId: credential.id,
			metadata: { userId, type },
		});

		return credential;
	});
}

/** Remove a credential entirely with audit logging. */
export async function removeCredential(
	userId: string,
	orgId: string,
	type: UpsertCredentialInput['type'],
	actorId: string,
) {
	return prisma.$transaction(async (tx) => {
		const deleted = await deleteCredential(tx, userId, orgId, type);

		await writeAuditLogTx(tx, {
			orgId,
			actorId,
			action: 'CREDENTIAL_DELETED',
			entityType: 'VolunteerCredential',
			entityId: deleted.id,
			metadata: { userId, type },
		});

		return deleted;
	});
}
