import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
	mockGetServerSession,
	mockCookieGet,
	mockResolveEffectiveUserId,
	mockCompanyMemberFindFirst,
	mockRedirect,
} = vi.hoisted(() => ({
	mockGetServerSession: vi.fn(),
	mockCookieGet: vi.fn(),
	mockResolveEffectiveUserId: vi.fn(),
	mockCompanyMemberFindFirst: vi.fn(),
	mockRedirect: vi.fn((url: string) => {
		throw new Error(`NEXT_REDIRECT:${url}`);
	}),
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

vi.mock('next/navigation', () => ({
	redirect: mockRedirect,
}));

vi.mock('@/server/lib/impersonation-context', () => ({
	resolveEffectiveUserId: mockResolveEffectiveUserId,
}));

vi.mock('@/server/repositories/prisma', () => ({
	prisma: { companyMember: { findFirst: mockCompanyMemberFindFirst } },
}));

import CompanyIndexPage from '../page';

const ADMIN_ID = 'admin-1';
const TARGET_ID = 'target-1';

function notImpersonating(userId: string | null) {
	return {
		effectiveUserId: userId,
		isImpersonating: false,
		impersonatedBy: null,
		impersonationSessionId: null,
		expiresAt: null,
		resolutionFailed: false,
	};
}

function impersonating(targetId: string) {
	return {
		effectiveUserId: targetId,
		isImpersonating: true,
		impersonatedBy: ADMIN_ID,
		impersonationSessionId: 'sess-1',
		expiresAt: new Date('2026-07-20T21:00:00Z'),
		resolutionFailed: false,
	};
}

function resolutionFailed() {
	return {
		effectiveUserId: null,
		isImpersonating: false,
		impersonatedBy: null,
		impersonationSessionId: null,
		expiresAt: null,
		resolutionFailed: true,
	};
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe('CompanyIndexPage redirect', () => {
	it('redirects to the session company when not impersonating', async () => {
		mockGetServerSession.mockResolvedValueOnce({
			user: { id: ADMIN_ID },
			companyId: 'admin-company',
		});
		mockResolveEffectiveUserId.mockResolvedValueOnce(
			notImpersonating(ADMIN_ID),
		);

		await expect(CompanyIndexPage()).rejects.toThrow(
			'NEXT_REDIRECT:/app/company/admin-company',
		);
		expect(mockCompanyMemberFindFirst).not.toHaveBeenCalled();
	});

	it('redirects to /app/browse when the real user has no session company', async () => {
		mockGetServerSession.mockResolvedValueOnce({ user: { id: ADMIN_ID } });
		mockResolveEffectiveUserId.mockResolvedValueOnce(
			notImpersonating(ADMIN_ID),
		);

		await expect(CompanyIndexPage()).rejects.toThrow(
			'NEXT_REDIRECT:/app/browse',
		);
	});

	it('under impersonation, redirects to the target user membership — not the admin session company, breaking the redirect loop', async () => {
		mockGetServerSession.mockResolvedValueOnce({
			user: { id: ADMIN_ID },
			// Admin's own session company differs from the target's — if the
			// bug regresses (falling back to this value), the layout guard
			// would reject it and bounce back here forever.
			companyId: 'admin-company',
		});
		mockResolveEffectiveUserId.mockResolvedValueOnce(impersonating(TARGET_ID));
		mockCompanyMemberFindFirst.mockResolvedValueOnce({
			companyId: 'target-company',
		});

		await expect(CompanyIndexPage()).rejects.toThrow(
			'NEXT_REDIRECT:/app/company/target-company',
		);
		expect(mockCompanyMemberFindFirst).toHaveBeenCalledWith({
			where: { userId: TARGET_ID },
			select: { companyId: true },
			orderBy: { createdAt: 'asc' },
		});
	});

	it('under impersonation, redirects to /app/browse (not the admin session company) when the target has no company', async () => {
		mockGetServerSession.mockResolvedValueOnce({
			user: { id: ADMIN_ID },
			companyId: 'admin-company',
		});
		mockResolveEffectiveUserId.mockResolvedValueOnce(impersonating(TARGET_ID));
		mockCompanyMemberFindFirst.mockResolvedValueOnce(null);

		await expect(CompanyIndexPage()).rejects.toThrow(
			'NEXT_REDIRECT:/app/browse',
		);
	});

	it('fails closed to /app/browse — not the admin session company — when impersonation resolution errors', async () => {
		mockGetServerSession.mockResolvedValueOnce({
			user: { id: ADMIN_ID },
			// The admin's own session company must never be used as a fallback
			// when resolution itself failed — that would silently land them on
			// their own company while believing they're still impersonating.
			companyId: 'admin-company',
		});
		mockResolveEffectiveUserId.mockResolvedValueOnce(resolutionFailed());

		await expect(CompanyIndexPage()).rejects.toThrow(
			'NEXT_REDIRECT:/app/browse',
		);
		expect(mockCompanyMemberFindFirst).not.toHaveBeenCalled();
	});
});
