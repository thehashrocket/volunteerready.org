/**
 * credentialShareService.ts — Business logic for credential sharing.
 *
 * Data flow for share + claim:
 *
 *   generateShareToken(credentialId, userId)
 *     └─ validate ownership + VERIFIED status
 *     └─ $transaction: create CredentialShareToken + audit log
 *     └─ return rawToken
 *
 *   claimShareToken(rawToken, claimingOrgId, actorId)
 *     └─ hash token → lookup
 *     └─ validate all guards (see domain/credential-sharing.ts)
 *     └─ check no duplicate credential in claiming org
 *     └─ $transaction:
 *         ├─ upsert credential (with provenance fields)
 *         ├─ optimistic lock: mark token CLAIMED
 *         └─ audit log
 *     └─ fire-and-forget: send claim notification email
 *
 *   shareAllOnApply(userId, targetOrgId)
 *     └─ fetch all VERIFIED creds for user
 *     └─ batch check which already exist in target org
 *     └─ for each eligible: generate token + immediately claim
 *     └─ all inside single transaction
 */

import { TRPCError } from '@trpc/server';
import { Prisma } from '@/prisma/generated/client';
import {
	canClaimToken,
	canShareCredential,
	computeTokenExpiry,
} from '@/server/domain/credential-sharing';
import { generateToken, hashToken } from '@/server/lib/tokens';
import { writeAuditLogTx } from '@/server/repositories/auditRepo';
import {
	countClaimedOrgsForCredential,
	countVerifiedCredentialsExcludingOrg,
	createShareTokenTx,
	findShareTokenByHash,
	getVerifiedCredentialsByUser,
	listShareTokensByUser,
	markTokenClaimedTx,
	markTokenExpiredTx,
} from '@/server/repositories/credentialShareTokenRepo';
import { prisma } from '@/server/repositories/prisma';
import { sendCredentialClaimedEmail } from '@/server/repositories/sendCredentialClaimedEmail';
import { sendCredentialRequestEmail } from '@/server/repositories/sendCredentialRequestEmail';
import {
	findCredentialByUserOrgType,
	getCredentialsByUserAndOrg,
} from '@/server/repositories/volunteerCredentialRepo';

// ---------------------------------------------------------------------------
// Generate
// ---------------------------------------------------------------------------

/** Volunteer generates a share link for one of their VERIFIED credentials. */
export async function generateShareToken(credentialId: string, userId: string) {
	// Fetch credential with org info
	const credential = await prisma.volunteerCredential.findUnique({
		where: { id: credentialId },
		select: {
			id: true,
			userId: true,
			orgId: true,
			type: true,
			status: true,
			expiresAt: true,
		},
	});

	if (!credential) {
		throw new TRPCError({
			code: 'NOT_FOUND',
			message: 'Credential not found.',
		});
	}
	if (credential.userId !== userId) {
		throw new TRPCError({ code: 'FORBIDDEN', message: 'Not your credential.' });
	}
	if (!canShareCredential(credential.status, credential.expiresAt)) {
		throw new TRPCError({
			code: 'BAD_REQUEST',
			message: 'Only verified, non-expired credentials can be shared.',
		});
	}

	const rawToken = generateToken();
	const tokenHash = hashToken(rawToken);
	const expiresAt = computeTokenExpiry();

	try {
		await prisma.$transaction(async (tx) => {
			await createShareTokenTx(tx, {
				credentialId: credential.id,
				createdByUserId: userId,
				tokenHash,
				expiresAt,
			});

			await writeAuditLogTx(tx, {
				orgId: credential.orgId,
				actorId: userId,
				action: 'CREDENTIAL_SHARE_TOKEN_CREATED',
				entityType: 'CredentialShareToken',
				entityId: credential.id,
				metadata: {
					credentialId: credential.id,
					type: credential.type,
					expiresAt: expiresAt.toISOString(),
				},
			});
		});
	} catch (e) {
		// P2002 on tokenHash = hash collision. Retry once with new token.
		if (
			e instanceof Prisma.PrismaClientKnownRequestError &&
			e.code === 'P2002'
		) {
			const retryRaw = generateToken();
			const retryHash = hashToken(retryRaw);

			await prisma.$transaction(async (tx) => {
				await createShareTokenTx(tx, {
					credentialId: credential.id,
					createdByUserId: userId,
					tokenHash: retryHash,
					expiresAt,
				});

				await writeAuditLogTx(tx, {
					orgId: credential.orgId,
					actorId: userId,
					action: 'CREDENTIAL_SHARE_TOKEN_CREATED',
					entityType: 'CredentialShareToken',
					entityId: credential.id,
					metadata: {
						credentialId: credential.id,
						type: credential.type,
						expiresAt: expiresAt.toISOString(),
						retried: true,
					},
				});
			});

			return { rawToken: retryRaw, expiresAt };
		}
		throw e;
	}

	return { rawToken, expiresAt };
}

// ---------------------------------------------------------------------------
// Token Info (public preview)
// ---------------------------------------------------------------------------

