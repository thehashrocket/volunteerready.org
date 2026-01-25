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

	let orgId: string | null = null;
	let role: Role | null = null;

	if (userId) {
		const membership = await prisma.organizationMember.findFirst({
			where: { userId },
			orderBy: { createdAt: 'asc' },
			select: { organizationId: true, role: true },
		});

		orgId = membership?.organizationId ?? null;
		role = membership?.role ?? null;
	}

	const sessionToken = (session as any)?.sessionToken ?? null;

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
