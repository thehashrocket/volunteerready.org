import { TRPCError } from '@trpc/server';
import { findUniqueSlug, generateSlug } from '@/lib/slug';
import { Prisma } from '@/prisma/generated/client';
import {
	orgProfileUpdateSchema,
	orgSlugSchema,
	RESERVED_ORG_SLUGS,
} from '@/server/domain/org-profile';
import { sendNewOrgAlert } from '@/server/lib/admin-alerts';
import { writeAuditLogTx } from '../repositories/auditRepo';
import {
	findOrgBySlug,
	getFirstOrgForUser,
	slugExistsInHistory,
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
		// Reserved slugs (status, refer, …) collide with static /apply routes —
		// treat them as taken so an org named "Status" gets "status-xxxx".
		if (RESERVED_ORG_SLUGS.has(candidate)) return true;
		// Freed (renamed-away) slugs stay blocked too: printed QR flyers still
		// point at them, and a new org claiming one would capture the original
		// org's applicants.
		if (await slugExistsInHistory(candidate)) return true;
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

			// Re-check slug history inside the tx: a concurrent rename-away could
			// have freed this slug between the availability check and the create.
			const lateHistory = await tx.orgSlugHistory.findFirst({
				where: { oldSlug: newOrg.slug },
				select: { id: true },
			});
			if (lateHistory) {
				throw new TRPCError({
					code: 'CONFLICT',
					message: 'A unique-constraint conflict occurred. Please try again.',
				});
			}

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

/**
 * Update org name and public apply slug (OWNER/ADMIN only — enforced at the
 * router via adminProcedure).
 *
 * Slug-change pipeline (issue #127 design review, decision 4A):
 *
 *   validate (Zod: format + reserved)          ← shared with the client form
 *     └─ $transaction
 *          ├─ organization.update              ← P2002 → CONFLICT "taken"
 *          ├─ orgSlugHistory.create(oldSlug)   ← only when the slug changed
 *          └─ audit log ORG_PROFILE_UPDATE
 *
 * Old slugs keep working: /apply/{oldSlug} resolves through
 * findCurrentSlugByHistory() and redirects (307) to the current slug.
 */
export async function updateOrgProfile(opts: {
	orgId: string;
	actorId: string;
	name: string;
	slug: string;
	/** Real admin user id when the actor is being impersonated (audit trail). */
	impersonatedBy?: string | null;
}) {
	const name = orgProfileUpdateSchema.shape.name.parse(opts.name);

	try {
		return await prisma.$transaction(async (tx) => {
			// Read the current slug INSIDE the transaction — reading it outside
			// lets two concurrent renames both see the same "current" slug, so
			// an intermediate slug would never reach OrgSlugHistory and its
			// /apply links would 404.
			const current = await tx.organization.findUnique({
				where: { id: opts.orgId },
				select: { id: true, name: true, slug: true },
			});
			if (!current) {
				throw new TRPCError({ code: 'NOT_FOUND' });
			}

			const slugChanged = opts.slug !== current.slug;
			// Slug rules apply only to CHANGED slugs — an org whose legacy slug
			// predates these rules (too short, reserved) must still be able to
			// save a name-only edit.
			let slug = current.slug;
			if (slugChanged) {
				const parsedSlug = orgSlugSchema.safeParse(opts.slug);
				if (!parsedSlug.success) {
					throw new TRPCError({
						code: 'BAD_REQUEST',
						message:
							parsedSlug.error.issues[0]?.message ?? 'Invalid slug format',
					});
				}
				slug = parsedSlug.data;

				// A freed slug can only be reclaimed by the org that used to own
				// it — otherwise another org could capture the original org's
				// printed QR flyers and shared apply links.
				const foreignHistory = await tx.orgSlugHistory.findFirst({
					where: { oldSlug: slug, orgId: { not: opts.orgId } },
					select: { id: true },
				});
				if (foreignHistory) {
					throw new TRPCError({
						code: 'CONFLICT',
						message: 'This slug is already taken',
					});
				}

				// Rate limit: at most 3 slug changes per 24h per org. The history
				// table doubles as the counter — transactional, no extra infra.
				const recentRenames = await tx.orgSlugHistory.count({
					where: {
						orgId: opts.orgId,
						createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
					},
				});
				if (recentRenames >= 3) {
					throw new TRPCError({
						code: 'TOO_MANY_REQUESTS',
						message: 'Slug changed too many times today — try again tomorrow',
					});
				}
			}

			// Guarded write: Postgres READ COMMITTED gives the in-tx read no row
			// lock, so a concurrent rename could still slip between read and
			// write. Conditioning the UPDATE on the slug we read turns that race
			// into a retryable CONFLICT instead of a lost history row.
			const guarded = await tx.organization.updateMany({
				where: { id: opts.orgId, slug: current.slug },
				data: { name, slug },
			});
			if (guarded.count === 0) {
				throw new TRPCError({
					code: 'CONFLICT',
					message: 'Profile changed in another session — reload and retry',
				});
			}
			const org = { id: current.id, name, slug };

			if (slugChanged) {
				await tx.orgSlugHistory.create({
					data: { orgId: opts.orgId, oldSlug: current.slug },
				});

				// Re-check foreign history AFTER the write: under READ COMMITTED a
				// concurrent rename-away could have been invisible to the earlier
				// check but is visible now (our updateMany blocked on its commit).
				// Throwing here rolls the whole transaction back.
				const lateForeignHistory = await tx.orgSlugHistory.findFirst({
					where: { oldSlug: slug, orgId: { not: opts.orgId } },
					select: { id: true },
				});
				if (lateForeignHistory) {
					throw new TRPCError({
						code: 'CONFLICT',
						message: 'This slug is already taken',
					});
				}
			}

			await writeAuditLogTx(tx, {
				orgId: opts.orgId,
				actorId: opts.actorId,
				action: 'ORG_PROFILE_UPDATE',
				entityType: 'Organization',
				entityId: opts.orgId,
				metadata: {
					oldName: current.name,
					newName: name,
					...(slugChanged
						? { oldSlug: current.slug, newSlug: slug }
						: { nameOnly: true }),
					...(opts.impersonatedBy
						? { impersonatedBy: opts.impersonatedBy }
						: {}),
				},
			});

			return org;
		});
	} catch (err) {
		if (
			err instanceof Prisma.PrismaClientKnownRequestError &&
			err.code === 'P2002'
		) {
			throw new TRPCError({
				code: 'CONFLICT',
				message: 'This slug is already taken',
			});
		}
		throw err;
	}
}
