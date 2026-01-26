import { TRPCError, initTRPC } from '@trpc/server';
import superjson from 'superjson';
import { getServerSession } from 'next-auth';
import { Role } from '@/prisma/generated/client';
import { authOptions } from '@/server/auth';
import { prisma } from '@/server/repositories/prisma';
import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';

export async function createTRPCContext(_opts: FetchCreateContextFnOptions) {
	const session = await getServerSession(authOptions);
	const userId = session?.user?.id;
	const sessionToken =
		(session as any)?.sessionToken ?? getSessionTokenFromHeaders(_opts.req);
	const sessionOrgId = sessionToken
		? ((
				await prisma.session.findUnique({
					where: { sessionToken },
					select: { currentOrgId: true },
				})
			)?.currentOrgId ?? null)
		: null;
	const sessionOrgIdFromSession = (session as any)?.currentOrgId ?? null;

	let orgId: string | null = null;
	let role: Role | null = null;

	if (userId) {
		const scopedOrgId = sessionOrgIdFromSession ?? sessionOrgId ?? null;

		if (scopedOrgId) {
			const membership = await prisma.organizationMember.findFirst({
				where: { userId, organizationId: scopedOrgId },
				select: { organizationId: true, role: true },
			});

			orgId = scopedOrgId;
			role = membership?.role ?? null;
		} else {
			const membership = await prisma.organizationMember.findFirst({
				where: { userId },
				orderBy: { createdAt: 'asc' },
				select: { organizationId: true, role: true },
			});

			orgId = membership?.organizationId ?? null;
			role = membership?.role ?? null;
		}
	}

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

	return next();
});

export const adminProcedure = orgProcedure.use(({ ctx, next }) => {
	if (!ctx.role || roleRank[ctx.role] < roleRank.ADMIN) {
		throw new TRPCError({ code: 'FORBIDDEN' });
	}

	return next();
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
