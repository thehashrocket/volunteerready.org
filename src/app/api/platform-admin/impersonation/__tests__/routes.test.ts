import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
	mockGetServerSession,
	mockIsPlatformAdmin,
	mockStartImpersonation,
	mockEndImpersonation,
	mockCookieSet,
	mockCookieGet,
	mockCookieDelete,
} = vi.hoisted(() => ({
	mockGetServerSession: vi.fn(),
	mockIsPlatformAdmin: vi.fn(),
	mockStartImpersonation: vi.fn(),
	mockEndImpersonation: vi.fn(),
	mockCookieSet: vi.fn(),
	mockCookieGet: vi.fn(),
	mockCookieDelete: vi.fn(),
}));

vi.mock('next-auth', () => ({
	getServerSession: mockGetServerSession,
}));

vi.mock('@/server/auth', () => ({
	authOptions: {},
}));

vi.mock('next/headers', () => ({
	cookies: async () => ({
		set: mockCookieSet,
		get: mockCookieGet,
		delete: mockCookieDelete,
	}),
}));

vi.mock('@/server/domain/platform-admin', () => ({
	isPlatformAdmin: mockIsPlatformAdmin,
}));

vi.mock('@/server/services/impersonationService', () => ({
	startImpersonation: mockStartImpersonation,
	endImpersonation: mockEndImpersonation,
}));

import { POST as endRoute } from '../end/route';
import { POST as startRoute } from '../start/route';

function makeRequest(body: unknown | 'INVALID_JSON'): Request {
	return {
		json: async () => {
			if (body === 'INVALID_JSON') {
				throw new Error('Unexpected token');
			}
			return body;
		},
	} as unknown as Request;
}

const VALID_TARGET = 'cl1valid0000000000000001';
const VALID_REASON = 'support ticket investigation';

describe('POST /api/platform-admin/impersonation/start', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns 401 when no session', async () => {
		mockGetServerSession.mockResolvedValueOnce(null);

		const res = await startRoute(
			makeRequest({ targetId: VALID_TARGET, reason: VALID_REASON }) as never,
		);

		expect(res.status).toBe(401);
		expect(await res.json()).toEqual({ error: 'Unauthorized' });
		expect(mockIsPlatformAdmin).not.toHaveBeenCalled();
		expect(mockStartImpersonation).not.toHaveBeenCalled();
	});

	it('returns 403 when caller is not a platform admin', async () => {
		mockGetServerSession.mockResolvedValueOnce({ user: { id: 'u1' } });
		mockIsPlatformAdmin.mockResolvedValueOnce(false);

		const res = await startRoute(
			makeRequest({ targetId: VALID_TARGET, reason: VALID_REASON }) as never,
		);

		expect(res.status).toBe(403);
		expect(await res.json()).toEqual({ error: 'Forbidden' });
		expect(mockStartImpersonation).not.toHaveBeenCalled();
	});

	it('returns 400 when body is not valid JSON', async () => {
		mockGetServerSession.mockResolvedValueOnce({ user: { id: 'admin-1' } });
		mockIsPlatformAdmin.mockResolvedValueOnce(true);

		const res = await startRoute(makeRequest('INVALID_JSON') as never);

		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({ error: 'Invalid JSON' });
	});

	it('returns 400 when input fails schema validation', async () => {
		mockGetServerSession.mockResolvedValueOnce({ user: { id: 'admin-1' } });
		mockIsPlatformAdmin.mockResolvedValueOnce(true);

		const res = await startRoute(
			makeRequest({ targetId: 'not-a-cuid', reason: 'too short' }) as never,
		);

		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toBe('Invalid input');
		expect(Array.isArray(body.issues)).toBe(true);
		expect(mockStartImpersonation).not.toHaveBeenCalled();
	});

	it('sets the impersonation cookie and returns sessionId on success', async () => {
		mockGetServerSession.mockResolvedValueOnce({ user: { id: 'admin-1' } });
		mockIsPlatformAdmin.mockResolvedValueOnce(true);
		const expiresAt = new Date('2026-04-17T15:00:00Z');
		mockStartImpersonation.mockResolvedValueOnce({
			sessionId: 'sess-1',
			targetUserId: VALID_TARGET,
			expiresAt,
		});

		const res = await startRoute(
			makeRequest({ targetId: VALID_TARGET, reason: VALID_REASON }) as never,
		);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			sessionId: 'sess-1',
			targetUserId: VALID_TARGET,
			expiresAt: expiresAt.toISOString(),
		});
		expect(mockStartImpersonation).toHaveBeenCalledWith(
			'admin-1',
			VALID_TARGET,
			VALID_REASON,
		);
		expect(mockCookieSet).toHaveBeenCalledWith(
			'impersonation-session-id',
			'sess-1',
			expect.objectContaining({
				httpOnly: true,
				sameSite: 'lax',
				path: '/',
			}),
		);
	});

	it('maps FORBIDDEN TRPCError to 403', async () => {
		mockGetServerSession.mockResolvedValueOnce({ user: { id: 'admin-1' } });
		mockIsPlatformAdmin.mockResolvedValueOnce(true);
		mockStartImpersonation.mockRejectedValueOnce(
			new TRPCError({
				code: 'FORBIDDEN',
				message: 'Cannot impersonate another platform admin.',
			}),
		);

		const res = await startRoute(
			makeRequest({ targetId: VALID_TARGET, reason: VALID_REASON }) as never,
		);

		expect(res.status).toBe(403);
		expect(mockCookieSet).not.toHaveBeenCalled();
	});

	it('maps NOT_FOUND TRPCError to 404', async () => {
		mockGetServerSession.mockResolvedValueOnce({ user: { id: 'admin-1' } });
		mockIsPlatformAdmin.mockResolvedValueOnce(true);
		mockStartImpersonation.mockRejectedValueOnce(
			new TRPCError({ code: 'NOT_FOUND', message: 'Target user not found.' }),
		);

		const res = await startRoute(
			makeRequest({ targetId: VALID_TARGET, reason: VALID_REASON }) as never,
		);

		expect(res.status).toBe(404);
	});

	it('maps BAD_REQUEST TRPCError to 400', async () => {
		mockGetServerSession.mockResolvedValueOnce({ user: { id: 'admin-1' } });
		mockIsPlatformAdmin.mockResolvedValueOnce(true);
		mockStartImpersonation.mockRejectedValueOnce(
			new TRPCError({
				code: 'BAD_REQUEST',
				message: 'You cannot impersonate yourself.',
			}),
		);

		const res = await startRoute(
			makeRequest({ targetId: VALID_TARGET, reason: VALID_REASON }) as never,
		);

		expect(res.status).toBe(400);
	});

	it('maps unexpected errors to 500 without leaking internal details', async () => {
		const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});
		mockGetServerSession.mockResolvedValueOnce({ user: { id: 'admin-1' } });
		mockIsPlatformAdmin.mockResolvedValueOnce(true);
		mockStartImpersonation.mockRejectedValueOnce(
			new Error('Prisma: unique_violation on ImpersonationSession_pkey'),
		);

		const res = await startRoute(
			makeRequest({ targetId: VALID_TARGET, reason: VALID_REASON }) as never,
		);

		expect(res.status).toBe(500);
		const body = await res.json();
		expect(body.error).toBe('Failed to start impersonation.');
		expect(body.error).not.toMatch(/prisma|unique_violation/i);
		expect(consoleErr).toHaveBeenCalled();
		consoleErr.mockRestore();
	});
});

