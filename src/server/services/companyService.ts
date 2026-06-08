import { TRPCError } from '@trpc/server';
import { findUniqueSlug, generateSlug } from '@/lib/slug';
import type { CompanyMemberRole } from '@/prisma/generated/client';
import { Prisma } from '@/prisma/generated/client';
import { sendNewCompanyAlert } from '../lib/admin-alerts';
import { sendEmail } from '../lib/email';
import { generateToken, hashToken } from '../lib/tokens';
import { writeAuditLogTx } from '../repositories/auditRepo';
import {
	createCompanyInvitationTx,
	findCompanyInvitationByTokenHash,
	markCompanyInvitationUsedTx,
} from '../repositories/companyInviteRepo';
import {
	createCompanyWithOwnerTx,
	findCompanyBySlug,
	getCompanyMembership,
	setNonprofitLinkStatusTx,
	upsertNonprofitLinkTx,
} from '../repositories/companyRepo';
import { prisma } from '../repositories/prisma';

const INVITE_EXPIRY_HOURS = 48;

// ---------------------------------------------------------------------------
// Company creation
// ---------------------------------------------------------------------------

export async function createCompany(opts: {
	name: string;
	userId: string;
	sessionToken: string;
}) {
	const base = generateSlug(opts.name);
	if (!base) {
		throw new TRPCError({
			code: 'BAD_REQUEST',
			message: 'Company name cannot produce a valid slug.',
		});
	}

	const slug = await findUniqueSlug(base, async (candidate) => {
		return (await findCompanyBySlug(candidate)) !== null;
	});

	try {
		const company = await prisma.$transaction(async (tx) => {
			const newCompany = await createCompanyWithOwnerTx(tx, {
				name: opts.name,
				slug,
				userId: opts.userId,
				sessionToken: opts.sessionToken,
			});

			await writeAuditLogTx(tx, {
				companyId: newCompany.id,
				actorId: opts.userId,
				action: 'COMPANY_CREATED',
				entityType: 'CompanyAccount',
				entityId: newCompany.id,
				metadata: { name: opts.name, slug: newCompany.slug },
			});

			return newCompany;
		});

		sendNewCompanyAlert({ id: company.id, name: opts.name, slug }).catch(
			(err) =>
				console.error('[companyService] Failed to send new company alert:', err),
		);

		return company;
	} catch (e) {
		if (
			e instanceof Prisma.PrismaClientKnownRequestError &&
			e.code === 'P2002'
		) {
			throw new TRPCError({
				code: 'CONFLICT',
				message: 'A slug conflict occurred. Please try again.',
			});
		}
		throw e;
	}
}

// ---------------------------------------------------------------------------
// Company switching
// ---------------------------------------------------------------------------

export async function switchCompanyForSession(opts: {
	userId: string;
	sessionToken: string;
	targetCompanyId: string;
}) {
	const membership = await getCompanyMembership(
		opts.userId,
		opts.targetCompanyId,
	);
	if (!membership) {
		throw new TRPCError({
			code: 'FORBIDDEN',
			message: 'Not a member of that company.',
		});
	}

	await prisma.$transaction(async (tx) => {
		await tx.session.update({
			where: { sessionToken: opts.sessionToken },
			data: { currentCompanyId: opts.targetCompanyId },
		});

		await writeAuditLogTx(tx, {
			companyId: opts.targetCompanyId,
			actorId: opts.userId,
			action: 'COMPANY_SWITCH',
			entityType: 'CompanyAccount',
			entityId: opts.targetCompanyId,
		});
	});

	return { companyId: opts.targetCompanyId, role: membership.role };
}

// ---------------------------------------------------------------------------
// Nonprofit linking
// ---------------------------------------------------------------------------

export async function linkNonprofit(opts: {
	companyId: string;
	orgId: string;
	actorId: string;
}) {
	const link = await prisma.$transaction(async (tx) => {
		const result = await upsertNonprofitLinkTx(tx, {
			companyId: opts.companyId,
			orgId: opts.orgId,
		});

		await writeAuditLogTx(tx, {
			companyId: opts.companyId,
			actorId: opts.actorId,
			action: 'COMPANY_NONPROFIT_LINKED',
			entityType: 'CompanyNonprofitLink',
			entityId: result.id,
			metadata: { orgId: opts.orgId },
		});

		return result;
	});

	return link;
}

