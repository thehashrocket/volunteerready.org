import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
	mockGetServerSession,
	mockResolveEffectiveUserId,
	mockOrganizationMemberFindFirst,
	mockSessionFindFirst,
	mockConnectCheckrAccount,
	mockRedirect,
} = vi.hoisted(() => ({
	mockGetServerSession: vi.fn(),
	mockResolveEffectiveUserId: vi.fn(),
	mockOrganizationMemberFindFirst: vi.fn(),
	mockSessionFindFirst: vi.fn(),
	mockConnectCheckrAccount: vi.fn(),
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
	resolveEffectiveUserId: mockResolveEffectiveUserId,
}));

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		organizationMember: { findFirst: mockOrganizationMemberFindFirst },
		session: { findFirst: mockSessionFindFirst },
	},
}));

vi.mock('@/server/services/backgroundCheckService', () => ({
	connectCheckrAccount: mockConnectCheckrAccount,
}));

import { GET } from '../route';

const BASE_URL = 'http://localhost:3005';
const BG_CHECKS_URL = '/app/settings/background-checks';
const ADMIN_ID = 'admin-1';
const TARGET_ID = 'target-1';
const ADMIN_ORG_ID = 'org-admin';
const TARGET_ORG_ID = 'org-target';

function makeRequest(
	params: Record<string, string>,
	cookieValue?: string,
): NextRequest {
	const url = new URL(`${BASE_URL}/api/checkr/oauth/callback`);
	for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
	return new NextRequest(url, {
		headers: cookieValue
			? { cookie: `impersonation-session-id=${cookieValue}` }
			: undefined,
	});
}

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

beforeEach(() => {
	vi.clearAllMocks();
});

