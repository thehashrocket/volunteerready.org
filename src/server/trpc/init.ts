import { initTRPC, TRPCError } from '@trpc/server';
import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';
import { getServerSession } from 'next-auth';
import superjson from 'superjson';
import type { Role } from '@/prisma/generated/client';
import { authOptions } from '@/server/auth';
import { prisma } from '@/server/repositories/prisma';

/** Extended session shape produced by our auth callback */
type SessionExt = {
	sessionToken?: string;
	orgId?: string;
	role?: Role;
};

export async function createTRPCContext(_opts: FetchCreateContextFnOptions) {
	const session = await getServerSession(authOptions);
	const ext = session as (typeof session & SessionExt) | null;
	const sessionToken =
		ext?.sessionToken ?? getSessionTokenFromHeaders(_opts.req);

	// orgId and role are resolved in the auth session callback via a single
	// DB query (session → user → memberships).  No additional queries needed.
	const orgId: string | null = ext?.orgId ?? null;
	const role: Role | null = ext?.role ?? null;

	return { session, orgId, role, prisma, sessionToken };
}

export const t = initTRPC
	.context<Awaited<ReturnType<typeof createTRPCContext>>>()
	.create({
		transformer: superjson,
	});

const roleRank: Record<Role, number> = {
	READONLY: 0,
	STAFF: 1,
	ADMIN: 2,
	OWNER: 3,
};

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

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
