import { TRPCError } from '@trpc/server';
import { findUniqueSlug, generateSlug } from '@/lib/slug';
import type { PrismaClient } from '@/prisma/generated/client';
import { Prisma } from '@/prisma/generated/client';
import { auditRepo } from '../repositories/auditRepo';
import { orgRepo } from '../repositories/orgRepo';
import { sessionRepo } from '../repositories/sessionRepo';

export function orgService(prisma: PrismaClient) {
	const orgs = orgRepo(prisma);
	const sessions = sessionRepo(prisma);
	const audit = auditRepo(prisma);

	return {
		/**
		 * Switch org for the *current session*.
		 * Source of truth: Session.currentOrgId in DB.
		 */
		async switchOrgForSession(opts: {
			userId: string;
			sessionToken: string;
			targetOrgId: string;
		}) {
			// 1) Verify membership
			const membership = await orgs.userIsMemberOfOrg(
				opts.userId,
				opts.targetOrgId,
			);
			if (!membership) {
				throw new TRPCError({
					code: 'FORBIDDEN',
					message: 'Not a member of that organization.',
				});
			}

			// 2) Update session
			await sessions.setCurrentOrgBySessionToken(
				opts.sessionToken,
				opts.targetOrgId,
			);

			// 3) Audit
			await audit.write({
				orgId: opts.targetOrgId,
				actorId: opts.userId,
				action: 'ORG_SWITCH',
				entityType: 'Organization',
				entityId: opts.targetOrgId,
			});

			return { orgId: opts.targetOrgId, role: membership.role };
		},

		/**
		 * Create a new organization and make the user its OWNER.
		 * Generates a unique slug from the name, persists org + membership
		 * atomically, sets the session's currentOrgId, and writes an audit log.
		 */
		async createOrg(opts: {
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
				return (await orgs.findBySlug(candidate)) !== null;
			});

			let org: { id: string; name: string; slug: string };
			try {
				org = await orgs.createOrgWithOwner({
					name: opts.name,
					slug,
					userId: opts.userId,
				});
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

			await sessions.setCurrentOrgBySessionToken(opts.sessionToken, org.id);

			await audit.write({
				orgId: org.id,
				actorId: opts.userId,
				action: 'ORG_CREATED',
				entityType: 'Organization',
				entityId: org.id,
				metadata: { name: org.name, slug: org.slug },
			});

			return org;
		},

		/**
		 * Ensure currentOrgId is valid; fallback to first org if missing/invalid.
		 * Handy to call during session callback or context init if you want auto-healing.
		 */
		async ensureValidCurrentOrg(opts: {
			userId: string;
			sessionToken: string;
		}) {
			const session = await sessions.getBySessionToken(opts.sessionToken);
			if (!session) return null;

			if (session.currentOrgId) {
				const membership = await orgs.userIsMemberOfOrg(
					opts.userId,
					session.currentOrgId,
				);
				if (membership)
					return { orgId: session.currentOrgId, role: membership.role };
			}

			const first = await orgs.getFirstOrgForUser(opts.userId);
			const fallbackOrgId = first?.organizationId ?? null;

			await sessions.setCurrentOrgBySessionToken(
				opts.sessionToken,
				fallbackOrgId,
			);

			return fallbackOrgId ? { orgId: fallbackOrgId, role: first!.role } : null;
		},
	};
}
