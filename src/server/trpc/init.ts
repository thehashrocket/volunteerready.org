import { initTRPC, TRPCError } from '@trpc/server';
import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';
import { getServerSession } from 'next-auth';
import superjson from 'superjson';
import { z } from 'zod';
import type {
	CompanyMemberRole,
	PlanTier,
	Role,
} from '@/prisma/generated/client';
import { authOptions } from '@/server/auth';
import { assertPlanAtLeast } from '@/server/domain/billing';
import type { EffectiveUser } from '@/server/domain/impersonation';
import { IMPERSONATION_COOKIE } from '@/server/domain/impersonation';
import { roleRank } from '@/server/domain/permissions';
import { resolveEffectiveUserId } from '@/server/lib/impersonation-context';
import { getOrgPlanTier } from '@/server/repositories/orgRepo';
import { prisma } from '@/server/repositories/prisma';
import {
	CompanyAccessDeniedError,
	requireCompanyAccess,
} from '@/server/services/companyAccessService';

/** Extended session shape produced by our auth callback */
type SessionExt = {
	sessionToken?: string;
	orgId?: string;
	role?: Role;
	companyId?: string;
	companyRole?: CompanyMemberRole;
};

export async function createTRPCContext(_opts: FetchCreateContextFnOptions) {
	const realSession = await getServerSession(authOptions);
	const ext = realSession as (typeof realSession & SessionExt) | null;
	// NextAuth v4 database sessions do NOT pass sessionToken to the session
	// callback, so orgId/role/companyId/companyRole may be null after the
	// callback runs. Fall back to reading the token from the cookie header and
	// resolving org/company context directly here.
	const sessionToken =
		ext?.sessionToken ?? getSessionTokenFromHeaders(_opts.req);

	const realUserId = realSession?.user?.id ?? null;
	const impersonationCookie = getImpersonationCookieFromHeaders(_opts.req);

	// Resolve impersonation — if the admin is acting as another user, all
	// downstream org/role lookups should use the target user. The admin's
	// real session is still available via `session` so audit writes can tag
	// `impersonatedBy`.
	const resolved = await resolveEffectiveUserId(
		realUserId,
		impersonationCookie,
	);
	const effectiveUserId = resolved.effectiveUserId;
	const isImpersonating = resolved.isImpersonating;
	const impersonation: EffectiveUser | null = isImpersonating
		? {
				userId: effectiveUserId as string,
				isImpersonation: true,
				impersonatedBy: resolved.impersonatedBy,
				impersonationSessionId: resolved.impersonationSessionId,
				expiresAt: resolved.expiresAt,
			}
		: null;

	// Build the session object exposed to procedures. When impersonating,
	// swap the user id so org-scoped checks pick the target user — but keep
	// the real session available as `realSession` for audit logging.
	const session = realSession
		? ({
				...realSession,
				user: realSession.user
					? { ...realSession.user, id: effectiveUserId ?? undefined }
					: realSession.user,
			} as typeof realSession)
		: realSession;

	let orgId: string | null = isImpersonating ? null : (ext?.orgId ?? null);
	let role: Role | null = isImpersonating ? null : (ext?.role ?? null);
	let companyId: string | null = isImpersonating
		? null
		: (ext?.companyId ?? null);
	let companyRole: CompanyMemberRole | null = isImpersonating
		? null
		: (ext?.companyRole ?? null);

	if (!orgId && effectiveUserId && (sessionToken || isImpersonating)) {
		// When impersonating we don't have a session token for the target
		// user — resolve their default org/company directly.
		const dbSessionPromise =
			sessionToken && !isImpersonating
				? prisma.session.findUnique({
						where: { sessionToken },
						select: {
							currentOrgId: true,
							currentCompanyId: true,
							user: {
								select: {
									memberships: {
										select: { organizationId: true, role: true },
										orderBy: { createdAt: 'asc' },
									},
									companyMemberships: {
										select: { companyId: true, role: true },
										orderBy: { createdAt: 'asc' },
									},
								},
							},
						},
					})
				: prisma.user.findUnique({
						where: { id: effectiveUserId },
						select: {
							memberships: {
								select: { organizationId: true, role: true },
								orderBy: { createdAt: 'asc' },
							},
							companyMemberships: {
								select: { companyId: true, role: true },
								orderBy: { createdAt: 'asc' },
							},
						},
					});

		const resolved = await dbSessionPromise;

		const memberships =
			(
				resolved as {
					user?: {
						memberships?: Array<{ organizationId: string; role: Role }>;
					};
				} | null
			)?.user?.memberships ??
			(
				resolved as {
					memberships?: Array<{ organizationId: string; role: Role }>;
				} | null
			)?.memberships ??
			[];
		const currentOrgId =
			(resolved as { currentOrgId?: string | null } | null)?.currentOrgId ??
			null;

		if (currentOrgId) {
			const match = memberships.find((m) => m.organizationId === currentOrgId);
			orgId = currentOrgId;
			role = match?.role ?? null;
		} else {
			orgId = memberships[0]?.organizationId ?? null;
			role = memberships[0]?.role ?? null;
		}

		const companyMemberships =
			(
				resolved as {
					user?: {
						companyMemberships?: Array<{
							companyId: string;
							role: CompanyMemberRole;
						}>;
					};
				} | null
			)?.user?.companyMemberships ??
			(
				resolved as {
					companyMemberships?: Array<{
						companyId: string;
						role: CompanyMemberRole;
					}>;
				} | null
			)?.companyMemberships ??
			[];
		const currentCompanyId =
			(resolved as { currentCompanyId?: string | null } | null)
				?.currentCompanyId ?? null;

		if (currentCompanyId) {
			const match = companyMemberships.find(
				(m) => m.companyId === currentCompanyId,
			);
			if (match) {
				companyId = currentCompanyId;
				companyRole = match.role;
			} else {
				// Stale selection (e.g. removed from the company) — self-heal to
				// the first membership, mirroring the session callback in auth.ts.
				companyId = companyMemberships[0]?.companyId ?? null;
				companyRole = companyMemberships[0]?.role ?? null;
			}
		} else {
			companyId = companyMemberships[0]?.companyId ?? null;
			companyRole = companyMemberships[0]?.role ?? null;
		}
	}

	const ip =
		_opts.req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
		_opts.req.headers.get('x-real-ip') ??
		null;

	return {
		session,
		realSession,
		realUserId,
		impersonation,
		orgId,
		role,
		companyId,
		companyRole,
		prisma,
		sessionToken,
		ip,
	};
}