/** Public preview of a share token — minimal disclosure (type + org name only). */
export async function getTokenInfo(rawToken: string) {
	const tokenHash = hashToken(rawToken);
	const token = await findShareTokenByHash(tokenHash);

	if (!token) {
		throw new TRPCError({ code: 'NOT_FOUND', message: 'Invalid share link.' });
	}
	if (token.status !== 'ACTIVE') {
		throw new TRPCError({
			code: 'BAD_REQUEST',
			message:
				token.status === 'CLAIMED'
					? 'This credential has already been claimed.'
					: 'This share link has expired.',
		});
	}
	if (token.expiresAt <= new Date()) {
		throw new TRPCError({
			code: 'BAD_REQUEST',
			message: 'This share link has expired.',
		});
	}

	return {
		credentialType: token.credential.type,
		issuingOrgName: token.credential.organization.name,
		expiresAt: token.expiresAt,
	};
}

// ---------------------------------------------------------------------------
// Claim
// ---------------------------------------------------------------------------

/** Staff claims a shared credential into their organization. */
export async function claimShareToken(
	rawToken: string,
	claimingOrgId: string,
	actorId: string,
) {
	const tokenHash = hashToken(rawToken);
	const token = await findShareTokenByHash(tokenHash);

	if (!token) {
		throw new TRPCError({ code: 'NOT_FOUND', message: 'Invalid share link.' });
	}

	// Run all claim guards
	const check = canClaimToken({
		tokenStatus: token.status,
		tokenExpiresAt: token.expiresAt,
		credentialStatus: token.credential.status,
		credentialExpiresAt: token.credential.expiresAt,
		claimingOrgId,
		credentialOrgId: token.credential.orgId,
	});

	if (!check.ok) {
		throw new TRPCError({ code: 'BAD_REQUEST', message: check.reason! });
	}

	// Check for duplicate credential in claiming org
	const existing = await findCredentialByUserOrgType(
		token.credential.userId,
		claimingOrgId,
		token.credential.type,
	);
	if (existing) {
		throw new TRPCError({
			code: 'CONFLICT',
			message: `This organization already has a ${token.credential.type.replace(/_/g, ' ').toLowerCase()} credential for this volunteer.`,
		});
	}

	// Claim inside transaction with optimistic lock
	const result = await prisma.$transaction(async (tx) => {
		// Optimistic lock — returns null if already claimed
		const claimed = await markTokenClaimedTx(tx, token.id, claimingOrgId);
		if (!claimed) {
			throw new TRPCError({
				code: 'CONFLICT',
				message: 'This credential has already been claimed.',
			});
		}

		// Create credential copy with provenance
		const credential = await tx.volunteerCredential.create({
			data: {
				userId: token.credential.userId,
				orgId: claimingOrgId,
				type: token.credential.type,
				status: 'VERIFIED',
				issuedAt: token.credential.issuedAt,
				expiresAt: token.credential.expiresAt,
				notes: token.credential.notes,
				issuedById: token.credential.issuedById,
				sharedFromOrgId: token.credential.orgId,
				sharedFromCredentialId: token.credential.id,
			},
		});

		await writeAuditLogTx(tx, {
			orgId: claimingOrgId,
			actorId,
			action: 'CREDENTIAL_CLAIMED_VIA_SHARE',
			entityType: 'VolunteerCredential',
			entityId: credential.id,
			metadata: {
				tokenId: token.id,
				sourceOrgId: token.credential.orgId,
				type: token.credential.type,
				volunteerId: token.credential.userId,
			},
		});

		return credential;
	});

	// Fire-and-forget: notify the volunteer
	try {
		if (token.createdBy.email) {
			const claimingOrg = await prisma.organization.findUnique({
				where: { id: claimingOrgId },
				select: { name: true },
			});
			await sendCredentialClaimedEmail({
				to: token.createdBy.email,
				volunteerName: token.createdBy.name ?? '',
				credentialType: token.credential.type,
				claimingOrgName: claimingOrg?.name ?? 'an organization',
			});
		}
	} catch {
		// Email failure must not block the claim
		console.error(
			'[credentialShareService] Failed to send claim notification email',
		);
	}

	return result;
}

// ---------------------------------------------------------------------------
// Revoke
// ---------------------------------------------------------------------------

