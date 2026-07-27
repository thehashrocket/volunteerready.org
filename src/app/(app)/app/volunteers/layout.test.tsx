// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getServerSession: vi.fn(),
	getImpersonationContext: vi.fn(),
	listMembershipOrgIds: vi.fn(),
	isFeatureEnabled: vi.fn(),
	redirect: vi.fn((url: string) => {
		throw new Error(`NEXT_REDIRECT:${url}`);
	}),
}));

vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('next-auth', () => ({ getServerSession: mocks.getServerSession }));
vi.mock('@/server/auth', () => ({ authOptions: {} }));
vi.mock('@/server/lib/impersonation-context', () => ({
	getImpersonationContext: mocks.getImpersonationContext,
}));
vi.mock('@/server/repositories/membershipRepo', () => ({
	listMembershipOrgIds: mocks.listMembershipOrgIds,
}));
vi.mock('@/server/services/featureFlagService', () => ({
	isFeatureEnabled: mocks.isFeatureEnabled,
}));
vi.mock('@/server/repositories/prisma', () => ({ prisma: {} }));

import VolunteersLayout from './layout';

beforeEach(() => {
	vi.clearAllMocks();
	mocks.getServerSession.mockResolvedValue({
		user: { id: 'u1' },
		orgId: 'org-1',
	});
	mocks.getImpersonationContext.mockResolvedValue({ isImpersonating: false });
	mocks.listMembershipOrgIds.mockResolvedValue(['org-1']);
	mocks.isFeatureEnabled.mockResolvedValue(true);
});

/**
 * The sidebar hides the nav item when the flag is off, but that is cosmetic —
 * anyone can type the URL. This guard is what actually closes the route, so
 * "is the feature off?" has one answer regardless of how you arrived.
 */
describe('VolunteersLayout route guard', () => {
	it('renders children when the flag is on', async () => {
		const result = await VolunteersLayout({ children: 'CONTENT' });
		expect(result).toBeTruthy();
		expect(mocks.redirect).not.toHaveBeenCalled();
	});

	it('redirects to /app when the flag is off, even with a valid session', async () => {
		mocks.isFeatureEnabled.mockResolvedValue(false);

		await expect(VolunteersLayout({ children: null })).rejects.toThrow(
			'NEXT_REDIRECT:/app',
		);
	});

	it('redirects when there is no session at all', async () => {
		mocks.getServerSession.mockResolvedValue(null);

		await expect(VolunteersLayout({ children: null })).rejects.toThrow(
			'NEXT_REDIRECT:/app',
		);
		// Must not even reach the flag lookup without an identity.
		expect(mocks.isFeatureEnabled).not.toHaveBeenCalled();
	});

	it('redirects when the user belongs to no org', async () => {
		mocks.listMembershipOrgIds.mockResolvedValue([]);

		await expect(VolunteersLayout({ children: null })).rejects.toThrow(
			'NEXT_REDIRECT:/app',
		);
		expect(mocks.isFeatureEnabled).not.toHaveBeenCalled();
	});

	it('SECURITY: fails CLOSED when impersonation resolution failed', async () => {
		// THE REAL SHAPE. resolveEffectiveUserId returns isImpersonating:FALSE
		// alongside resolutionFailed:true (impersonation-context.ts:79-86) — NOT
		// isImpersonating:true. An earlier version of this test mocked
		// {isImpersonating:true, effectiveUserId:null}, a state production never
		// produces, so it passed against a guard that actually fell through to
		// the real admin's session and gated on the WRONG TENANT's flag.
		mocks.getImpersonationContext.mockResolvedValue({
			isImpersonating: false,
			effectiveUserId: null,
			resolutionFailed: true,
		});
		// A live admin session is present — that is exactly what made the old
		// guard fall through instead of refusing.
		mocks.getServerSession.mockResolvedValue({
			user: { id: 'real-admin' },
			orgId: 'admin-org',
		});

		await expect(VolunteersLayout({ children: null })).rejects.toThrow(
			'NEXT_REDIRECT:/app',
		);
		expect(mocks.listMembershipOrgIds).not.toHaveBeenCalled();
		expect(mocks.isFeatureEnabled).not.toHaveBeenCalled();
	});

	it('SECURITY: gates on the TARGET org while impersonating, not the admin session org', async () => {
		mocks.getImpersonationContext.mockResolvedValue({
			isImpersonating: true,
			effectiveUserId: 'target-user',
		});
		// session.orgId is the admin's own org and must be ignored.
		mocks.getServerSession.mockResolvedValue({
			user: { id: 'admin' },
			orgId: 'admin-org',
		});
		mocks.listMembershipOrgIds.mockResolvedValue(['target-org']);

		await VolunteersLayout({ children: null });

		expect(mocks.listMembershipOrgIds).toHaveBeenCalledWith('target-user');
		expect(mocks.isFeatureEnabled).toHaveBeenCalledWith(
			'target-org',
			'staff_created_volunteers',
		);
	});

	it('gates on the flag key from the registry constant, not a literal typo', async () => {
		// An unknown key silently resolves to false in isFeatureEnabled, which
		// looks like "flag is off" rather than "flag name is wrong".
		await VolunteersLayout({ children: null });
		expect(mocks.isFeatureEnabled).toHaveBeenCalledWith(
			expect.any(String),
			'staff_created_volunteers',
		);
	});
});
