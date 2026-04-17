import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {},
}));

vi.mock('next-auth', () => ({
	getServerSession: vi.fn(),
}));

vi.mock('@/server/auth', () => ({
	authOptions: {},
}));

const { mockIsPlatformAdmin } = vi.hoisted(() => ({
	mockIsPlatformAdmin: vi.fn(),
}));

vi.mock('@/server/domain/platform-admin', () => ({
	isPlatformAdmin: mockIsPlatformAdmin,
}));

import {
	createTRPCRouter,
	platformAdminProcedure,
	requireRealUserId,
	t,
} from '@/server/trpc/init';

const testRouter = createTRPCRouter({
	ping: platformAdminProcedure.query(({ ctx }) => ({
		ok: true as const,
		realUserId: ctx.realUserId ?? null,
		effectiveUserId: ctx.session?.user?.id ?? null,
	})),
});

const callerFactory = t.createCallerFactory(testRouter);

function makeCtx(overrides: Partial<Parameters<typeof callerFactory>[0]>) {
	return callerFactory({
		session: null,
		realSession: null,
		realUserId: null,
		impersonation: null,
		orgId: null,
		role: null,
		companyId: null,
		companyRole: null,
		prisma: {} as never,
		sessionToken: null,
		ip: null,
		...overrides,
	} as Parameters<typeof callerFactory>[0]);
}

describe('platformAdminProcedure', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('throws UNAUTHORIZED when no session exists', async () => {
		const caller = makeCtx({});
		await expect(caller.ping()).rejects.toMatchObject({
			code: 'UNAUTHORIZED',
		});
		expect(mockIsPlatformAdmin).not.toHaveBeenCalled();
	});

	it('throws FORBIDDEN when user is not a platform admin', async () => {
		mockIsPlatformAdmin.mockResolvedValueOnce(false);
		const caller = makeCtx({
			session: { user: { id: 'u1' } } as never,
			realSession: { user: { id: 'u1' } } as never,
			realUserId: 'u1',
		});

		await expect(caller.ping()).rejects.toMatchObject({ code: 'FORBIDDEN' });
		expect(mockIsPlatformAdmin).toHaveBeenCalledWith('u1');
	});

	it('allows access when user is a platform admin', async () => {
		mockIsPlatformAdmin.mockResolvedValueOnce(true);
		const caller = makeCtx({
			session: { user: { id: 'admin-1' } } as never,
			realSession: { user: { id: 'admin-1' } } as never,
			realUserId: 'admin-1',
		});

		await expect(caller.ping()).resolves.toMatchObject({
			ok: true,
			realUserId: 'admin-1',
			effectiveUserId: 'admin-1',
		});
	});

	it('SECURITY: checks realUserId (the admin) during impersonation, not the target', async () => {
		// An admin is impersonating a volunteer. Their session.user.id has been
		// swapped to the volunteer's id, but realUserId still points at the admin.
		// The platformAdminProcedure MUST check realUserId so the admin keeps
		// access to their admin tools while impersonating.
		mockIsPlatformAdmin.mockResolvedValueOnce(true);
		const caller = makeCtx({
			session: { user: { id: 'volunteer-42' } } as never,
			realSession: { user: { id: 'admin-1' } } as never,
			realUserId: 'admin-1',
			impersonation: {
				sessionId: 'imp-1',
				adminUserId: 'admin-1',
				userId: 'volunteer-42',
				reason: 'support ticket 42',
				startedAt: new Date(),
				expiresAt: new Date(Date.now() + 30 * 60_000),
			} as never,
		});

		await expect(caller.ping()).resolves.toMatchObject({
			ok: true,
			realUserId: 'admin-1',
			effectiveUserId: 'volunteer-42',
		});
		expect(mockIsPlatformAdmin).toHaveBeenCalledWith('admin-1');
		// Critically, NOT called with 'volunteer-42' — we do not ask whether the
		// impersonation target is a platform admin.
		expect(mockIsPlatformAdmin).not.toHaveBeenCalledWith('volunteer-42');
	});
});

describe('requireRealUserId', () => {
	it('returns realUserId when present', () => {
		expect(requireRealUserId({ realUserId: 'admin-1' })).toBe('admin-1');
	});

	it('throws UNAUTHORIZED when realUserId is null', () => {
		expect(() => requireRealUserId({ realUserId: null })).toThrow();
	});

	it('throws UNAUTHORIZED when realUserId is undefined', () => {
		expect(() => requireRealUserId({})).toThrow();
	});
});