/** Volunteer revokes their own share token. */
export async function revokeShareToken(tokenId: string, userId: string) {
	const token = await prisma.credentialShareToken.findUnique({
		where: { id: tokenId },
		select: {
			id: true,
			createdByUserId: true,
			status: true,
			credentialId: true,
		},
	});

	if (!token) {
		throw new TRPCError({ code: 'NOT_FOUND', message: 'Token not found.' });
	}
	if (token.createdByUserId !== userId) {
		throw new TRPCError({ code: 'FORBIDDEN', message: 'Not your token.' });
	}
	if (token.status !== 'ACTIVE') {
		throw new TRPCError({
			code: 'BAD_REQUEST',
			message: 'Only active tokens can be revoked.',
		});
	}

	await prisma.$transaction(async (tx) => {
		await markTokenExpiredTx(tx, token.id);

		await writeAuditLogTx(tx, {
			actorId: userId,
			action: 'CREDENTIAL_SHARE_TOKEN_REVOKED',
			entityType: 'CredentialShareToken',
			entityId: token.id,
			metadata: { credentialId: token.credentialId },
		});
	});

	return { revoked: true };
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

/** Get all share tokens for a volunteer. */
export async function getMyShareTokens(userId: string) {
	return listShareTokensByUser(userId);
}

/** Get share count for a credential. */
export async function getShareCount(credentialId: string) {
	return countClaimedOrgsForCredential(credentialId);
}

// ---------------------------------------------------------------------------
// Share All On Apply
// ---------------------------------------------------------------------------

/**
 * Auto-share all verified credentials with a target org during application.
 * Creates tokens + immediately claims them for audit trail.
 * Skips credentials that already exist in the target org.
 */
export async function shareAllOnApply(userId: string, targetOrgId: string) {
	const verifiedCreds = await getVerifiedCredentialsByUser(userId);
	if (verifiedCreds.length === 0) return { shared: 0 };

	// Batch check: which credential types already exist in target org?
	const existingInTarget = await getCredentialsByUserAndOrg(
		userId,
		targetOrgId,
	);
	const existingTypes = new Set(existingInTarget.map((c) => c.type));

	// Filter to eligible credentials (not already in target org, not from target org)
	const eligible = verifiedCreds.filter(
		(c) => !existingTypes.has(c.type) && c.orgId !== targetOrgId,
	);

	if (eligible.length === 0) return { shared: 0 };

	await prisma.$transaction(async (tx) => {
		for (const cred of eligible) {
			const rawToken = generateToken();
			const tokenHash = hashToken(rawToken);
			const expiresAt = computeTokenExpiry();

			// Create token (for audit trail)
			const shareToken = await createShareTokenTx(tx, {
				credentialId: cred.id,
				createdByUserId: userId,
				tokenHash,
				expiresAt,
			});

			// Immediately claim
			await tx.credentialShareToken.update({
				where: { id: shareToken.id },
				data: {
					status: 'CLAIMED',
					claimedByOrgId: targetOrgId,
					claimedAt: new Date(),
				},
			});

			// Create credential copy with provenance
			await tx.volunteerCredential.create({
				data: {
					userId,
					orgId: targetOrgId,
					type: cred.type,
					status: 'VERIFIED',
					issuedAt: cred.issuedAt,
					expiresAt: cred.expiresAt,
					notes: cred.notes,
					issuedById: cred.issuedById,
					sharedFromOrgId: cred.orgId,
					sharedFromCredentialId: cred.id,
				},
			});
		}

		await writeAuditLogTx(tx, {
			orgId: targetOrgId,
			actorId: userId,
			action: 'CREDENTIALS_SHARED_ON_APPLY',
			entityType: 'VolunteerCredential',
			metadata: {
				credentialCount: eligible.length,
				types: eligible.map((c) => c.type),
			},
		});
	});

	return { shared: eligible.length };
}

// ---------------------------------------------------------------------------
// Org-Initiated Credential Request
// ---------------------------------------------------------------------------

/** Count how many verified credentials a volunteer has at other orgs. */
export async function getExternalCredentialCount(
	userId: string,
	orgId: string,
) {
	return countVerifiedCredentialsExcludingOrg(userId, orgId);
}

/** Staff requests a volunteer to share their credentials. Sends an email. */
export async function requestCredentialSharing(opts: {
	applicationId: string;
	orgId: string;
	actorId: string;
	baseUrl: string;
}) {
	const application = await prisma.volunteerApplication.findFirst({
		where: { id: opts.applicationId, orgId: opts.orgId },
		select: {
			id: true,
			submittedByUserId: true,
			submittedByEmail: true,
			submittedByUser: { select: { name: true, email: true } },
		},
	});

	if (!application) {
		throw new TRPCError({
			code: 'NOT_FOUND',
			message: 'Application not found.',
		});
	}
	if (!application.submittedByUserId) {
		throw new TRPCError({
			code: 'BAD_REQUEST',
			message: 'Cannot request credentials from an anonymous applicant.',
		});
	}

	const volunteerEmail =
		application.submittedByUser?.email ?? application.submittedByEmail;
	if (!volunteerEmail) {
		throw new TRPCError({
			code: 'BAD_REQUEST',
			message: 'Volunteer has no email on file.',
		});
	}

	const org = await prisma.organization.findUnique({
		where: { id: opts.orgId },
		select: { name: true },
	});

	await sendCredentialRequestEmail({
		to: volunteerEmail,
		volunteerName: application.submittedByUser?.name ?? '',
		orgName: org?.name ?? 'An organization',
		profileUrl: `${opts.baseUrl}/app/profile`,
	});

	await writeAuditLogTx(
		prisma as Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
		{
			orgId: opts.orgId,
			actorId: opts.actorId,
			action: 'CREDENTIAL_SHARING_REQUESTED',
			entityType: 'VolunteerApplication',
			entityId: opts.applicationId,
			metadata: { volunteerId: application.submittedByUserId },
		},
	);

	return { sent: true };
}
