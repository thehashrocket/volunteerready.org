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

/**
 * Minimal Prisma surface shared by `prisma` and a `$transaction` client, so the
 * actor lookup can run inside an existing transaction where one is open
 * (`updateOrgMemberRole`) and outside one where none is (`inviteMember`).
 *
 * Deliberately NOT the repositories' `TxClient`
 * (`Parameters<Parameters<typeof prisma.$transaction>[0]>[0]`). That type already
 * exists in four hand-rolled copies across `repositories/` — a tracked P3 — and
 * it is a repository-layer type; importing it here would add a fifth copy AND
 * pull the whole client surface into a service. This names the one model and one
 * method the function actually uses, so widening what it can touch takes a
 * deliberate edit.
 */
type MemberReader = {
	organizationMember: {
		findFirst(args: {
			where: { organizationId: string; userId: string };
			select: { role: true };
		}): Promise<{ role: Role } | null>;
	};
};

/**
 * Resolve the acting user's role in `orgId` from the database.
 *
 * SECURITY: deliberately NOT a parameter. `inviteMember` used to take an
 * optional `actorRole`, which failed **open** — omit it and the ADMIN rule below
 * simply did not apply. The same lesson as the `email` parameters dropped in
 * v0.34.0.0: while the parameter exists, every callsite is one wrong argument
 * away from restoring the hole. Reading it here also snapshots the actor's role
 * in the same transaction as the target's, so a concurrent demotion cannot be
 * raced.
 *
 * Throws rather than returning null: a caller with no membership row in this org
 * has no business editing its roster of members at all.
 *
 * It ALSO re-asserts the ADMIN floor that `adminProcedure` checked, and that is
 * not redundant. `adminProcedure` reads `ctx.role`, resolved once when the
 * request context was built; this reads the row as it stands now. Without the
 * floor, the role we just paid a query for would gate only ADMIN *targets*
 * (`assertMayGrantRole` returns early below that tier), so a caller demoted
 * between context-build and service-call could still invite STAFF/READONLY or
 * flip members between them — member management fail-open beneath the ADMIN
 * tier. Since the row is already in hand, closing that costs nothing.
 */
async function resolveActingRole(
	db: MemberReader,
	orgId: string,
	actingUserId: string,
): Promise<Role> {
	const acting = actingUserId
		? await db.organizationMember.findFirst({
				where: { organizationId: orgId, userId: actingUserId },
				select: { role: true },
			})
		: null;
	if (!acting) {
		throw new TRPCError({
			code: 'FORBIDDEN',
			message: 'You are not a member of this organization.',
		});
	}
	if (roleRank[acting.role] < roleRank.ADMIN) {
		throw new TRPCError({
			code: 'FORBIDDEN',
			message: 'You do not have permission to manage members.',
		});
	}
	return acting.role;
}

/**
 * The ADMIN tier is OWNER-granted only.
 *
 * SECURITY: `members.invite` and `members.updateRole` are both `adminProcedure`,
 * which admits anyone at `roleRank >= ADMIN`. Without this, an ADMIN can spread
 * the ADMIN tier at will — by invitation, or by promoting an existing
 * STAFF/READONLY member. Neither is self-escalation nor a tenancy break, but
 * both are admin-tier privilege spread with no server-side control.
 *
 * One function rather than two inline conditionals because the rule had exactly
 * one of its two enforcement points: `inviteMember` checked it and
 * `updateOrgMemberRole` never did, while `settings/team`'s
 * `{isOwner && <SelectItem value="ADMIN">}` made it look enforced on both. A
 * rule with two callsites and one implementation is how the second one goes
 * missing. The client gate is an affordance; this is the control.
 */
function assertMayGrantRole(
	actorRole: Role,
	targetRole: Role,
	message: string,
): void {
	if (roleRank[targetRole] >= roleRank.ADMIN && actorRole !== 'OWNER') {
		throw new TRPCError({ code: 'FORBIDDEN', message });
	}
}

/**
 * `actorId` is REQUIRED, not optional as it was before v0.38.6.0. The acting
 * role is now resolved from it, so an absent actor is refused at runtime — and a
 * parameter the runtime demands but the signature marks optional is the same
 * shape as the `actorRole` parameter this replaced. Callers pass `?? ''`
 * explicitly; the empty string is refused, visibly, rather than skipping a check.
 */
export async function inviteMember(
	orgId: string,
	email: string,
	role: Role,
	baseUrl: string,
	actorId: string,
) {
	// Business rule: only an OWNER may invite at the ADMIN tier.
	const actorRole = await resolveActingRole(prisma, orgId, actorId);
	assertMayGrantRole(
		actorRole,
		role,
		'Only the organization owner can invite an Admin. Admins can invite Staff or Read-only members.',
	);

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
			actorId,
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
		// Only an OWNER may promote anyone TO the ADMIN tier. Resolved from the
		// database inside this transaction, never from a caller-supplied role —
		// see `resolveActingRole`.
		//
		// Deliberately BEFORE the target lookup, so the rule is "an ADMIN may not
		// submit `newRole: ADMIN`", full stop — not one conditioned on the target's
		// current role. That costs one confusing refusal (an ADMIN re-selecting
		// ADMIN on someone who already is one, which the no-op branch below would
		// otherwise have absorbed) and buys a rule that is true independent of any
		// other row's state, which is the one worth being able to reason about.
		const actorRole = await resolveActingRole(tx, orgId, actingUserId);
		assertMayGrantRole(
			actorRole,
			newRole,
			'Only the organization owner can grant the Admin role.',
		);

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
