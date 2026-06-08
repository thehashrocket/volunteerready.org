import { TRPCError } from '@trpc/server';
import { findUniqueSlug, generateSlug } from '@/lib/slug';
import { Prisma } from '@/prisma/generated/client';
import { sendNewOrgAlert } from '@/server/lib/admin-alerts';
import { writeAuditLogTx } from '../repositories/auditRepo';
import {
	findOrgBySlug,
	getFirstOrgForUser,
	userIsMemberOfOrg,
} from '../repositories/orgRepo';
import { prisma } from '../repositories/prisma';
import { seedDefaultQuestions } from '../repositories/screenerQuestionsRepo';
import { getSessionByToken } from '../repositories/sessionRepo';

/**
 * Switch org for the *current session*.
 * Source of truth: Session.currentOrgId in DB.
 */
export async function switchOrgForSession(opts: {
	userId: string;
	sessionToken: string;
	targetOrgId: string;
}) {
	// 1) Verify membership
	const membership = await userIsMemberOfOrg(opts.userId, opts.targetOrgId);
	if (!membership) {
		throw new TRPCError({
			code: 'FORBIDDEN',
			message: 'Not a member of that organization.',
		});
	}

	// 2) Update session + audit atomically
	await prisma.$transaction(async (tx) => {
		await tx.session.update({
			where: { sessionToken: opts.sessionToken },
			data: { currentOrgId: opts.targetOrgId },
		});

		await writeAuditLogTx(tx, {
			orgId: opts.targetOrgId,
			actorId: opts.userId,
			action: 'ORG_SWITCH',
			entityType: 'Organization',
			entityId: opts.targetOrgId,
		});
	});

	return { orgId: opts.targetOrgId, role: membership.role };
}

/**
 * Create a new organization and make the user its OWNER.
 * Generates a unique slug from the name, persists org + membership
 * atomically, sets the session's currentOrgId, and writes an audit log.
 */
export async function createOrg(opts: {
	name: string;
	userId: string;
	sessionToken: string;
}) {
	const base = generateSlug(opts.name);
	if (!base) {
		throw new TRPCError({
			code: 'BAD_REQUEST',
			message: 'Organization name cannot produce a valid slug.',
		});
	}

	const slug = await findUniqueSlug(base, async (candidate) => {
		return (await findOrgBySlug(candidate)) !== null;
	});

	let org: { id: string; name: string; slug: string };
	try {
		org = await prisma.$transaction(async (tx) => {
			// Create org + owner membership
			const newOrg = await tx.organization.create({
				data: { name: opts.name, slug },
				select: { id: true, name: true, slug: true },
			});

			await tx.organizationMember.create({
				data: {
					organizationId: newOrg.id,
					userId: opts.userId,
					role: 'OWNER',
				},
			});

			// Set session's current org
			await tx.session.update({
				where: { sessionToken: opts.sessionToken },
				data: { currentOrgId: newOrg.id },
			});

			// Seed default screener questions
			await seedDefaultQuestions(newOrg.id, tx);

			// Audit — committed atomically with the create
			await writeAuditLogTx(tx, {
				orgId: newOrg.id,
				actorId: opts.userId,
				action: 'ORG_CREATED',
				entityType: 'Organization',
				entityId: newOrg.id,
				metadata: { name: newOrg.name, slug: newOrg.slug },
			});

			return newOrg;
		});
	} catch (e) {
		if (
			e instanceof Prisma.PrismaClientKnownRequestError &&
			e.code === 'P2002'
		) {
			throw new TRPCError({
				code: 'CONFLICT',
				message: 'A unique-constraint conflict occurred. Please try again.',
			});
		}
		throw e;
	}

	sendNewOrgAlert(org).catch((err) =>
		console.error('[orgService] Failed to send new org alert:', err),
	);

	return org;
}

/**
 * Ensure currentOrgId is valid; fallback to first org if missing/invalid.
 * Handy to call during session callback or context init if you want auto-healing.
 */
export async function ensureValidCurrentOrg(opts: {
	userId: string;
	sessionToken: string;
}) {
	const session = await getSessionByToken(opts.sessionToken);
	if (!session) return null;

	if (session.currentOrgId) {
		const membership = await userIsMemberOfOrg(
			opts.userId,
			session.currentOrgId,
		);
		if (membership)
			return { orgId: session.currentOrgId, role: membership.role };
	}

	const first = await getFirstOrgForUser(opts.userId);
	const fallbackOrgId = first?.organizationId ?? null;

	await prisma.session.update({
		where: { sessionToken: opts.sessionToken },
		data: { currentOrgId: fallbackOrgId },
	});

	return first ? { orgId: first.organizationId, role: first.role } : null;
}
