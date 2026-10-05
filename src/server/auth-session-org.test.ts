import { beforeEach, describe, expect, it, vi } from 'vitest';

// Importing ./auth pulls in the adapter and mailers; stub the data layer.
const db = vi.hoisted(() => ({
	rows: [] as Array<
		{ sessionToken: string; userId: string } & Record<string, unknown>
	>,
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
	},
}));
vi.mock('@next-auth/prisma-adapter', () => ({ PrismaAdapter: () => ({}) }));
vi.mock('@/server/lib/email', () => ({ sendEmail: vi.fn() }));
vi.mock('@/server/lib/resend', () => ({
	getFromEmail: () => 'from@example.test',
}));
vi.mock('@/server/lib/admin-alerts', () => ({ sendNewUserAlert: vi.fn() }));
vi.mock('@/server/services/accountClaimService', () => ({
	claimAccountOnSignIn: vi.fn(),
}));
vi.mock('@/server/repositories/userAccountStateRepo', () => ({
	wasUserCreatedWithin: vi.fn(async () => false),
}));
vi.mock('next/headers', () => ({
	cookies: async () => ({ get: () => undefined }),
}));

import { authOptions } from './auth';

async function sessionFor(
	currentOrgId: string | null,
	memberships: Array<{ organizationId: string; role: string }>,
	owner = 'user-1',
) {
	db.rows = [
		{
			sessionToken: 'tok-1',
			userId: owner,
			currentOrgId,
			currentCompanyId: null,
			user: { memberships, companyMemberships: [] },
		},
	];
	const cb = authOptions.callbacks?.session;
	if (!cb) throw new Error('callbacks.session not registered');
	return (await cb({
		session: { user: {}, sessionToken: 'tok-1', expires: '' },
		user: { id: 'user-1' },
	} as never)) as unknown as {
		currentOrgId: string | null;
		orgId: string | null;
		role: string | null;
		sessionToken: string | null;
	};
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe('NextAuth session callback org context', () => {
	// Value: protects=the client session never carries an org the user does not
	// belong to; fails_when=the session callback honours a saved currentOrgId
	// without a membership; why_new=no test covers the callback's org branch;
	// seam=none
	it('drops a saved org the user is not a member of', async () => {
		const s = await sessionFor('other-org', [
			{ organizationId: 'own-org', role: 'STAFF' },
		]);
		expect(s).toMatchObject({
			currentOrgId: 'own-org',
			orgId: 'own-org',
			role: 'STAFF',
		});
	});

	it('gives no org to a user with no memberships', async () => {
		const s = await sessionFor('other-org', []);
		expect(s).toMatchObject({ currentOrgId: null, orgId: null, role: null });
	});

	it('keeps a saved org the user is a member of', async () => {
		const s = await sessionFor('org-b', [
			{ organizationId: 'org-a', role: 'STAFF' },
			{ organizationId: 'org-b', role: 'OWNER' },
		]);
		expect(s).toMatchObject({ orgId: 'org-b', role: 'OWNER' });
	});

	// Value: protects=the client session only carries org context and a token
	// from the signed-in user's own session row; fails_when=the callback loads
	// the cookie's session without checking its user; why_new=the lookup was by
	// token only; seam=none
	it('ignores a session cookie that belongs to another user', async () => {
		const s = await sessionFor(
			'org-a',
			[{ organizationId: 'org-a', role: 'OWNER' }],
			'someone-else',
		);

		expect(s).toMatchObject({ orgId: null, role: null, sessionToken: null });
	});

	it('exposes the token of the signed-in user’s own session', async () => {
		const s = await sessionFor('org-a', [
			{ organizationId: 'org-a', role: 'OWNER' },
		]);

		expect(s.sessionToken).toBe('tok-1');
	});
});