describe('GET /api/checkr/oauth/callback', () => {
	it('redirects with missing_params when code or state is absent', async () => {
		await expect(GET(makeRequest({ code: 'abc' }))).rejects.toThrow(
			`NEXT_REDIRECT:${BG_CHECKS_URL}?checkr_error=missing_params`,
		);
		expect(mockGetServerSession).not.toHaveBeenCalled();
	});

	it('redirects to sign-in when there is no effective session', async () => {
		mockGetServerSession.mockResolvedValueOnce(null);
		mockResolveEffectiveUserId.mockResolvedValueOnce(notImpersonating(null));

		await expect(
			GET(makeRequest({ code: 'abc', state: ADMIN_ORG_ID })),
		).rejects.toThrow(
			`NEXT_REDIRECT:/auth/signin?callbackUrl=${encodeURIComponent(BG_CHECKS_URL)}`,
		);
		expect(mockConnectCheckrAccount).not.toHaveBeenCalled();
	});

	it('state-mismatch: redirects when state does not match the real user org (not impersonating)', async () => {
		mockGetServerSession.mockResolvedValueOnce({ user: { id: ADMIN_ID } });
		mockResolveEffectiveUserId.mockResolvedValueOnce(
			notImpersonating(ADMIN_ID),
		);
		mockSessionFindFirst.mockResolvedValueOnce({ currentOrgId: ADMIN_ORG_ID });

		await expect(
			GET(makeRequest({ code: 'abc', state: 'some-other-org' })),
		).rejects.toThrow(
			`NEXT_REDIRECT:${BG_CHECKS_URL}?checkr_error=state_mismatch`,
		);
		expect(mockSessionFindFirst).toHaveBeenCalledWith({
			where: { userId: ADMIN_ID },
			orderBy: { expires: 'desc' },
			select: { currentOrgId: true },
		});
		expect(mockConnectCheckrAccount).not.toHaveBeenCalled();
	});

	it('state-mismatch under impersonation: checks against the target user org, not the admin session org', async () => {
		mockGetServerSession.mockResolvedValueOnce({ user: { id: ADMIN_ID } });
		mockResolveEffectiveUserId.mockResolvedValueOnce(impersonating(TARGET_ID));
		mockOrganizationMemberFindFirst.mockResolvedValueOnce({
			organizationId: TARGET_ORG_ID,
		});

		// state matches the admin's org, not the target's — must still fail,
		// since the fix resolves the target's org, not the real admin's.
		await expect(
			GET(makeRequest({ code: 'abc', state: ADMIN_ORG_ID })),
		).rejects.toThrow(
			`NEXT_REDIRECT:${BG_CHECKS_URL}?checkr_error=state_mismatch`,
		);
		expect(mockOrganizationMemberFindFirst).toHaveBeenCalledWith({
			where: { userId: TARGET_ID },
			select: { organizationId: true },
			orderBy: { createdAt: 'asc' },
		});
		expect(mockSessionFindFirst).not.toHaveBeenCalled();
	});

	it('redirects with token_exchange_failed when the token exchange throws', async () => {
		const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});
		mockGetServerSession.mockResolvedValueOnce({ user: { id: ADMIN_ID } });
		mockResolveEffectiveUserId.mockResolvedValueOnce(
			notImpersonating(ADMIN_ID),
		);
		mockSessionFindFirst.mockResolvedValueOnce({ currentOrgId: ADMIN_ORG_ID });
		mockConnectCheckrAccount.mockRejectedValueOnce(new Error('checkr 500'));

		await expect(
			GET(makeRequest({ code: 'abc', state: ADMIN_ORG_ID })),
		).rejects.toThrow(
			`NEXT_REDIRECT:${BG_CHECKS_URL}?checkr_error=token_exchange_failed`,
		);
		consoleErr.mockRestore();
	});

	it('success path (not impersonating): connects the account and redirects with checkr_connected=true', async () => {
		mockGetServerSession.mockResolvedValueOnce({ user: { id: ADMIN_ID } });
		mockResolveEffectiveUserId.mockResolvedValueOnce(
			notImpersonating(ADMIN_ID),
		);
		mockSessionFindFirst.mockResolvedValueOnce({ currentOrgId: ADMIN_ORG_ID });
		mockConnectCheckrAccount.mockResolvedValueOnce(undefined);

		await expect(
			GET(makeRequest({ code: 'abc', state: ADMIN_ORG_ID })),
		).rejects.toThrow(`NEXT_REDIRECT:${BG_CHECKS_URL}?checkr_connected=true`);
		expect(mockConnectCheckrAccount).toHaveBeenCalledWith(
			ADMIN_ORG_ID,
			'abc',
			ADMIN_ID,
			null,
		);
	});

	it('success path under impersonation: connects the target org using the target user id and tags impersonatedBy', async () => {
		mockGetServerSession.mockResolvedValueOnce({ user: { id: ADMIN_ID } });
		mockResolveEffectiveUserId.mockResolvedValueOnce(impersonating(TARGET_ID));
		mockOrganizationMemberFindFirst.mockResolvedValueOnce({
			organizationId: TARGET_ORG_ID,
		});
		mockConnectCheckrAccount.mockResolvedValueOnce(undefined);

		await expect(
			GET(makeRequest({ code: 'abc', state: TARGET_ORG_ID })),
		).rejects.toThrow(`NEXT_REDIRECT:${BG_CHECKS_URL}?checkr_connected=true`);
		expect(mockConnectCheckrAccount).toHaveBeenCalledWith(
			TARGET_ORG_ID,
			'abc',
			TARGET_ID,
			ADMIN_ID,
		);
	});

	it('passes the parsed impersonation cookie value to resolveEffectiveUserId', async () => {
		mockGetServerSession.mockResolvedValueOnce({ user: { id: ADMIN_ID } });
		mockResolveEffectiveUserId.mockResolvedValueOnce(
			notImpersonating(ADMIN_ID),
		);
		mockSessionFindFirst.mockResolvedValueOnce({ currentOrgId: ADMIN_ORG_ID });
		mockConnectCheckrAccount.mockResolvedValueOnce(undefined);

		await expect(
			GET(makeRequest({ code: 'abc', state: ADMIN_ORG_ID }, 'sess-1')),
		).rejects.toThrow(`NEXT_REDIRECT:${BG_CHECKS_URL}?checkr_connected=true`);

		expect(mockResolveEffectiveUserId).toHaveBeenCalledWith(ADMIN_ID, 'sess-1');
	});
});