describe('POST /api/platform-admin/impersonation/end', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns 401 when no session', async () => {
		mockGetServerSession.mockResolvedValueOnce(null);

		const res = await endRoute();

		expect(res.status).toBe(401);
		expect(await res.json()).toEqual({ error: 'Unauthorized' });
		expect(mockEndImpersonation).not.toHaveBeenCalled();
	});

	it('is a no-op when no impersonation cookie is present', async () => {
		mockGetServerSession.mockResolvedValueOnce({ user: { id: 'admin-1' } });
		mockCookieGet.mockReturnValueOnce(undefined);

		const res = await endRoute();

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ok: true, alreadyEnded: true });
		expect(mockEndImpersonation).not.toHaveBeenCalled();
		expect(mockCookieDelete).not.toHaveBeenCalled();
	});

	it('calls endImpersonation with the cookie value and clears the cookie', async () => {
		mockGetServerSession.mockResolvedValueOnce({ user: { id: 'admin-1' } });
		mockCookieGet.mockReturnValueOnce({ value: 'sess-1' });
		mockEndImpersonation.mockResolvedValueOnce({
			ok: true,
			alreadyEnded: false,
		});

		const res = await endRoute();

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ok: true, alreadyEnded: false });
		expect(mockEndImpersonation).toHaveBeenCalledWith(
			'sess-1',
			'admin-1',
			'manual',
		);
		expect(mockCookieDelete).toHaveBeenCalledWith('impersonation-session-id');
	});

	it('SECURITY: clears cookie and returns 403 when service throws FORBIDDEN', async () => {
		mockGetServerSession.mockResolvedValueOnce({ user: { id: 'admin-2' } });
		mockCookieGet.mockReturnValueOnce({ value: 'sess-1' });
		mockEndImpersonation.mockRejectedValueOnce(
			new TRPCError({
				code: 'FORBIDDEN',
				message: 'Cannot end another admin’s impersonation session.',
			}),
		);

		const res = await endRoute();

		expect(res.status).toBe(403);
		expect(mockCookieDelete).toHaveBeenCalledWith('impersonation-session-id');
	});

	it('clears the cookie and returns 500 when service throws unexpectedly', async () => {
		mockGetServerSession.mockResolvedValueOnce({ user: { id: 'admin-1' } });
		mockCookieGet.mockReturnValueOnce({ value: 'sess-1' });
		mockEndImpersonation.mockRejectedValueOnce(new Error('db blew up'));

		const res = await endRoute();

		expect(res.status).toBe(500);
		expect(await res.json()).toEqual({
			error: 'Failed to end impersonation.',
		});
		// Critical: cookie is cleared even on failure to avoid leaving the admin
		// silently impersonating after the UI redirects them away.
		expect(mockCookieDelete).toHaveBeenCalledWith('impersonation-session-id');
	});
});
