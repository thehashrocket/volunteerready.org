import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
	mockGetServerSession,
	mockCookieGet,
	mockResolveImpersonation,
	mockCaptureException,
	mockUserFindUnique,
} = vi.hoisted(() => ({
	mockGetServerSession: vi.fn(),
	mockCookieGet: vi.fn(),
	mockResolveImpersonation: vi.fn(),
	mockCaptureException: vi.fn(),
	mockUserFindUnique: vi.fn(),
}));

vi.mock('next-auth', () => ({
	getServerSession: mockGetServerSession,
}));

vi.mock('@/server/auth', () => ({
	authOptions: {},
}));

vi.mock('next/headers', () => ({
	cookies: async () => ({ get: mockCookieGet }),
}));

vi.mock('@/server/services/impersonationService', () => ({
	resolveImpersonation: mockResolveImpersonation,
}));

vi.mock('@sentry/nextjs', () => ({
	captureException: mockCaptureException,
}));

vi.mock('@/server/repositories/prisma', () => ({
	prisma: { user: { findUnique: mockUserFindUnique } },
}));

import {
	getImpersonationContext,
	resolveEffectiveUserId,
} from './impersonation-context';

const REAL_USER_ID = 'admin-1';
const TARGET_USER_ID = 'target-1';
const COOKIE_VALUE = 'sess-1';

const EFFECTIVE_USER = {
	userId: TARGET_USER_ID,
	isImpersonation: true as const,
	impersonatedBy: REAL_USER_ID,
	impersonationSessionId: COOKIE_VALUE,
	expiresAt: new Date('2026-07-20T21:00:00Z'),
};

beforeEach(() => {
	vi.clearAllMocks();
});

describe('resolveEffectiveUserId', () => {
	it('branch 1: falls back to the real user (null) when there is no real user id', async () => {
		const result = await resolveEffectiveUserId(null, COOKIE_VALUE);

		expect(result).toEqual({
			effectiveUserId: null,
			isImpersonating: false,
			impersonatedBy: null,
			impersonationSessionId: null,
			expiresAt: null,
			resolutionFailed: false,
		});
		expect(mockResolveImpersonation).not.toHaveBeenCalled();
	});

	it('branch 2: falls back to the real user when there is no impersonation cookie', async () => {
		const result = await resolveEffectiveUserId(REAL_USER_ID, null);

		expect(result).toEqual({
			effectiveUserId: REAL_USER_ID,
			isImpersonating: false,
			impersonatedBy: null,
			impersonationSessionId: null,
			expiresAt: null,
			resolutionFailed: false,
		});
		expect(mockResolveImpersonation).not.toHaveBeenCalled();
	});

	it('branch 3: fails CLOSED (effectiveUserId null) and reports to Sentry when resolveImpersonation throws', async () => {
		mockResolveImpersonation.mockRejectedValueOnce(new Error('db down'));

		const result = await resolveEffectiveUserId(REAL_USER_ID, COOKIE_VALUE);

		// Must NOT fall back to the real admin's id here — a transient
		// resolution error must never let a write proceed under any identity.
		expect(result).toEqual({
			effectiveUserId: null,
			isImpersonating: false,
			impersonatedBy: null,
			impersonationSessionId: null,
			expiresAt: null,
			resolutionFailed: true,
		});
		expect(mockCaptureException).toHaveBeenCalledWith(
			expect.any(Error),
			expect.objectContaining({
				tags: { source: 'IMPERSONATION_RESOLVE_FAILED' },
			}),
		);
	});

	it('branch 4: falls back to the real user when resolveImpersonation returns no effective user', async () => {
		mockResolveImpersonation.mockResolvedValueOnce({
			effective: null,
			shouldClearCookie: true,
		});

		const result = await resolveEffectiveUserId(REAL_USER_ID, COOKIE_VALUE);

		expect(result).toEqual({
			effectiveUserId: REAL_USER_ID,
			isImpersonating: false,
			impersonatedBy: null,
			impersonationSessionId: null,
			expiresAt: null,
			resolutionFailed: false,
		});
	});

	it('branch 5: returns the target user id and audit fields when impersonating', async () => {
		mockResolveImpersonation.mockResolvedValueOnce({
			effective: EFFECTIVE_USER,
			shouldClearCookie: false,
			sessionId: COOKIE_VALUE,
		});

		const result = await resolveEffectiveUserId(REAL_USER_ID, COOKIE_VALUE);

		expect(result).toEqual({
			effectiveUserId: TARGET_USER_ID,
			isImpersonating: true,
			impersonatedBy: REAL_USER_ID,
			impersonationSessionId: COOKIE_VALUE,
			expiresAt: EFFECTIVE_USER.expiresAt,
			resolutionFailed: false,
		});
		expect(mockResolveImpersonation).toHaveBeenCalledWith(
			REAL_USER_ID,
			COOKIE_VALUE,
		);
	});
});

