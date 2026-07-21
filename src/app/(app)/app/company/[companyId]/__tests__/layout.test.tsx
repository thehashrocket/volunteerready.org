import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
	mockGetServerSession,
	mockCookieGet,
	mockResolveEffectiveUserId,
	mockGetCompanyMembership,
	mockRedirect,
} = vi.hoisted(() => ({
	mockGetServerSession: vi.fn(),
	mockCookieGet: vi.fn(),
	mockResolveEffectiveUserId: vi.fn(),
	mockGetCompanyMembership: vi.fn(),
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

vi.mock('@/server/repositories/companyRepo', () => ({
	getCompanyMembership: mockGetCompanyMembership,
}));

import CompanyLayout from '../layout';

const ADMIN_ID = 'admin-1';
const TARGET_ID = 'target-1';
const COMPANY_ID = 'company-1';

function notImpersonating(userId: string | null) {
	return {
		effectiveUserId: userId,
		isImpersonating: false,
		impersonatedBy: null,
		impersonationSessionId: null,
		expiresAt: null,
	};
}

function impersonating(targetId: string) {
	return {
		effectiveUserId: targetId,
		isImpersonating: true,
		impersonatedBy: ADMIN_ID,
		impersonationSessionId: 'sess-1',
		expiresAt: new Date('2026-07-20T21:00:00Z'),
	};
}

function renderLayout() {
	return CompanyLayout({
		children: 'child-content' as unknown as React.ReactNode,
		params: Promise.resolve({ companyId: COMPANY_ID }),
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	mockCookieGet.mockReturnValue(undefined);
});

describe('CompanyLayout guard', () => {
	it('redirects unauthenticated visitors to /login', async () => {
		mockGetServerSession.mockResolvedValueOnce(null);
		mockResolveEffectiveUserId.mockResolvedValueOnce(notImpersonating(null));

		await expect(renderLayout()).rejects.toThrow('NEXT_REDIRECT:/login');
		expect(mockGetCompanyMembership).not.toHaveBeenCalled();
	});

	it('regression guard: a real (non-impersonating) member renders the page', async () => {
		mockGetServerSession.mockResolvedValueOnce({ user: { id: ADMIN_ID } });
		mockResolveEffectiveUserId.mockResolvedValueOnce(
			notImpersonating(ADMIN_ID),
		);
		mockGetCompanyMembership.mockResolvedValueOnce({ role: 'OWNER' });

		const result = await renderLayout();

		expect(mockGetCompanyMembership).toHaveBeenCalledWith(ADMIN_ID, COMPANY_ID);
		expect(mockRedirect).not.toHaveBeenCalled();
		expect(result).toBeTruthy();
	});

	it('redirects to /app/company when impersonating a non-member of this company', async () => {
		mockGetServerSession.mockResolvedValueOnce({ user: { id: ADMIN_ID } });
		mockResolveEffectiveUserId.mockResolvedValueOnce(impersonating(TARGET_ID));
		mockGetCompanyMembership.mockResolvedValueOnce(null);

		await expect(renderLayout()).rejects.toThrow('NEXT_REDIRECT:/app/company');
		// Membership was checked against the impersonated target, not the admin.
		expect(mockGetCompanyMembership).toHaveBeenCalledWith(
			TARGET_ID,
			COMPANY_ID,
		);
	});

	it('renders the page when impersonating a member of this company', async () => {
		mockGetServerSession.mockResolvedValueOnce({ user: { id: ADMIN_ID } });
		mockResolveEffectiveUserId.mockResolvedValueOnce(impersonating(TARGET_ID));
		mockGetCompanyMembership.mockResolvedValueOnce({ role: 'MEMBER' });

		const result = await renderLayout();

		expect(mockGetCompanyMembership).toHaveBeenCalledWith(
			TARGET_ID,
			COMPANY_ID,
		);
		expect(mockRedirect).not.toHaveBeenCalled();
		expect(result).toBeTruthy();
	});
});
