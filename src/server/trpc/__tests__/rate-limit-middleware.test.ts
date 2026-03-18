import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock module dependencies
// ---------------------------------------------------------------------------

vi.mock('@/server/lib/rate-limit', () => ({
	checkRateLimit: vi.fn(),
}));

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {},
}));

vi.mock('next-auth', () => ({
	getServerSession: vi.fn(),
}));

vi.mock('@/server/auth', () => ({
	authOptions: {},
}));

// ---------------------------------------------------------------------------
// Imports — must come AFTER vi.mock() calls
// ---------------------------------------------------------------------------

import * as rateLimitLib from '@/server/lib/rate-limit';
import { createTRPCRouter, publicProcedure, t } from '@/server/trpc/init';
import {
	rateLimitByIp,
	rateLimitByOrg,
	rateLimitByUser,
} from '@/server/trpc/rate-limit-middleware';

// ---------------------------------------------------------------------------
// Test routers
// ---------------------------------------------------------------------------

const testRouter = createTRPCRouter({
	orgEndpoint: publicProcedure
		.use(
			rateLimitByOrg({
				limit: 10,
				windowSeconds: 60,
				prefix: 'test:org',
			}),
		)
		.query(() => 'ok-org' as const),

	userEndpoint: publicProcedure
		.use(
			rateLimitByUser({
				limit: 5,
				windowSeconds: 60,
				prefix: 'test:user',
			}),
		)
		.query(() => 'ok-user' as const),

	ipEndpoint: publicProcedure
		.use(
			rateLimitByIp({
				limit: 3,
				windowSeconds: 60,
				prefix: 'test:ip',
			}),
		)
		.query(() => 'ok-ip' as const),
});

const callerFactory = t.createCallerFactory(testRouter);

const SUCCESS_RESULT = { success: true, limit: 10, remaining: 9, reset: 0 };
const BLOCKED_RESULT = {
	success: false,
	limit: 10,
	remaining: 0,
	reset: Date.now() + 60_000,
};

// ---------------------------------------------------------------------------
// rateLimitByOrg
// ---------------------------------------------------------------------------