describe('getImpersonationContext — targetUser-lookup gating', () => {
	it('does not query for a target user when not impersonating (no session)', async () => {
		mockGetServerSession.mockResolvedValueOnce(null);
		mockCookieGet.mockReturnValueOnce(undefined);

		const ctx = await getImpersonationContext();

		expect(ctx).toEqual({
			realUserId: null,
			effectiveUserId: null,
			isImpersonating: false,
			sessionId: null,
			expiresAt: null,
			targetUser: null,
			resolutionFailed: false,
		});
		expect(mockUserFindUnique).not.toHaveBeenCalled();
	});

	it('does not query for a target user when there is no impersonation cookie', async () => {
		mockGetServerSession.mockResolvedValueOnce({
			user: { id: REAL_USER_ID },
		});
		mockCookieGet.mockReturnValueOnce(undefined);

		const ctx = await getImpersonationContext();

		expect(ctx).toEqual({
			realUserId: REAL_USER_ID,
			effectiveUserId: REAL_USER_ID,
			isImpersonating: false,
			sessionId: null,
			expiresAt: null,
			targetUser: null,
			resolutionFailed: false,
		});
		expect(mockUserFindUnique).not.toHaveBeenCalled();
	});

	it('runs the targeted banner lookup only when impersonating, and returns target info', async () => {
		mockGetServerSession.mockResolvedValueOnce({
			user: { id: REAL_USER_ID },
		});
		mockCookieGet.mockReturnValueOnce({ value: COOKIE_VALUE });
		mockResolveImpersonation.mockResolvedValueOnce({
			effective: EFFECTIVE_USER,
			shouldClearCookie: false,
			sessionId: COOKIE_VALUE,
		});
		mockUserFindUnique.mockResolvedValueOnce({
			id: TARGET_USER_ID,
			email: 'target@example.com',
			name: 'Target User',
		});

		const ctx = await getImpersonationContext();

		expect(mockUserFindUnique).toHaveBeenCalledWith({
			where: { id: TARGET_USER_ID },
			select: { id: true, email: true, name: true },
		});
		expect(ctx).toEqual({
			realUserId: REAL_USER_ID,
			effectiveUserId: TARGET_USER_ID,
			isImpersonating: true,
			sessionId: COOKIE_VALUE,
			expiresAt: EFFECTIVE_USER.expiresAt,
			targetUser: {
				id: TARGET_USER_ID,
				email: 'target@example.com',
				name: 'Target User',
			},
			resolutionFailed: false,
		});
	});

	it('fails closed (effectiveUserId null, resolutionFailed true, no target lookup) when resolveImpersonation throws', async () => {
		mockGetServerSession.mockResolvedValueOnce({
			user: { id: REAL_USER_ID },
		});
		mockCookieGet.mockReturnValueOnce({ value: COOKIE_VALUE });
		mockResolveImpersonation.mockRejectedValueOnce(new Error('db down'));

		const ctx = await getImpersonationContext();

		expect(mockUserFindUnique).not.toHaveBeenCalled();
		expect(ctx).toEqual({
			realUserId: REAL_USER_ID,
			effectiveUserId: null,
			isImpersonating: false,
			sessionId: null,
			expiresAt: null,
			targetUser: null,
			resolutionFailed: true,
		});
	});
});
