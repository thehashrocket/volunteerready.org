// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
	mockGetServerSession,
	mockHeadersGet,
	mockGetImpersonationContext,
	mockListCompaniesForUser,
	mockOrgMemberCount,
	mockRedirect,
} = vi.hoisted(() => ({
	mockGetServerSession: vi.fn(),
	mockHeadersGet: vi.fn(() => '/app'),
	mockGetImpersonationContext: vi.fn(),
	mockListCompaniesForUser: vi.fn(),
	mockOrgMemberCount: vi.fn(async () => 1),
	mockRedirect: vi.fn((url: string) => {
		throw new Error(`NEXT_REDIRECT:${url}`);
	}),
}));

vi.mock('next/headers', () => ({
	headers: async () => ({ get: mockHeadersGet }),
}));

vi.mock('next/navigation', () => ({
	redirect: mockRedirect,
}));

vi.mock('next-auth', () => ({
	getServerSession: mockGetServerSession,
}));

vi.mock('@/server/auth', () => ({
	authOptions: {},
}));

vi.mock('@/server/lib/impersonation-context', () => ({
	getImpersonationContext: mockGetImpersonationContext,
}));

vi.mock('@/server/repositories/companyRepo', () => ({
	listCompaniesForUser: mockListCompaniesForUser,
}));

vi.mock('@/server/repositories/prisma', () => ({
	prisma: { organizationMember: { count: mockOrgMemberCount } },
}));

// AppShell is a client component with its own hooks/state — stub it so this
// test stays focused on what AppLayout resolves and passes down, not on
// AppShell's own rendering.
vi.mock('@/components/app/app-shell', () => ({
	AppShell: ({
		hasCompany,
		companyId,
	}: {
		hasCompany: boolean;
		companyId?: string | null;
	}) => (
		<div data-testid="app-shell">
			hasCompany:{String(hasCompany)} companyId:{companyId ?? 'null'}
		</div>
	),
}));

vi.mock('@/components/app/feedback-widget', () => ({
	FeedbackWidget: () => null,
}));

vi.mock('@/components/app/impersonation-banner', () => ({
	ImpersonationBanner: () => null,
}));

vi.mock('@/components/auth-feedback', () => ({
	AuthFeedback: () => null,
}));

import AppLayout from '../layout';

const ADMIN_ID = 'admin-1';
const TARGET_ID = 'target-1';

function notImpersonating() {
	return {
		effectiveUserId: null,
		isImpersonating: false,
		impersonatedBy: null,
		impersonationSessionId: null,
		expiresAt: null,
		resolutionFailed: false,
		targetUser: null,
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
		targetUser: { id: targetId, email: 'target@example.com', name: 'Target' },
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
	mockHeadersGet.mockReturnValue('/app');
	mockOrgMemberCount.mockResolvedValue(1);
});

describe('AppLayout company resolution under impersonation', () => {
	it('resolves a single target company directly (unchanged behavior)', async () => {
		mockGetServerSession.mockResolvedValueOnce({ user: { id: ADMIN_ID } });
		mockGetImpersonationContext.mockResolvedValueOnce(impersonating(TARGET_ID));
		mockListCompaniesForUser.mockResolvedValueOnce([
			membership('target-company', 'Acme Corp'),
		]);

		const ui = await AppLayout({ children: <div /> });
		render(ui);

		expect(mockListCompaniesForUser).toHaveBeenCalledWith(TARGET_ID);
		expect(screen.getByTestId('app-shell')).toHaveTextContent(
			'hasCompany:true companyId:target-company',
		);
	});

	it('leaves companyId null with 2+ target companies, so the sidebar falls back to the picker instead of guessing', async () => {
		mockGetServerSession.mockResolvedValueOnce({ user: { id: ADMIN_ID } });
		mockGetImpersonationContext.mockResolvedValueOnce(impersonating(TARGET_ID));
		mockListCompaniesForUser.mockResolvedValueOnce([
			membership('company-a', 'Acme Corp', 'OWNER'),
			membership('company-b', 'Beta Industries', 'MEMBER'),
		]);

		const ui = await AppLayout({ children: <div /> });
		render(ui);

		expect(screen.getByTestId('app-shell')).toHaveTextContent(
			'hasCompany:true companyId:null',
		);
	});

	it('resolves hasCompany:false when the target has no company memberships', async () => {
		mockGetServerSession.mockResolvedValueOnce({ user: { id: ADMIN_ID } });
		mockGetImpersonationContext.mockResolvedValueOnce(impersonating(TARGET_ID));
		mockListCompaniesForUser.mockResolvedValueOnce([]);

		const ui = await AppLayout({ children: <div /> });
		render(ui);

		expect(screen.getByTestId('app-shell')).toHaveTextContent(
			'hasCompany:false companyId:null',
		);
	});

	it('does not query target company memberships when not impersonating', async () => {
		mockGetServerSession.mockResolvedValueOnce({
			user: { id: ADMIN_ID },
			companyId: 'admin-company',
		});
		mockGetImpersonationContext.mockResolvedValueOnce(notImpersonating());

		const ui = await AppLayout({ children: <div /> });
		render(ui);

		expect(mockListCompaniesForUser).not.toHaveBeenCalled();
		expect(screen.getByTestId('app-shell')).toHaveTextContent(
			'hasCompany:true companyId:admin-company',
		);
	});
});

describe('AppLayout no-org redirect target', () => {
	it('redirects a company-only user to /app/company, not /app/welcome', async () => {
		mockHeadersGet.mockReturnValue('/app/opportunities');
		mockOrgMemberCount.mockResolvedValue(0);
		mockGetServerSession.mockResolvedValueOnce({
			user: { id: ADMIN_ID },
			companyId: 'admin-company',
		});
		mockGetImpersonationContext.mockResolvedValueOnce(notImpersonating());

		await expect(AppLayout({ children: <div /> })).rejects.toThrow(
			'NEXT_REDIRECT:/app/company',
		);
	});

	it('redirects a user with neither org nor company to /app/welcome', async () => {
		mockHeadersGet.mockReturnValue('/app/opportunities');
		mockOrgMemberCount.mockResolvedValue(0);
		mockGetServerSession.mockResolvedValueOnce({ user: { id: ADMIN_ID } });
		mockGetImpersonationContext.mockResolvedValueOnce(notImpersonating());

		await expect(AppLayout({ children: <div /> })).rejects.toThrow(
			'NEXT_REDIRECT:/app/welcome',
		);
	});

	it('does not redirect an exempt path even without an org', async () => {
		mockHeadersGet.mockReturnValue('/app/company');
		mockOrgMemberCount.mockResolvedValue(0);
		mockGetServerSession.mockResolvedValueOnce({
			user: { id: ADMIN_ID },
			companyId: 'admin-company',
		});
		mockGetImpersonationContext.mockResolvedValueOnce(notImpersonating());

		const ui = await AppLayout({ children: <div /> });
		render(ui);

		expect(mockRedirect).not.toHaveBeenCalled();
	});
});
