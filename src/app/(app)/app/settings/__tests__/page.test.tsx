import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
	mockGetServerSession,
	mockGetImpersonationContext,
	mockGetFirstOrgForUser,
	mockGetOrgProfile,
	mockRedirect,
} = vi.hoisted(() => ({
	mockGetServerSession: vi.fn(),
	mockGetImpersonationContext: vi.fn(),
	mockGetFirstOrgForUser: vi.fn(),
	mockGetOrgProfile: vi.fn(),
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

vi.mock('next/navigation', () => ({
	redirect: mockRedirect,
}));

vi.mock('@/server/lib/impersonation-context', () => ({
	getImpersonationContext: mockGetImpersonationContext,
}));

vi.mock('@/server/repositories/orgRepo', () => ({
	getFirstOrgForUser: mockGetFirstOrgForUser,
	getOrgProfile: mockGetOrgProfile,
}));

vi.mock('@/components/app/org-profile-form', () => ({
	OrgProfileForm: () => null,
}));

import OrganizationSettingsPage from '../page';

const ADMIN_ID = 'admin-1';
const TARGET_ID = 'target-1';

function notImpersonating() {
	return {
		realUserId: ADMIN_ID,
		effectiveUserId: ADMIN_ID,
		isImpersonating: false,
		sessionId: null,
		expiresAt: null,
		targetUser: null,
		resolutionFailed: false,
	};
}

function impersonating() {
	return {
		realUserId: ADMIN_ID,
		effectiveUserId: TARGET_ID,
		isImpersonating: true,
		sessionId: 'sess-1',
		expiresAt: new Date('2026-07-20T21:00:00Z'),
		targetUser: { id: TARGET_ID, email: 't@example.com', name: 'Target' },
		resolutionFailed: false,
	};
}

function resolutionFailed() {
	return {
		realUserId: ADMIN_ID,
		effectiveUserId: null,
		isImpersonating: false,
		sessionId: null,
		expiresAt: null,
		targetUser: null,
		resolutionFailed: true,
	};
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe('OrganizationSettingsPage — impersonation fail-closed', () => {
	it('redirects to /app without reading any org when resolution failed — never falls back to the admin session org', async () => {
		mockGetServerSession.mockResolvedValueOnce({
			user: { id: ADMIN_ID },
			orgId: 'admin-org',
			role: 'OWNER',
		});
		mockGetImpersonationContext.mockResolvedValueOnce(resolutionFailed());

		await expect(OrganizationSettingsPage()).rejects.toThrow(
			'NEXT_REDIRECT:/app',
		);
		expect(mockGetFirstOrgForUser).not.toHaveBeenCalled();
		expect(mockGetOrgProfile).not.toHaveBeenCalled();
	});

	it('regression: renders the target org under successful impersonation', async () => {
		mockGetServerSession.mockResolvedValueOnce({
			user: { id: ADMIN_ID },
			orgId: 'admin-org',
			role: 'OWNER',
		});
		mockGetImpersonationContext.mockResolvedValueOnce(impersonating());
		mockGetFirstOrgForUser.mockResolvedValueOnce({
			organizationId: 'target-org',
			role: 'ADMIN',
		});
		mockGetOrgProfile.mockResolvedValueOnce({
			id: 'target-org',
			name: 'Target Org',
			slug: 'target-org',
		});

		const result = await OrganizationSettingsPage();

		expect(mockGetFirstOrgForUser).toHaveBeenCalledWith(TARGET_ID);
		expect(mockGetOrgProfile).toHaveBeenCalledWith('target-org');
		expect(result).toBeTruthy();
	});

	it('regression: renders the real session org when not impersonating', async () => {
		mockGetServerSession.mockResolvedValueOnce({
			user: { id: ADMIN_ID },
			orgId: 'admin-org',
			role: 'OWNER',
		});
		mockGetImpersonationContext.mockResolvedValueOnce(notImpersonating());
		mockGetOrgProfile.mockResolvedValueOnce({
			id: 'admin-org',
			name: 'Admin Org',
			slug: 'admin-org',
		});

		const result = await OrganizationSettingsPage();

		expect(mockGetFirstOrgForUser).not.toHaveBeenCalled();
		expect(mockGetOrgProfile).toHaveBeenCalledWith('admin-org');
		expect(result).toBeTruthy();
	});
});
