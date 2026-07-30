import { TRPCError } from '@trpc/server';
import type { Role } from '@/prisma/generated/client';
import { normalizeEmail } from '@/server/domain/org-volunteer';
import { roleRank } from '@/server/domain/permissions';
import { generateToken, hashToken } from '@/server/lib/tokens';
import { writeAuditLogTx } from '@/server/repositories/auditRepo';
import {
	findInvitationByHash,
	findValidInvitationByHash,
	markInvitationUsed,
} from '@/server/repositories/inviteRepo';
import { prisma } from '@/server/repositories/prisma';
import { sendInviteEmail } from '@/server/repositories/sendInviteEmail';
import { findEmailByUserId } from '@/server/repositories/userAccountStateRepo';

const INVITE_EXPIRY_HOURS = 48;

export async function inviteMember(
	orgId: string,
	email: string,
	role: Role,
	baseUrl: string,
	actorId?: string | null,
	actorRole?: Role | null,
) {
	// Business rule: ADMIN can only invite STAFF or READONLY, not ADMIN
	if (actorRole === 'ADMIN' && roleRank[role] >= roleRank.ADMIN) {
		throw new TRPCError({
			code: 'FORBIDDEN',
			message: 'Admins can only invite Staff or Read-only members.',
		});
	}

	const org = await prisma.organization.findUnique({
		where: { id: orgId },
		select: { name: true },
	});
	if (!org) throw new Error('Organization not found.');

	// Don't invite someone who is already a member
	const existingMember = await prisma.user.findFirst({
		where: {
			email,
			memberships: { some: { organizationId: orgId } },
		},
	});
	if (existingMember) {
		throw new Error('This person is already a member of your organization.');
	}

	const rawToken = generateToken();
	const tokenHash = hashToken(rawToken);
	const expiresAt = new Date(Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000);

	// Transactional: create invitation + audit log atomically
	await prisma.$transaction(async (tx) => {
		await tx.organizationInvitation.create({
			data: { orgId, email, role, tokenHash, expiresAt },
		});
		await writeAuditLogTx(tx, {
			orgId,
			actorId: actorId ?? null,
			action: 'MEMBER_INVITED',
			entityType: 'OrganizationInvitation',
			metadata: { email, role },
		});
	});

	await sendInviteEmail({
		to: email,
		orgName: org.name,
		inviteLink: `${baseUrl}/invite/${rawToken}`,
		role,
	});

	return { sent: true };
}

export async function getInvitationDetails(rawToken: string) {
	return findInvitationByHash(hashToken(rawToken));
}

/**
 * Accept an org invitation for `userId`.
 *
 * SECURITY: takes only a user id. The address is resolved from that SAME id
 * rather than accepted from the caller, because `createTRPCContext` builds the
 * session as `{ ...realSession.user, id: effectiveUserId }` — under
 * impersonation only `id` is swapped, so `ctx.session.user.email` stays the real
 * admin's. Authorizing on that email while creating the membership row for the
 * impersonated id let an admin holding an invitation addressed to THEMSELVES
 * mint an `OrganizationMember` row for the impersonated victim — and
 * `ORG_MEMBER` is one of the relationship kinds
 * `requireOrgVolunteerRelationship()` accepts as authorization over a volunteer.
 * Same fix, and the same reasoning, as `claimApplication()`.
 */
export async function acceptInvitation(rawToken: string, userId: string) {
	const invitation = await findValidInvitationByHash(hashToken(rawToken));
	if (!invitation) {
		throw new Error('This invitation is invalid or has expired.');
	}

	const userEmail = await findEmailByUserId(userId);

	if (!userEmail) {
		// TRPCError, not a plain Error: tRPC maps plain Errors to
		// INTERNAL_SERVER_ERROR, which would report a fact about the caller's own
		// account as a server fault and get redacted by `safeErrorMessage()`. The
		// router used to raise BAD_REQUEST here before this check moved inwards.
		// Matches `acceptCompanyInvite`'s code for the identical condition.
		throw new TRPCError({
			code: 'PRECONDITION_FAILED',
			message: 'Your account has no email address on file.',
		});
	}

	if (normalizeEmail(invitation.email) !== normalizeEmail(userEmail)) {
		throw new Error('This invitation was sent to a different email address.');
	}

	// Already a member — still mark the token used, return gracefully
	const existing = await prisma.organizationMember.findFirst({
		where: { organizationId: invitation.orgId, userId },
	});
	if (existing) {
		await markInvitationUsed(invitation.id);
		return { orgId: invitation.orgId, alreadyMember: true };
	}

	// Atomically mark invitation used and add member
	await prisma.$transaction(async (tx) => {
		await tx.organizationInvitation.update({
			where: { id: invitation.id },
			data: { usedAt: new Date() },
		});
		await tx.organizationMember.create({
			data: {
				organizationId: invitation.orgId,
				userId,
				role: invitation.role,
			},
		});
	});

	return { orgId: invitation.orgId, alreadyMember: false };
}

export async function listOrgMembers(orgId: string) {
	return prisma.organizationMember.findMany({
		where: { organizationId: orgId },
		include: {
			user: { select: { id: true, name: true, email: true } },
		},
		orderBy: { createdAt: 'asc' },
	});
}

export async function removeOrgMember(
	orgId: string,
	actingUserId: string,
	targetMemberId: string,
) {
	await prisma.$transaction(async (tx) => {
		const target = await tx.organizationMember.findFirst({
			where: { id: targetMemberId, organizationId: orgId },
			select: { userId: true, role: true },
		});
		if (!target) throw new Error('Member not found.');
		if (target.role === 'OWNER') {
			throw new Error('Cannot remove the organization owner.');
		}
		if (target.userId === actingUserId) {
			throw new Error('Cannot remove yourself.');
		}

		await tx.organizationMember.delete({ where: { id: targetMemberId } });
		await writeAuditLogTx(tx, {
			orgId,
			actorId: actingUserId,
			action: 'MEMBER_REMOVED',
			entityType: 'OrganizationMember',
			entityId: targetMemberId,
			metadata: { targetUserId: target.userId, role: target.role },
		});
	});

	return { removed: true };
}

export async function updateOrgMemberRole(
	orgId: string,
	actingUserId: string,
	targetMemberId: string,
	newRole: Role,
) {
	// Validate newRole before entering transaction
	if (newRole === 'OWNER') {
		throw new Error('Cannot promote to owner via this action.');
	}

	const updated = await prisma.$transaction(async (tx) => {
		const target = await tx.organizationMember.findFirst({
			where: { id: targetMemberId, organizationId: orgId },
			select: { userId: true, role: true },
		});
		if (!target) throw new Error('Member not found.');
		if (target.role === 'OWNER') {
			throw new Error("Cannot change the owner's role.");
		}
		if (target.userId === actingUserId) {
			throw new Error('Cannot change your own role.');
		}

		// No-op: skip if role is already the target value
		if (target.role === newRole) {
			return tx.organizationMember.findFirst({
				where: { id: targetMemberId, organizationId: orgId },
			});
		}

		const previousRole = target.role;
		const member = await tx.organizationMember.update({
			where: { id: targetMemberId },
			data: { role: newRole },
		});
		await writeAuditLogTx(tx, {
			orgId,
			actorId: actingUserId,
			action: 'ROLE_CHANGED',
			entityType: 'OrganizationMember',
			entityId: targetMemberId,
			metadata: {
				targetUserId: target.userId,
				previousRole,
				newRole,
			},
		});
		return member;
	});

	return updated;
}
