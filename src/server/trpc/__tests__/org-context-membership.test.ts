/**
 * The request context only gives a session an org it is a member of, so every
 * org context comes with a role.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
	sessionFindFirst: vi.fn(),
	rows: [] as Array<
		{ sessionToken: string; userId: string } & Record<string, unknown>
	>,
	orgFindUnique: vi.fn(async () => ({ suspendedAt: null })),
}));

vi.mock('next-auth', () => ({
	getServerSession: vi.fn(async () => ({ user: { id: 'user-1' } })),
}));
vi.mock('@/server/auth', () => ({ authOptions: {} }));
vi.mock('@/server/lib/impersonation-context', () => ({
	resolveEffectiveUserId: vi.fn(async (id: string) => ({
		effectiveUserId: id,
		isImpersonating: false,
	})),
}));
vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		session: {
			findFirst: async (args: {
				where: { sessionToken: string; userId?: string };
			}) =>
				db.rows.find(
					(row) =>
						row.sessionToken === args.where.sessionToken &&
						(args.where.userId === undefined ||
							args.where.userId === row.userId),
				) ?? null,
			findMany: async (args: {
				where: { sessionToken: { in: string[] }; userId?: string };
			}) =>
				db.rows.filter(
					(row) =>
						args.where.sessionToken.in.includes(row.sessionToken) &&
						(args.where.userId === undefined ||
							args.where.userId === row.userId),
				),
		},
		organization: { findUnique: db.orgFindUnique },
	},
}));

import { createTRPCContext, createTRPCRouter, orgProcedure } from '../init';

function request() {
	return new Request('https://volunteerready.org/api/trpc/x', {
		headers: { cookie: 'next-auth.session-token=tok-1' },
	});
}

function savedSession(
	currentOrgId: string | null,
	memberships: Array<{ organizationId: string; role: string }>,
) {
	db.rows = [
		{
			sessionToken: 'tok-1',
			userId: 'user-1',
			currentOrgId,
			currentCompanyId: null,
			user: { memberships, companyMemberships: [] },
		},
	];
}

const probe = createTRPCRouter({
	whichOrg: orgProcedure.query(({ ctx }) => ctx.orgId),
});

beforeEach(() => {
	vi.clearAllMocks();
	db.rows = [];
	vi.stubEnv('NEXTAUTH_URL', 'http://localhost:3005');
});

afterEach(() => {
	vi.unstubAllEnvs();
});

describe('createTRPCContext org resolution', () => {
	// Value: protects=org context comes from memberships; fails_when=
	// createTRPCContext resolves an org without one; why_new=no test drives
	// createTRPCContext's org branch; seam=none
	it('gives no org to a session whose saved org it is not a member of', async () => {
		savedSession('other-org', []);

		const ctx = await createTRPCContext({ req: request() } as never);

		expect(ctx.orgId).toBeNull();
		expect(ctx.role).toBeNull();
		await expect(
			probe.createCaller(ctx as never).whichOrg(),
		).rejects.toMatchObject({ code: 'FORBIDDEN' });
	});

	it('falls back to the user’s own org when the saved org is not theirs', async () => {
		savedSession('other-org', [{ organizationId: 'own-org', role: 'STAFF' }]);

		const ctx = await createTRPCContext({ req: request() } as never);

		expect(ctx.orgId).toBe('own-org');
		expect(ctx.role).toBe('STAFF');
	});

	it('keeps a saved org the user is a member of', async () => {
		savedSession('org-b', [
			{ organizationId: 'org-a', role: 'STAFF' },
			{ organizationId: 'org-b', role: 'OWNER' },
		]);

		const ctx = await createTRPCContext({ req: request() } as never);

		expect(ctx.orgId).toBe('org-b');
		expect(ctx.role).toBe('OWNER');
	});

	// Value: protects=org context and the session token come only from a
	// session row of the signed-in user; fails_when=the cookie's session is
	// loaded without checking its user; why_new=lookups were by token only;
	// seam=none
	it('ignores a session cookie that belongs to another user', async () => {
		savedSession('org-a', [{ organizationId: 'org-a', role: 'OWNER' }]);
		db.rows = db.rows.map((row) => ({ ...row, userId: 'someone-else' }));

		const ctx = await createTRPCContext({ req: request() } as never);

		expect(ctx.orgId).toBeNull();
		expect(ctx.role).toBeNull();
		expect(ctx.sessionToken).toBeNull();
	});

	it('exposes the session token when the session is the signed-in user’s', async () => {
		savedSession('org-a', [{ organizationId: 'org-a', role: 'OWNER' }]);

		const ctx = await createTRPCContext({ req: request() } as never);

		expect(ctx.sessionToken).toBe('tok-1');
	});

	// Value: protects=the context reads the one session cookie NextAuth
	// authenticated with; fails_when=another cookie name or value is used;
	// why_new=the cookie was picked by name order; seam=none
	it('reads the __Secure- cookie when NextAuth runs on https', async () => {
		vi.stubEnv('NEXTAUTH_URL', 'https://volunteerready.org');
		savedSession('org-a', [{ organizationId: 'org-a', role: 'OWNER' }]);

		const ctx = await createTRPCContext({
			req: new Request('https://volunteerready.org/api/trpc/x', {
				headers: {
					cookie:
						'next-auth.session-token=planted; __Secure-next-auth.session-token=tok-1',
				},
			}),
		} as never);

		expect(ctx.sessionToken).toBe('tok-1');
		expect(ctx.orgId).toBe('org-a');
	});

	it('ignores a __Secure- cookie when NextAuth runs on plain http', async () => {
		savedSession('org-a', [{ organizationId: 'org-a', role: 'OWNER' }]);

		const ctx = await createTRPCContext({
			req: new Request('http://localhost:3005/api/trpc/x', {
				headers: {
					cookie:
						'__Secure-next-auth.session-token=stale; next-auth.session-token=tok-1',
				},
			}),
		} as never);

		expect(ctx.sessionToken).toBe('tok-1');
	});

	it('takes the last value of a repeated session cookie, as Next does', async () => {
		savedSession('org-a', [{ organizationId: 'org-a', role: 'OWNER' }]);

		const ctx = await createTRPCContext({
			req: new Request('http://localhost:3005/api/trpc/x', {
				headers: {
					cookie: 'next-auth.session-token=old; next-auth.session-token=tok-1',
				},
			}),
		} as never);

		expect(ctx.sessionToken).toBe('tok-1');
	});

	it('survives a session cookie that is not valid percent-encoding', async () => {
		const ctx = await createTRPCContext({
			req: new Request('http://localhost:3005/api/trpc/x', {
				headers: { cookie: 'next-auth.session-token=%E0%A4%A' },
			}),
		} as never);

		expect(ctx.sessionToken).toBeNull();
	});
});
