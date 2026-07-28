import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
	mockGetServerSession,
	mockCookieGet,
	mockResolveEffectiveUserId,
	mockUserFindUnique,
	mockAcceptCompanyInvite,
	mockRedirect,
} = vi.hoisted(() => ({
	mockGetServerSession: vi.fn(),
	mockCookieGet: vi.fn(),
	mockResolveEffectiveUserId: vi.fn(),
	mockUserFindUnique: vi.fn(),
	mockAcceptCompanyInvite: vi.fn(),
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
	prisma: { user: { findUnique: mockUserFindUnique } },
}));

vi.mock('@/server/services/companyService', () => ({
	acceptCompanyInvite: mockAcceptCompanyInvite,
}));

import AcceptCompanyInvitePage from '../page';

const ADMIN_ID = 'admin-1';
const ADMIN_EMAIL = 'admin@example.com';
const TARGET_ID = 'target-1';
// No TARGET_EMAIL: this page no longer resolves an address at all. The service
// derives it from the user id, and `inviteAcceptIdentity.test.ts` covers that.
const TOKEN = 'raw-invite-token';

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

function renderPage() {
	return AcceptCompanyInvitePage({ params: Promise.resolve({ token: TOKEN }) });
}

beforeEach(() => {
	vi.clearAllMocks();
	mockCookieGet.mockReturnValue(undefined);
});

describe('AcceptCompanyInvitePage', () => {
	it('redirects unauthenticated visitors to login with a callback', async () => {
		mockGetServerSession.mockResolvedValueOnce(null);

		await expect(renderPage()).rejects.toThrow(
			`NEXT_REDIRECT:/login?callbackUrl=/invite/company/${TOKEN}`,
		);
		expect(mockAcceptCompanyInvite).not.toHaveBeenCalled();
	});

	it('redirects to /app/browse with the message when the invite email does not match (FORBIDDEN)', async () => {
		mockGetServerSession.mockResolvedValueOnce({
			user: { id: ADMIN_ID, email: ADMIN_EMAIL },
		});
		mockResolveEffectiveUserId.mockResolvedValueOnce(
			notImpersonating(ADMIN_ID),
		);
		mockUserFindUnique.mockResolvedValueOnce({ email: ADMIN_EMAIL });
		mockAcceptCompanyInvite.mockRejectedValueOnce(
			new TRPCError({
				code: 'FORBIDDEN',
				message: 'This invitation was sent to a different email address.',
			}),
		);

		await expect(renderPage()).rejects.toThrow(
			'NEXT_REDIRECT:/app/browse?error=',
		);
		expect(mockRedirect).toHaveBeenCalledWith(
			expect.stringContaining(
				encodeURIComponent(
					'This invitation was sent to a different email address.',
				),
			),
		);
	});

	it('already-member graceful path: succeeds without throwing and redirects to /app/company', async () => {
		mockGetServerSession.mockResolvedValueOnce({
			user: { id: ADMIN_ID, email: ADMIN_EMAIL },
		});
		mockResolveEffectiveUserId.mockResolvedValueOnce(
			notImpersonating(ADMIN_ID),
		);
		mockAcceptCompanyInvite.mockResolvedValueOnce({ ok: true });

		await expect(renderPage()).rejects.toThrow('NEXT_REDIRECT:/app/company');
		expect(mockAcceptCompanyInvite).toHaveBeenCalledWith({
			tokenHash: expect.any(String),
			userId: ADMIN_ID,
			impersonatedBy: null,
		});
	});

	it('impersonation: accepts as the TARGET user id, not the admin session id — fixing the prior always-FORBIDDEN bug', async () => {
		mockGetServerSession.mockResolvedValueOnce({
			user: { id: ADMIN_ID, email: ADMIN_EMAIL },
		});
		mockResolveEffectiveUserId.mockResolvedValueOnce(impersonating(TARGET_ID));
		mockAcceptCompanyInvite.mockResolvedValueOnce({ ok: true });

		await expect(renderPage()).rejects.toThrow('NEXT_REDIRECT:/app/company');
		expect(mockAcceptCompanyInvite).toHaveBeenCalledWith({
			tokenHash: expect.any(String),
			userId: TARGET_ID,
			impersonatedBy: ADMIN_ID,
		});
	});

	// The address is no longer resolved here — `acceptCompanyInvite` derives it
	// from the user id it is given, so every caller gets that behaviour instead of
	// only this page. This assertion is what stops the lookup being reintroduced
	// alongside the service's own, which is how the two identities drifted apart
	// in the tRPC procedure. The email half of the original bug is now pinned by
	// `companyService`'s own tests.
	it('SECURITY: never passes an email, so the id and address cannot describe different people', async () => {
		mockGetServerSession.mockResolvedValueOnce({
			user: { id: ADMIN_ID, email: ADMIN_EMAIL },
		});
		mockResolveEffectiveUserId.mockResolvedValueOnce(impersonating(TARGET_ID));
		mockAcceptCompanyInvite.mockResolvedValueOnce({ ok: true });

		await expect(renderPage()).rejects.toThrow('NEXT_REDIRECT:/app/company');
		expect(mockUserFindUnique).not.toHaveBeenCalled();
		expect(mockAcceptCompanyInvite).toHaveBeenCalledWith(
			expect.not.objectContaining({ userEmail: expect.anything() }),
		);
	});
});
