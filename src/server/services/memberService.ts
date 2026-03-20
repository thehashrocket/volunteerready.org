import type { Role } from '@/prisma/generated/client';
import { generateToken, hashToken } from '@/server/lib/tokens';
import { writeAuditLog } from '@/server/repositories/auditRepo';
import {
	createInvitation,
	findInvitationByHash,
	findValidInvitationByHash,
	markInvitationUsed,
} from '@/server/repositories/inviteRepo';
import { prisma } from '@/server/repositories/prisma';
import { sendInviteEmail } from '@/server/repositories/sendInviteEmail';

const INVITE_EXPIRY_HOURS = 48;

export async function inviteMember(
	orgId: string,
	email: string,
	role: Role,
	baseUrl: string,
	actorId?: string | null,
) {
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

	await createInvitation({ orgId, email, role, tokenHash, expiresAt });
	await sendInviteEmail({
		to: email,
		orgName: org.name,
		inviteLink: `${baseUrl}/invite/${rawToken}`,
		role,
	});

	try {
		await writeAuditLog({
			orgId,
			actorId: actorId ?? null,
			action: 'MEMBER_INVITED',
			entityType: 'OrganizationInvitation',
			metadata: { email, role },
		});
	} catch {
		// Audit logging should never break the invite flow
	}

	return { sent: true };
}

export async function getInvitationDetails(rawToken: string) {
	return findInvitationByHash(hashToken(rawToken));
}

export async function acceptInvitation(
	rawToken: string,
	userId: string,
	userEmail: string,
) {
	const invitation = await findValidInvitationByHash(hashToken(rawToken));
	if (!invitation) {
		throw new Error('This invitation is invalid or has expired.');
	}

	if (invitation.email.toLowerCase() !== userEmail.toLowerCase()) {
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
	const target = await prisma.organizationMember.findFirst({
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

	await prisma.organizationMember.delete({ where: { id: targetMemberId } });
	return { removed: true };
}

export async function updateOrgMemberRole(
	orgId: string,
	actingUserId: string,
	targetMemberId: string,
	newRole: Role,
) {
	const target = await prisma.organizationMember.findFirst({
		where: { id: targetMemberId, organizationId: orgId },
		select: { userId: true, role: true },
	});
	if (!target) throw new Error('Member not found.');
	if (target.role === 'OWNER') {
		throw new Error("Cannot change the owner's role.");
	}
	if (newRole === 'OWNER') {
		throw new Error('Cannot promote to owner via this action.');
	}
	if (target.userId === actingUserId) {
		throw new Error('Cannot change your own role.');
	}

	return prisma.organizationMember.update({
		where: { id: targetMemberId },
		data: { role: newRole },
	});
}
