import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

import { createCheckrOAuthState } from '@/server/lib/checkr-oauth-state';
import { GET } from '../route';

const BASE_URL = 'http://localhost:3005';
const BG_CHECKS_URL = '/app/settings/background-checks';
const ADMIN_ID = 'admin-1';
const TARGET_ID = 'target-1';
const ADMIN_ORG_ID = 'org-admin';
const TARGET_ORG_ID = 'org-target';
const SESSION_TOKEN = 'browser-session-1';
const SECRET = 'test-nextauth-secret';

/** A state getCheckrOAuthUrl would have issued to this browser session. */
function signed(orgId: string, sessionToken = SESSION_TOKEN, now?: number) {
	return createCheckrOAuthState({ orgId, sessionToken, now }, SECRET);
}

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

/** A signed-in session whose org context the session callback resolved. */
function adminSession(role = 'ADMIN') {
	return {
		user: { id: ADMIN_ID },
		sessionToken: SESSION_TOKEN,
		orgId: ADMIN_ORG_ID,
		role,
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.stubEnv('NEXTAUTH_SECRET', SECRET);
});

afterEach(() => {
	vi.unstubAllEnvs();
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
			GET(makeRequest({ code: 'abc', state: signed(ADMIN_ORG_ID) })),
		).rejects.toThrow(/^NEXT_REDIRECT:\/login$/);
		expect(mockConnectCheckrAccount).not.toHaveBeenCalled();
	});

	it('state-mismatch: redirects when state does not match the real user org (not impersonating)', async () => {
		mockGetServerSession.mockResolvedValueOnce(adminSession());
		mockResolveEffectiveUserId.mockResolvedValueOnce(
			notImpersonating(ADMIN_ID),
		);

		await expect(
			GET(makeRequest({ code: 'abc', state: signed('some-other-org') })),
		).rejects.toThrow(
			`NEXT_REDIRECT:${BG_CHECKS_URL}?checkr_error=state_mismatch`,
		);
		expect(mockConnectCheckrAccount).not.toHaveBeenCalled();
	});

	// Value: protects=the org a Checkr account binds to comes from a membership;
	// fails_when=the callback reads the saved org from the DB session row instead
	// of the resolved org context; why_new=existing tests mocked the DB row;
	// seam=none
	it('refuses when the session has no org context, whatever the state', async () => {
		mockGetServerSession.mockResolvedValueOnce({
			user: { id: ADMIN_ID },
			orgId: null,
			role: null,
		});
		mockResolveEffectiveUserId.mockResolvedValueOnce(
			notImpersonating(ADMIN_ID),
		);

		await expect(
			GET(makeRequest({ code: 'abc', state: signed('other-org') })),
		).rejects.toThrow(
			`NEXT_REDIRECT:${BG_CHECKS_URL}?checkr_error=state_mismatch`,
		);
		expect(mockConnectCheckrAccount).not.toHaveBeenCalled();
		expect(mockSessionFindFirst).not.toHaveBeenCalled();
	});

	// Value: protects=a connect callback only completes in the browser session
	// that started it; fails_when=the callback accepts a state it did not sign
	// for this session (unsigned, another session's, or expired);
	// why_new=state is now bound to the session; seam=none
	it.each([
		['an unsigned state', () => ADMIN_ORG_ID],
		[
			'a state signed for another session',
			() => signed(ADMIN_ORG_ID, 'other-session'),
		],
		[
			'an expired state',
			() => signed(ADMIN_ORG_ID, SESSION_TOKEN, Date.now() - 16 * 60 * 1000),
		],
		[
			'a tampered state',
			() => signed(ADMIN_ORG_ID).replace(/.$/, (c) => (c === '0' ? '1' : '0')),
		],
	])('refuses %s', async (_label, state) => {
		mockGetServerSession.mockResolvedValueOnce(adminSession());
		mockResolveEffectiveUserId.mockResolvedValueOnce(
			notImpersonating(ADMIN_ID),
		);

		await expect(
			GET(makeRequest({ code: 'abc', state: state() })),
		).rejects.toThrow(
			`NEXT_REDIRECT:${BG_CHECKS_URL}?checkr_error=state_mismatch`,
		);
		expect(mockConnectCheckrAccount).not.toHaveBeenCalled();
	});

	// Value: protects=connecting Checkr needs ADMIN+, like getCheckrOAuthUrl;
	// fails_when=the callback skips the role check; why_new=no test covered a
	// member below ADMIN; seam=none
	it.each(['READONLY', 'STAFF'])(
		'refuses a %s member of the org',
		async (role) => {
			mockGetServerSession.mockResolvedValueOnce(adminSession(role));
			mockResolveEffectiveUserId.mockResolvedValueOnce(
				notImpersonating(ADMIN_ID),
			);

			await expect(
				GET(makeRequest({ code: 'abc', state: signed(ADMIN_ORG_ID) })),
			).rejects.toThrow(
				`NEXT_REDIRECT:${BG_CHECKS_URL}?checkr_error=not_authorized`,
			);
			expect(mockConnectCheckrAccount).not.toHaveBeenCalled();
		},
	);

	it('refuses an impersonated target whose membership is below ADMIN', async () => {
		mockGetServerSession.mockResolvedValueOnce(adminSession());
		mockResolveEffectiveUserId.mockResolvedValueOnce(impersonating(TARGET_ID));
		mockOrganizationMemberFindFirst.mockResolvedValueOnce({
			organizationId: TARGET_ORG_ID,
			role: 'STAFF',
		});

		await expect(
			GET(makeRequest({ code: 'abc', state: signed(TARGET_ORG_ID) })),
		).rejects.toThrow(
			`NEXT_REDIRECT:${BG_CHECKS_URL}?checkr_error=not_authorized`,
		);
		expect(mockConnectCheckrAccount).not.toHaveBeenCalled();
	});

	it('state-mismatch under impersonation: checks against the target user org, not the admin session org', async () => {
		mockGetServerSession.mockResolvedValueOnce(adminSession());
		mockResolveEffectiveUserId.mockResolvedValueOnce(impersonating(TARGET_ID));
		mockOrganizationMemberFindFirst.mockResolvedValueOnce({
			organizationId: TARGET_ORG_ID,
			role: 'ADMIN',
		});

		// state matches the admin's org, not the target's — must still fail,
		// since the fix resolves the target's org, not the real admin's.
		await expect(
			GET(makeRequest({ code: 'abc', state: signed(ADMIN_ORG_ID) })),
		).rejects.toThrow(
			`NEXT_REDIRECT:${BG_CHECKS_URL}?checkr_error=state_mismatch`,
		);
		expect(mockOrganizationMemberFindFirst).toHaveBeenCalledWith({
			where: { userId: TARGET_ID },
			select: { organizationId: true, role: true },
			orderBy: { createdAt: 'asc' },
		});
		expect(mockSessionFindFirst).not.toHaveBeenCalled();
	});

	it('redirects with token_exchange_failed when the token exchange throws', async () => {
		const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});
		mockGetServerSession.mockResolvedValueOnce(adminSession());
		mockResolveEffectiveUserId.mockResolvedValueOnce(
			notImpersonating(ADMIN_ID),
		);
		mockConnectCheckrAccount.mockRejectedValueOnce(new Error('checkr 500'));

		await expect(
			GET(makeRequest({ code: 'abc', state: signed(ADMIN_ORG_ID) })),
		).rejects.toThrow(
			`NEXT_REDIRECT:${BG_CHECKS_URL}?checkr_error=token_exchange_failed`,
		);
		consoleErr.mockRestore();
	});

	it('success path (not impersonating): connects the account and redirects with checkr_connected=true', async () => {
		mockGetServerSession.mockResolvedValueOnce(adminSession());
		mockResolveEffectiveUserId.mockResolvedValueOnce(
			notImpersonating(ADMIN_ID),
		);
		mockConnectCheckrAccount.mockResolvedValueOnce(undefined);

		await expect(
			GET(makeRequest({ code: 'abc', state: signed(ADMIN_ORG_ID) })),
		).rejects.toThrow(`NEXT_REDIRECT:${BG_CHECKS_URL}?checkr_connected=true`);
		expect(mockConnectCheckrAccount).toHaveBeenCalledWith(
			ADMIN_ORG_ID,
			'abc',
			ADMIN_ID,
			null,
		);
	});

	it('success path under impersonation: connects the target org using the target user id and tags impersonatedBy', async () => {
		mockGetServerSession.mockResolvedValueOnce(adminSession());
		mockResolveEffectiveUserId.mockResolvedValueOnce(impersonating(TARGET_ID));
		mockOrganizationMemberFindFirst.mockResolvedValueOnce({
			organizationId: TARGET_ORG_ID,
			role: 'ADMIN',
		});
		mockConnectCheckrAccount.mockResolvedValueOnce(undefined);

		await expect(
			GET(makeRequest({ code: 'abc', state: signed(TARGET_ORG_ID) })),
		).rejects.toThrow(`NEXT_REDIRECT:${BG_CHECKS_URL}?checkr_connected=true`);
		expect(mockConnectCheckrAccount).toHaveBeenCalledWith(
			TARGET_ORG_ID,
			'abc',
			TARGET_ID,
			ADMIN_ID,
		);
	});

	it('passes the parsed impersonation cookie value to resolveEffectiveUserId', async () => {
		mockGetServerSession.mockResolvedValueOnce(adminSession());
		mockResolveEffectiveUserId.mockResolvedValueOnce(
			notImpersonating(ADMIN_ID),
		);
		mockConnectCheckrAccount.mockResolvedValueOnce(undefined);

		await expect(
			GET(makeRequest({ code: 'abc', state: signed(ADMIN_ORG_ID) }, 'sess-1')),
		).rejects.toThrow(`NEXT_REDIRECT:${BG_CHECKS_URL}?checkr_connected=true`);

		expect(mockResolveEffectiveUserId).toHaveBeenCalledWith(ADMIN_ID, 'sess-1');
	});

	it('refuses when the session exposes no token of its own', async () => {
		mockGetServerSession.mockResolvedValueOnce({
			...adminSession(),
			sessionToken: null,
		});
		mockResolveEffectiveUserId.mockResolvedValueOnce(
			notImpersonating(ADMIN_ID),
		);

		await expect(
			GET(makeRequest({ code: 'abc', state: signed(ADMIN_ORG_ID) })),
		).rejects.toThrow(
			`NEXT_REDIRECT:${BG_CHECKS_URL}?checkr_error=state_mismatch`,
		);
		expect(mockConnectCheckrAccount).not.toHaveBeenCalled();
	});

	it('fails closed with an error redirect when the state cannot be verified', async () => {
		const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});
		mockGetServerSession.mockResolvedValueOnce(adminSession());
		mockResolveEffectiveUserId.mockResolvedValueOnce(
			notImpersonating(ADMIN_ID),
		);
		const state = signed(ADMIN_ORG_ID);
		vi.stubEnv('NEXTAUTH_SECRET', '');

		await expect(GET(makeRequest({ code: 'abc', state }))).rejects.toThrow(
			`NEXT_REDIRECT:${BG_CHECKS_URL}?checkr_error=state_mismatch`,
		);
		expect(mockConnectCheckrAccount).not.toHaveBeenCalled();
		consoleErr.mockRestore();
	});
});
