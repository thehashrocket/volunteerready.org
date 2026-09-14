import type { PrismaClient } from '@/prisma/generated/client';
import type { Context } from '@/server/trpc/init';

/**
 * Builds a full tRPC `Context` for `t.createCallerFactory()` in tests, so
 * call sites only need to specify the fields a test actually cares about.
 * Every field defaults to its "logged out, no org, no company" shape;
 * `prisma` defaults to an empty stub since real router tests mock the
 * repositories/services a procedure calls, not `ctx.prisma` directly.
 */
export function createMockTrpcContext(
	overrides: Partial<Context> = {},
): Context {
	return {
		session: null,
		realSession: null,
		realUserId: null,
		impersonation: null,
		orgId: null,
		role: null,
		companyId: null,
		companyRole: null,
		prisma: {} as PrismaClient,
		sessionToken: null,
		ip: null,
		...overrides,
	};
}
