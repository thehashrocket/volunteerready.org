// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
	mockGetServerSession,
	mockCookieGet,
	mockResolveEffectiveUserId,
	mockListCompaniesForUser,
	mockRedirect,
} = vi.hoisted(() => ({
	mockGetServerSession: vi.fn(),
	mockCookieGet: vi.fn(),
	mockResolveEffectiveUserId: vi.fn(),
	mockListCompaniesForUser: vi.fn(),
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
	listCompaniesForUser: mockListCompaniesForUser,
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

function membership(
	companyId: string,
	name: string,
	role: 'OWNER' | 'ADMIN' | 'MEMBER' = 'MEMBER',
) {
	return { role, company: { id: companyId, name, slug: companyId } };
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
		expect(mockListCompaniesForUser).not.toHaveBeenCalled();
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

	it('under impersonation with exactly one company, redirects to the target user membership — not the admin session company, breaking the redirect loop', async () => {
		mockGetServerSession.mockResolvedValueOnce({
			user: { id: ADMIN_ID },
			// Admin's own session company differs from the target's — if the
			// bug regresses (falling back to this value), the layout guard
			// would reject it and bounce back here forever.
			companyId: 'admin-company',
		});
		mockResolveEffectiveUserId.mockResolvedValueOnce(impersonating(TARGET_ID));
		mockListCompaniesForUser.mockResolvedValueOnce([
			membership('target-company', 'Acme Corp'),
		]);

		await expect(CompanyIndexPage()).rejects.toThrow(
			'NEXT_REDIRECT:/app/company/target-company',
		);
		expect(mockListCompaniesForUser).toHaveBeenCalledWith(TARGET_ID);
	});

	it('under impersonation, redirects to /app/browse (not the admin session company) when the target has no company', async () => {
		mockGetServerSession.mockResolvedValueOnce({
			user: { id: ADMIN_ID },
			companyId: 'admin-company',
		});
		mockResolveEffectiveUserId.mockResolvedValueOnce(impersonating(TARGET_ID));
		mockListCompaniesForUser.mockResolvedValueOnce([]);

		await expect(CompanyIndexPage()).rejects.toThrow(
			'NEXT_REDIRECT:/app/browse',
		);
	});

	it('under impersonation with 2+ companies, renders a picker instead of guessing one', async () => {
		mockGetServerSession.mockResolvedValueOnce({
			user: { id: ADMIN_ID },
			companyId: 'admin-company',
		});
		mockResolveEffectiveUserId.mockResolvedValueOnce(impersonating(TARGET_ID));
		mockListCompaniesForUser.mockResolvedValueOnce([
			membership('company-a', 'Acme Corp', 'OWNER'),
			membership('company-b', 'Beta Industries', 'MEMBER'),
		]);

		const ui = await CompanyIndexPage();
		render(ui);

		expect(mockRedirect).not.toHaveBeenCalled();
		const acmeLink = screen.getByRole('link', { name: /Acme Corp/ });
		const betaLink = screen.getByRole('link', { name: /Beta Industries/ });
		expect(acmeLink).toHaveAttribute('href', '/app/company/company-a');
		expect(betaLink).toHaveAttribute('href', '/app/company/company-b');
		// Scoped to each row so a swapped role-to-company mapping would fail.
		expect(within(acmeLink).getByText('Owner')).toBeInTheDocument();
		expect(within(betaLink).getByText('Member')).toBeInTheDocument();
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
		expect(mockListCompaniesForUser).not.toHaveBeenCalled();
	});
});