export const t = initTRPC
	.context<Awaited<ReturnType<typeof createTRPCContext>>>()
	.create({
		transformer: superjson,
	});

// Re-exported so the existing `import { roleRank } from '@/server/trpc/init'`
// call sites keep working; the definition lives in domain/permissions.ts.
export { roleRank };

export const createTRPCRouter = t.router;

/**
 * Base procedure with advisory RBAC permission check.
 * Runs for every procedure — looks up the procedure path and, if it's an
 * org-scoped procedure, logs a warning when hasPermission() disagrees with
 * middleware. Never blocks. Remove after migration is verified.
 */
export const publicProcedure = t.procedure.use(async ({ ctx, next, path }) => {
	const { runAdvisoryCheck } = await import(
		'@/server/trpc/advisory-permission-middleware'
	);
	runAdvisoryCheck(path, (ctx as { role?: Role }).role);
	return next();
});

/** Extract user ID from session or throw UNAUTHORIZED. */
export function requireUserId(
	session: { user?: { id?: string } } | null,
): string {
	const id = session?.user?.id;
	if (!id) throw new TRPCError({ code: 'UNAUTHORIZED' });
	return id;
}

/**
 * Extract the REAL admin user id from the ctx (ignores impersonation).
 * Use this for audit logging so the audit row attributes the action to the
 * admin, not the impersonated target.
 */
export function requireRealUserId(ctx: { realUserId?: string | null }): string {
	if (!ctx.realUserId) throw new TRPCError({ code: 'UNAUTHORIZED' });
	return ctx.realUserId;
}

export const protectedProcedure = publicProcedure.use(({ ctx, next }) => {
	if (!ctx.session?.user?.id) {
		throw new TRPCError({ code: 'UNAUTHORIZED' });
	}

	return next();
});

export const orgProcedure = protectedProcedure.use(async ({ ctx, next }) => {
	if (!ctx.orgId) {
		throw new TRPCError({ code: 'FORBIDDEN' });
	}

	// Tier 3: enforce org suspension. One indexed PK lookup per org-scoped call.
	// Platform admins bypass so they can still operate (e.g., unsuspend).
	const status = await prisma.organization.findUnique({
		where: { id: ctx.orgId },
		select: { suspendedAt: true },
	});

	if (status?.suspendedAt) {
		const { isPlatformAdmin } = await import('@/server/domain/platform-admin');
		const allowed = ctx.realUserId
			? await isPlatformAdmin(ctx.realUserId)
			: false;
		if (!allowed) {
			throw new TRPCError({
				code: 'FORBIDDEN',
				message:
					'This organization is suspended. Contact support@volunteerready.org.',
			});
		}
	}

	return next({ ctx: { orgId: ctx.orgId } });
});