describe('rateLimitByOrg', () => {
	beforeEach(() => vi.clearAllMocks());

	it('passes when under the rate limit', async () => {
		vi.mocked(rateLimitLib.checkRateLimit).mockResolvedValueOnce(
			SUCCESS_RESULT,
		);
		const caller = callerFactory({
			session: { user: { id: 'u1' } } as never,
			orgId: 'org-1',
			role: null,
			companyId: null,
			companyRole: null,
			prisma: {} as never,
			sessionToken: null,
			ip: null,
		});

		await expect(caller.orgEndpoint()).resolves.toBe('ok-org');
		expect(rateLimitLib.checkRateLimit).toHaveBeenCalledWith(
			{ limit: 10, windowSeconds: 60, prefix: 'test:org' },
			'org-1',
		);
	});

	it('throws TOO_MANY_REQUESTS when rate limit exceeded', async () => {
		vi.mocked(rateLimitLib.checkRateLimit).mockResolvedValueOnce(
			BLOCKED_RESULT,
		);
		const caller = callerFactory({
			session: { user: { id: 'u1' } } as never,
			orgId: 'org-1',
			role: null,
			companyId: null,
			companyRole: null,
			prisma: {} as never,
			sessionToken: null,
			ip: null,
		});

		await expect(caller.orgEndpoint()).rejects.toMatchObject({
			code: 'TOO_MANY_REQUESTS',
		});
	});

	it('throws INTERNAL_SERVER_ERROR when orgId is missing', async () => {
		const caller = callerFactory({
			session: { user: { id: 'u1' } } as never,
			orgId: null,
			role: null,
			companyId: null,
			companyRole: null,
			prisma: {} as never,
			sessionToken: null,
			ip: null,
		});

		await expect(caller.orgEndpoint()).rejects.toMatchObject({
			code: 'INTERNAL_SERVER_ERROR',
		});
		expect(rateLimitLib.checkRateLimit).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// rateLimitByUser
// ---------------------------------------------------------------------------

describe('rateLimitByUser', () => {
	beforeEach(() => vi.clearAllMocks());

	it('passes when under the rate limit', async () => {
		vi.mocked(rateLimitLib.checkRateLimit).mockResolvedValueOnce(
			SUCCESS_RESULT,
		);
		const caller = callerFactory({
			session: { user: { id: 'user-42' } } as never,
			orgId: null,
			role: null,
			companyId: null,
			companyRole: null,
			prisma: {} as never,
			sessionToken: null,
			ip: null,
		});

		await expect(caller.userEndpoint()).resolves.toBe('ok-user');
		expect(rateLimitLib.checkRateLimit).toHaveBeenCalledWith(
			{ limit: 5, windowSeconds: 60, prefix: 'test:user' },
			'user-42',
		);
	});

	it('throws TOO_MANY_REQUESTS when rate limit exceeded', async () => {
		vi.mocked(rateLimitLib.checkRateLimit).mockResolvedValueOnce(
			BLOCKED_RESULT,
		);
		const caller = callerFactory({
			session: { user: { id: 'user-42' } } as never,
			orgId: null,
			role: null,
			companyId: null,
			companyRole: null,
			prisma: {} as never,
			sessionToken: null,
			ip: null,
		});

		await expect(caller.userEndpoint()).rejects.toMatchObject({
			code: 'TOO_MANY_REQUESTS',
		});
	});

	it('throws INTERNAL_SERVER_ERROR when userId is missing', async () => {
		const caller = callerFactory({
			session: null,
			orgId: null,
			role: null,
			companyId: null,
			companyRole: null,
			prisma: {} as never,
			sessionToken: null,
			ip: null,
		});

		await expect(caller.userEndpoint()).rejects.toMatchObject({
			code: 'INTERNAL_SERVER_ERROR',
		});
		expect(rateLimitLib.checkRateLimit).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// rateLimitByIp
// ---------------------------------------------------------------------------

describe('rateLimitByIp', () => {
	beforeEach(() => vi.clearAllMocks());

	it('passes when under the rate limit', async () => {
		vi.mocked(rateLimitLib.checkRateLimit).mockResolvedValueOnce(
			SUCCESS_RESULT,
		);
		const caller = callerFactory({
			session: null,
			orgId: null,
			role: null,
			companyId: null,
			companyRole: null,
			prisma: {} as never,
			sessionToken: null,
			ip: '1.2.3.4',
		});

		await expect(caller.ipEndpoint()).resolves.toBe('ok-ip');
		expect(rateLimitLib.checkRateLimit).toHaveBeenCalledWith(
			{ limit: 3, windowSeconds: 60, prefix: 'test:ip' },
			'1.2.3.4',
		);
	});

	it('throws TOO_MANY_REQUESTS when rate limit exceeded', async () => {
		vi.mocked(rateLimitLib.checkRateLimit).mockResolvedValueOnce(
			BLOCKED_RESULT,
		);
		const caller = callerFactory({
			session: null,
			orgId: null,
			role: null,
			companyId: null,
			companyRole: null,
			prisma: {} as never,
			sessionToken: null,
			ip: '1.2.3.4',
		});

		await expect(caller.ipEndpoint()).rejects.toMatchObject({
			code: 'TOO_MANY_REQUESTS',
		});
	});

	it('falls back to "unknown" when ip is null', async () => {
		vi.mocked(rateLimitLib.checkRateLimit).mockResolvedValueOnce(
			SUCCESS_RESULT,
		);
		const caller = callerFactory({
			session: null,
			orgId: null,
			role: null,
			companyId: null,
			companyRole: null,
			prisma: {} as never,
			sessionToken: null,
			ip: null,
		});

		await expect(caller.ipEndpoint()).resolves.toBe('ok-ip');
		expect(rateLimitLib.checkRateLimit).toHaveBeenCalledWith(
			{ limit: 3, windowSeconds: 60, prefix: 'test:ip' },
			'unknown',
		);
	});
});
