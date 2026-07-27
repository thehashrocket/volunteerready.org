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
import { requireOrgVolunteerRelationship } from '@/server/services/orgVolunteerAccessService';
import { checkAndIssueTenureBadges } from '@/server/services/tenureBadgeService';

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

/**
 * Issue or update a credential with audit logging.
 *
 * The relationship check is not optional: the only UI for this is a free-text
 * "Volunteer User ID" field, so without it a staff user could mint a
 * verification badge on any account in the system by pasting its id.
 */
export async function issueCredential(
	input: UpsertCredentialInput,
	actorId: string,
) {
	const relationship = await requireOrgVolunteerRelationship(
		input.orgId,
		input.userId,
	);

	const credential = await prisma.$transaction(async (tx) => {
		const cred = await upsertCredential(tx, {
			...input,
			issuedById: actorId,
		});

		await writeAuditLogTx(tx, {
			orgId: input.orgId,
			actorId,
			action: 'CREDENTIAL_ISSUED',
			entityType: 'VolunteerCredential',
			entityId: cred.id,
			// `relationship` records WHY this issuance was permitted — see the
			// equivalent note in backgroundCheckService.
			metadata: {
				userId: input.userId,
				type: input.type,
				status: input.status,
				relationship,
			},
		});

		return cred;
	});

	// Fire-and-forget: a new VERIFIED credential may unlock a tenure badge.
	if (input.status === 'VERIFIED') {
		void checkAndIssueTenureBadges(input.userId);
	}

	return credential;
}

/** Revoke a credential with audit logging. */
export async function revokeCredential(
	userId: string,
	orgId: string,
	type: UpsertCredentialInput['type'],
	actorId: string,
) {
	// Guarded for the same reason as issueCredential, and it is not obvious why:
	// "revoke" sounds like it can only ever narrow an existing row, but it goes
	// through the same `upsertCredential`, whose `create` branch fires when no
	// row matches. Ungated, this mints a REVOKED credential on a stranger's
	// account attributed to this org — and `getCredentialsByUserId` has no org
	// filter, so the victim sees it on their own credentials page.
	// `acceptExistingCredential` is set here and NOWHERE else. Revocation is
	// strictly narrowing — it can downgrade an existing row but never mint
	// privilege — so accepting "we already issued this person a credential"
	// cannot bootstrap itself the way it would on the issue path. Without it, a
	// volunteer removed from the roster keeps a credential that `listOrgCredentials`
	// still shows but nobody can revoke.
	const relationship = await requireOrgVolunteerRelationship(orgId, userId, {
		acceptExistingCredential: true,
	});

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
			metadata: { userId, type, relationship },
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