export const staffProcedure = orgProcedure.use(({ ctx, next }) => {
	if (!ctx.role || roleRank[ctx.role] < roleRank.STAFF) {
		throw new TRPCError({
			code: 'FORBIDDEN',
			message: 'Staff or higher role required.',
		});
	}

	return next({ ctx: { role: ctx.role } });
});

export const adminProcedure = orgProcedure.use(({ ctx, next }) => {
	if (!ctx.role || roleRank[ctx.role] < roleRank.ADMIN) {
		throw new TRPCError({ code: 'FORBIDDEN' });
	}

	return next({ ctx: { role: ctx.role } });
});

/**
 * Plan tier procedure — factory. Hits DB once per gated request to guarantee
 * a fresh tier value (no stale session cache after upgrade).
 */
export function planTierProcedure(requiredTier: PlanTier) {
	return orgProcedure.use(async ({ ctx, next }) => {
		const currentTier = await getOrgPlanTier(ctx.orgId);
		try {
			assertPlanAtLeast(currentTier, requiredTier);
		} catch {
			throw new TRPCError({
				code: 'FORBIDDEN',
				message: `Requires ${requiredTier} plan or higher.`,
			});
		}
		return next({ ctx: { planTier: currentTier } });
	});
}

/**
 * Company-scoped procedure — factory. Reads `companyId` from tRPC *input*,
 * never from session state: the session's active company can differ from
 * the company named in the request (multi-company user browsing a
 * non-active company's URL), and authorizing against the session would
 * serve — or mutate — the wrong tenant. See companyAccessService for the
 * underlying membership/role/plan check.
 */
export function companyScopedProcedure(opts?: {
	minRole?: CompanyMemberRole;
	minPlanTier?: PlanTier;
}) {
	return protectedProcedure
		.input(z.object({ companyId: z.string().min(1) }))
		.use(async ({ ctx, input, next }) => {
			try {
				const { role } = await requireCompanyAccess({
					userId: requireUserId(ctx.session),
					companyId: input.companyId,
					minRole: opts?.minRole,
					minPlanTier: opts?.minPlanTier,
				});
				return next({
					ctx: { companyId: input.companyId, companyRole: role },
				});
			} catch (err) {
				if (err instanceof CompanyAccessDeniedError) {
					throw new TRPCError({ code: 'FORBIDDEN', message: err.message });
				}
				throw err;
			}
		});
}

/**
 * Platform admin procedure — checks User.isPlatformAdmin in DB (with env-var fallback).
 * Used for cross-org admin tools (Stripe reconciliation, cron health dashboard).
 * Separate from org-scoped `adminProcedure`.
 */
export const platformAdminProcedure = protectedProcedure.use(
	async ({ ctx, next }) => {
		// Check the REAL user (the admin), not the impersonated target.
		// Otherwise an admin who is impersonating would lose access to their
		// own admin surface.
		const userId = ctx.realUserId ?? ctx.session?.user?.id;
		if (!userId) {
			throw new TRPCError({
				code: 'UNAUTHORIZED',
				message: 'Platform admin access required.',
			});
		}

		const { isPlatformAdmin } = await import('@/server/domain/platform-admin');
		const isAdmin = await isPlatformAdmin(userId);

		if (!isAdmin) {
			throw new TRPCError({
				code: 'FORBIDDEN',
				message: 'Platform admin access required.',
			});
		}

		return next({ ctx: { platformAdmin: true as const } });
	},
);

function getSessionTokenFromHeaders(req: Request) {
	const cookie = req.headers.get('cookie');
	if (!cookie) {
		return null;
	}

	const pairs = cookie.split(';').map((part) => part.trim());
	const entry = pairs.find(
		(pair) =>
			pair.startsWith('next-auth.session-token=') ||
			pair.startsWith('__Secure-next-auth.session-token='),
	);
	if (!entry) {
		return null;
	}

	return decodeURIComponent(entry.split('=').slice(1).join('='));
}

function getImpersonationCookieFromHeaders(req: Request) {
	const cookie = req.headers.get('cookie');
	if (!cookie) return null;

	const prefix = `${IMPERSONATION_COOKIE}=`;
	const pairs = cookie.split(';').map((part) => part.trim());
	const entry = pairs.find((pair) => pair.startsWith(prefix));
	if (!entry) return null;

	return decodeURIComponent(entry.slice(prefix.length));
}
