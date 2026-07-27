// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
	mockGetServerSession,
	mockHeadersGet,
	mockGetImpersonationContext,
	mockListCompaniesForUser,
	mockListMembershipOrgIds,
	mockIsFeatureEnabled,
	mockRedirect,
} = vi.hoisted(() => ({
	mockGetServerSession: vi.fn(),
	mockHeadersGet: vi.fn(() => '/app'),
	mockGetImpersonationContext: vi.fn(),
	mockListCompaniesForUser: vi.fn(),
	mockListMembershipOrgIds: vi.fn(async () => ['org-1']),
	mockIsFeatureEnabled: vi.fn(async () => false),
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

// The layout used to call prisma.organizationMember.count() directly. It now
// goes through membershipRepo, because the feature-flag gate needs the org IDS
// and not merely how many there are.
vi.mock('@/server/repositories/membershipRepo', () => ({
	listMembershipOrgIds: mockListMembershipOrgIds,
}));

vi.mock('@/server/services/featureFlagService', () => ({
	isFeatureEnabled: mockIsFeatureEnabled,
}));

vi.mock('@/server/repositories/prisma', () => ({ prisma: {} }));

// AppShell is a client component with its own hooks/state — stub it so this
// test stays focused on what AppLayout resolves and passes down, not on
// AppShell's own rendering.
vi.mock('@/components/app/app-shell', () => ({
	AppShell: ({
		hasCompany,
		companyId,
		hasVolunteerRoster,
	}: {
		hasCompany: boolean;
		companyId?: string | null;
		hasVolunteerRoster?: boolean;
	}) => (
		<div data-testid="app-shell">
			hasCompany:{String(hasCompany)} companyId:{companyId ?? 'null'}{' '}
			hasVolunteerRoster:{String(hasVolunteerRoster)}
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
	mockListMembershipOrgIds.mockResolvedValue(['org-1']);
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
		mockListMembershipOrgIds.mockResolvedValue([]);
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
		mockListMembershipOrgIds.mockResolvedValue([]);
		mockGetServerSession.mockResolvedValueOnce({ user: { id: ADMIN_ID } });
		mockGetImpersonationContext.mockResolvedValueOnce(notImpersonating());

		await expect(AppLayout({ children: <div /> })).rejects.toThrow(
			'NEXT_REDIRECT:/app/welcome',
		);
	});

	it('does not redirect an exempt path even without an org', async () => {
		mockHeadersGet.mockReturnValue('/app/company');
		mockListMembershipOrgIds.mockResolvedValue([]);
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

describe('AppLayout staff_created_volunteers gate', () => {
	beforeEach(() => {
		mockHeadersGet.mockReturnValue('/app');
		mockGetServerSession.mockResolvedValue({
			user: { id: 'u1' },
			orgId: 'org-1',
		});
		mockGetImpersonationContext.mockResolvedValue({ isImpersonating: false });
		mockListMembershipOrgIds.mockResolvedValue(['org-1']);
		mockListCompaniesForUser.mockResolvedValue([]);
	});

	it('passes hasVolunteerRoster=false when the flag is off', async () => {
		mockIsFeatureEnabled.mockResolvedValue(false);
		render(await AppLayout({ children: null }));
		expect(screen.getByTestId('app-shell')).toHaveTextContent(
			'hasVolunteerRoster:false',
		);
	});

	it('passes hasVolunteerRoster=true when the flag is on', async () => {
		mockIsFeatureEnabled.mockResolvedValue(true);
		render(await AppLayout({ children: null }));
		expect(screen.getByTestId('app-shell')).toHaveTextContent(
			'hasVolunteerRoster:true',
		);
	});

	it('resolves the flag against the session org when it is a real membership', async () => {
		mockListMembershipOrgIds.mockResolvedValue(['org-old', 'org-1']);
		mockIsFeatureEnabled.mockResolvedValue(true);
		render(await AppLayout({ children: null }));
		expect(mockIsFeatureEnabled).toHaveBeenCalledWith(
			'org-1',
			'staff_created_volunteers',
		);
	});

	it('SECURITY: resolves against the TARGET org while impersonating, not the admin session org', async () => {
		// session.orgId is the real admin's. Using it would gate on the wrong
		// tenant's flag entirely.
		mockGetImpersonationContext.mockResolvedValue({
			isImpersonating: true,
			effectiveUserId: 'target-user',
			expiresAt: null,
		});
		mockListMembershipOrgIds.mockResolvedValue(['target-org']);
		mockIsFeatureEnabled.mockResolvedValue(true);

		render(await AppLayout({ children: null }));

		expect(mockIsFeatureEnabled).toHaveBeenCalledWith(
			'target-org',
			'staff_created_volunteers',
		);
	});

	it('does not query the flag at all when the user has no org', async () => {
		mockHeadersGet.mockReturnValue('/app/profile'); // exempt, so no redirect
		mockListMembershipOrgIds.mockResolvedValue([]);
		render(await AppLayout({ children: null }));
		expect(mockIsFeatureEnabled).not.toHaveBeenCalled();
	});
});