export async function unlinkNonprofit(opts: {
	companyId: string;
	orgId: string;
	actorId: string;
}) {
	// Find the link first
	const existing = await prisma.companyNonprofitLink.findUnique({
		where: {
			companyId_orgId: { companyId: opts.companyId, orgId: opts.orgId },
		},
		select: { id: true },
	});
	if (!existing) {
		throw new TRPCError({ code: 'NOT_FOUND', message: 'Link not found.' });
	}

	await prisma.$transaction(async (tx) => {
		await setNonprofitLinkStatusTx(tx, existing.id, 'PAUSED');

		await writeAuditLogTx(tx, {
			companyId: opts.companyId,
			actorId: opts.actorId,
			action: 'COMPANY_NONPROFIT_UNLINKED',
			entityType: 'CompanyNonprofitLink',
			entityId: existing.id,
			metadata: { orgId: opts.orgId },
		});
	});

	return { unlinked: true };
}

// ---------------------------------------------------------------------------
// Member invitations
// ---------------------------------------------------------------------------

export async function inviteCompanyMember(opts: {
	companyId: string;
	email: string;
	role: CompanyMemberRole;
	actorId: string;
	baseUrl: string;
}) {
	const company = await prisma.companyAccount.findUnique({
		where: { id: opts.companyId },
		select: { name: true },
	});
	if (!company)
		throw new TRPCError({ code: 'NOT_FOUND', message: 'Company not found.' });

	// Don't invite someone who is already a member
	const existingMember = await prisma.user.findFirst({
		where: {
			email: opts.email,
			companyMemberships: { some: { companyId: opts.companyId } },
		},
	});
	if (existingMember) {
		throw new TRPCError({
			code: 'CONFLICT',
			message: 'This person is already a member of your company.',
		});
	}

	const rawToken = generateToken();
	const tokenHash = hashToken(rawToken);
	const expiresAt = new Date(Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000);

	await prisma.$transaction(async (tx) => {
		await createCompanyInvitationTx(tx, {
			companyId: opts.companyId,
			email: opts.email,
			role: opts.role,
			tokenHash,
			expiresAt,
		});

		await writeAuditLogTx(tx, {
			companyId: opts.companyId,
			actorId: opts.actorId,
			action: 'COMPANY_MEMBER_INVITED',
			entityType: 'CompanyInvitation',
			metadata: { email: opts.email, role: opts.role },
		});
	});

	const sent = await sendEmail(
		opts.email,
		`You've been invited to join ${company.name} on VolunteerReady`,
		`
        <p>You've been invited to join <strong>${company.name}</strong> as <strong>${opts.role}</strong>.</p>
        <p><a href="${opts.baseUrl}/invite/company/${rawToken}" style="color: #1B3C2A;">Accept invitation</a></p>
        <p>This invitation expires in ${INVITE_EXPIRY_HOURS} hours. If you didn't expect this, you can ignore this email.</p>
    `,
	);

	return { sent };
}

export async function acceptCompanyInvite(opts: {
	tokenHash: string;
	userId: string;
	userEmail: string;
}) {
	const invitation = await findCompanyInvitationByTokenHash(opts.tokenHash);

	if (!invitation) {
		throw new TRPCError({
			code: 'NOT_FOUND',
			message: 'This invitation link is invalid.',
		});
	}

	if (invitation.usedAt) {
		throw new TRPCError({
			code: 'BAD_REQUEST',
			message: 'This invitation has already been used.',
		});
	}

	if (invitation.expiresAt < new Date()) {
		throw new TRPCError({
			code: 'BAD_REQUEST',
			message: 'This invitation has expired.',
		});
	}

	if (invitation.email.toLowerCase() !== opts.userEmail.toLowerCase()) {
		throw new TRPCError({
			code: 'FORBIDDEN',
			message: 'This invitation was sent to a different email address.',
		});
	}

	// Already a member — mark token used and return gracefully
	const existing = await prisma.companyMember.findUnique({
		where: {
			companyId_userId: {
				companyId: invitation.companyId,
				userId: opts.userId,
			},
		},
	});
	if (existing) {
		await prisma.companyInvitation.update({
			where: { id: invitation.id },
			data: { usedAt: new Date() },
		});
		return { companyId: invitation.companyId, alreadyMember: true };
	}

	try {
		await prisma.$transaction(async (tx) => {
			await markCompanyInvitationUsedTx(tx, invitation.id);

			await tx.companyMember.create({
				data: {
					companyId: invitation.companyId,
					userId: opts.userId,
					role: invitation.role,
				},
			});

			await writeAuditLogTx(tx, {
				companyId: invitation.companyId,
				actorId: opts.userId,
				action: 'COMPANY_MEMBER_ADDED',
				entityType: 'CompanyMember',
				metadata: { email: opts.userEmail, role: invitation.role },
			});
		});
	} catch (err) {
		// P2002 on CompanyMember(companyId, userId) means a concurrent request
		// already accepted this invite — treat as "already a member".
		if (
			err instanceof Prisma.PrismaClientKnownRequestError &&
			err.code === 'P2002'
		) {
			return { companyId: invitation.companyId, alreadyMember: true };
		}
		throw err;
	}

	return { companyId: invitation.companyId, alreadyMember: false };
}
