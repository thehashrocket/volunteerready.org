import { initTRPC, TRPCError } from '@trpc/server';
import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';
import { getServerSession } from 'next-auth';
import superjson from 'superjson';
import type {
	CompanyMemberRole,
	PlanTier,
	Role,
} from '@/prisma/generated/client';
import { authOptions } from '@/server/auth';
import { assertPlanAtLeast } from '@/server/domain/billing';
import { getCompanyPlanTier } from '@/server/repositories/companyRepo';
import { getOrgPlanTier } from '@/server/repositories/orgRepo';
import { prisma } from '@/server/repositories/prisma';

/** Extended session shape produced by our auth callback */
type SessionExt = {
	sessionToken?: string;
	orgId?: string;
	role?: Role;
	companyId?: string;
	companyRole?: CompanyMemberRole;
};

export async function createTRPCContext(_opts: FetchCreateContextFnOptions) {
	const session = await getServerSession(authOptions);
	const ext = session as (typeof session & SessionExt) | null;
	// NextAuth v4 database sessions do NOT pass sessionToken to the session
	// callback, so orgId/role/companyId/companyRole may be null after the
	// callback runs. Fall back to reading the token from the cookie header and
	// resolving org/company context directly here.
	const sessionToken =
		ext?.sessionToken ?? getSessionTokenFromHeaders(_opts.req);

	let orgId: string | null = ext?.orgId ?? null;
	let role: Role | null = ext?.role ?? null;
	let companyId: string | null = ext?.companyId ?? null;
	let companyRole: CompanyMemberRole | null = ext?.companyRole ?? null;

	if (!orgId && sessionToken) {
		const dbSession = await prisma.session.findUnique({
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
		});

		const memberships = dbSession?.user?.memberships ?? [];
		const currentOrgId = dbSession?.currentOrgId ?? null;

		if (currentOrgId) {
			const match = memberships.find((m) => m.organizationId === currentOrgId);
			orgId = currentOrgId;
			role = match?.role ?? null;
		} else {
			orgId = memberships[0]?.organizationId ?? null;
			role = memberships[0]?.role ?? null;
		}

		const companyMemberships = dbSession?.user?.companyMemberships ?? [];
		const currentCompanyId = dbSession?.currentCompanyId ?? null;

		if (currentCompanyId) {
			const match = companyMemberships.find(
				(m) => m.companyId === currentCompanyId,
			);
			companyId = currentCompanyId;
			companyRole = match?.role ?? null;
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

export const roleRank: Record<Role, number> = {
	READONLY: 0,
	STAFF: 1,
	ADMIN: 2,
	OWNER: 3,
};

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

/** Extract user ID from session or throw UNAUTHORIZED. */
export function requireUserId(
	session: { user?: { id?: string } } | null,
): string {
	const id = session?.user?.id;
	if (!id) throw new TRPCError({ code: 'UNAUTHORIZED' });
	return id;
}

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
	if (!ctx.session?.user?.id) {
		throw new TRPCError({ code: 'UNAUTHORIZED' });
	}

	return next();
});

export const orgProcedure = protectedProcedure.use(({ ctx, next }) => {
	if (!ctx.orgId) {
		throw new TRPCError({ code: 'FORBIDDEN' });
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

/** Requires an active company context in the session. */
export const companyProcedure = protectedProcedure.use(({ ctx, next }) => {
	if (!ctx.companyId) {
		throw new TRPCError({ code: 'FORBIDDEN', message: 'No active company.' });
	}
	return next({
		ctx: { companyId: ctx.companyId, companyRole: ctx.companyRole },
	});
});

const companyRoleRank: Record<CompanyMemberRole, number> = {
	MEMBER: 0,
	ADMIN: 1,
	OWNER: 2,
};

/** Requires ADMIN or OWNER company role. */
export const companyAdminProcedure = companyProcedure.use(({ ctx, next }) => {
	if (
		!ctx.companyRole ||
		companyRoleRank[ctx.companyRole] < companyRoleRank.ADMIN
	) {
		throw new TRPCError({
			code: 'FORBIDDEN',
			message: 'Company admin role required.',
		});
	}
	return next({ ctx: { companyRole: ctx.companyRole } });
});

/**
 * Company plan tier procedure — factory. Extends companyAdminProcedure with
 * a fresh DB lookup of the company's plan tier. Mirrors planTierProcedure
 * but for company context instead of org context.
 */
export function companyPlanTierProcedure(requiredTier: PlanTier) {
	return companyAdminProcedure.use(async ({ ctx, next }) => {
		const currentTier = await getCompanyPlanTier(ctx.companyId);
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
 * Platform admin procedure — checks userId against PLATFORM_ADMIN_IDS env var.
 * Used for cross-org admin tools (Stripe reconciliation, cron health dashboard).
 * Separate from org-scoped `adminProcedure`.
 */
export const platformAdminProcedure = protectedProcedure.use(
	({ ctx, next }) => {
		const adminIds = (process.env.PLATFORM_ADMIN_IDS ?? '')
			.split(',')
			.map((id) => id.trim())
			.filter(Boolean);
		const userId = ctx.session?.user?.id;

		if (!userId || !adminIds.includes(userId)) {
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
