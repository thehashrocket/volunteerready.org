import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies before importing the module under test
// ---------------------------------------------------------------------------

const mockSendEmail = vi.fn();
const mockGetAdminEmails = vi.fn();

vi.mock('@/server/lib/email', () => ({
	sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

vi.mock('@/server/lib/html', () => ({
	escapeHtml: (s: string) => s,
}));

vi.mock('@/server/lib/admin-recipients', () => ({
	getAdminEmails: (...args: unknown[]) => mockGetAdminEmails(...args),
	_resetAdminEmailsCacheForTests: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports — after vi.mock()
// ---------------------------------------------------------------------------

import {
	_resetAdminEmailsCacheForTests,
	sendAdvisoryDispatchFailureAlert,
	sendImpersonationStartAlert,
	sendNewCompanyAlert,
	sendNewOrgAlert,
	sendNewUserAlert,
} from '@/server/lib/admin-alerts';

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

beforeEach(() => {
	vi.restoreAllMocks();
	mockSendEmail.mockReset();
	mockGetAdminEmails.mockReset();
	mockSendEmail.mockResolvedValue(true);
});

afterEach(() => {
	_resetAdminEmailsCacheForTests();
	delete process.env.NEXTAUTH_URL;
});

// ---------------------------------------------------------------------------
// sendNewUserAlert
// ---------------------------------------------------------------------------

describe('sendNewUserAlert', () => {
	it('sends to all admin recipients', async () => {
		mockGetAdminEmails.mockResolvedValue([
			'admin@example.com',
			'ops@example.com',
		]);

		await sendNewUserAlert({
			id: 'u1',
			email: 'jane@example.com',
			name: 'Jane',
		});

		expect(mockSendEmail).toHaveBeenCalledTimes(2);
		expect(mockSendEmail.mock.calls[0][0]).toBe('admin@example.com');
		expect(mockSendEmail.mock.calls[1][0]).toBe('ops@example.com');
	});

	it('subject contains user email', async () => {
		mockGetAdminEmails.mockResolvedValue(['admin@example.com']);

		await sendNewUserAlert({
			id: 'u1',
			email: 'jane@example.com',
			name: 'Jane',
		});

		expect(mockSendEmail.mock.calls[0][1]).toContain('jane@example.com');
	});

	it('html contains deep link when NEXTAUTH_URL is set', async () => {
		process.env.NEXTAUTH_URL = 'https://app.example.com';
		mockGetAdminEmails.mockResolvedValue(['admin@example.com']);

		await sendNewUserAlert({ id: 'u1', email: 'jane@example.com', name: null });

		const html = mockSendEmail.mock.calls[0][2] as string;
		expect(html).toContain('/app/admin/platform/users/u1');
	});

	it('does not send when no recipients', async () => {
		mockGetAdminEmails.mockResolvedValue([]);

		await sendNewUserAlert({ id: 'u1', email: 'jane@example.com', name: null });

		expect(mockSendEmail).not.toHaveBeenCalled();
	});

	it('does not throw when getAdminEmails rejects', async () => {
		mockGetAdminEmails.mockRejectedValue(new Error('DB down'));

		await expect(
			sendNewUserAlert({ id: 'u1', email: null, name: null }),
		).resolves.toBeUndefined();
		expect(mockSendEmail).not.toHaveBeenCalled();
	});

	it('logs loudly when sendEmail returns false, via the shared sendAdminAlert fix', async () => {
		// Pins that the boolean-check fix applied to the shared helper (for
		// sendAdvisoryDispatchFailureAlert) applies uniformly to every caller
		// that goes through it, not just the one it was written for — caught
		// as a gap by red-team review.
		mockGetAdminEmails.mockResolvedValue(['admin@example.com']);
		mockSendEmail.mockResolvedValue(false);
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		await sendNewUserAlert({
			id: 'u1',
			email: 'jane@example.com',
			name: 'Jane',
		});

		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining('admin@example.com'),
		);
		errorSpy.mockRestore();
	});
});

// ---------------------------------------------------------------------------
// sendNewOrgAlert
// ---------------------------------------------------------------------------

describe('sendNewOrgAlert', () => {
	it('sends to all admin recipients', async () => {
		mockGetAdminEmails.mockResolvedValue(['admin@example.com']);

		await sendNewOrgAlert({
			id: 'org-1',
			name: 'Helping Hands',
			slug: 'helping-hands',
		});

		expect(mockSendEmail).toHaveBeenCalledTimes(1);
	});

	it('subject contains org name', async () => {
		mockGetAdminEmails.mockResolvedValue(['admin@example.com']);

		await sendNewOrgAlert({
			id: 'org-1',
			name: 'Helping Hands',
			slug: 'helping-hands',
		});

		expect(mockSendEmail.mock.calls[0][1]).toContain('Helping Hands');
	});

	it('html contains deep link when NEXTAUTH_URL is set', async () => {
		process.env.NEXTAUTH_URL = 'https://app.example.com';
		mockGetAdminEmails.mockResolvedValue(['admin@example.com']);

		await sendNewOrgAlert({
			id: 'org-1',
			name: 'Helping Hands',
			slug: 'helping-hands',
		});

		const html = mockSendEmail.mock.calls[0][2] as string;
		expect(html).toContain('/app/admin/platform/orgs/org-1');
	});

	it('does not send when no recipients', async () => {
		mockGetAdminEmails.mockResolvedValue([]);

		await sendNewOrgAlert({
			id: 'org-1',
			name: 'Helping Hands',
			slug: 'helping-hands',
		});

		expect(mockSendEmail).not.toHaveBeenCalled();
	});

	it('does not throw when getAdminEmails rejects', async () => {
		mockGetAdminEmails.mockRejectedValue(new Error('DB down'));

		await expect(
			sendNewOrgAlert({
				id: 'org-1',
				name: 'Helping Hands',
				slug: 'helping-hands',
			}),
		).resolves.toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// sendNewCompanyAlert
// ---------------------------------------------------------------------------

describe('sendNewCompanyAlert', () => {
	it('sends to all admin recipients', async () => {
		mockGetAdminEmails.mockResolvedValue(['admin@example.com']);

		await sendNewCompanyAlert({
			id: 'co-1',
			name: 'Acme Corp',
			slug: 'acme-corp',
		});

		expect(mockSendEmail).toHaveBeenCalledTimes(1);
	});

	it('subject contains company name', async () => {
		mockGetAdminEmails.mockResolvedValue(['admin@example.com']);

		await sendNewCompanyAlert({
			id: 'co-1',
			name: 'Acme Corp',
			slug: 'acme-corp',
		});

		expect(mockSendEmail.mock.calls[0][1]).toContain('Acme Corp');
	});

	it('sends to multiple recipients', async () => {
		mockGetAdminEmails.mockResolvedValue([
			'admin@example.com',
			'ops@example.com',
		]);

		await sendNewCompanyAlert({
			id: 'co-1',
			name: 'Acme Corp',
			slug: 'acme-corp',
		});

		expect(mockSendEmail).toHaveBeenCalledTimes(2);
	});

	it('html contains deep link when NEXTAUTH_URL is set', async () => {
		process.env.NEXTAUTH_URL = 'https://app.example.com';
		mockGetAdminEmails.mockResolvedValue(['admin@example.com']);

		await sendNewCompanyAlert({
			id: 'co-1',
			name: 'Acme Corp',
			slug: 'acme-corp',
		});

		const html = mockSendEmail.mock.calls[0][2] as string;
		expect(html).toContain('/app/admin/platform');
	});

	it('does not send when no recipients', async () => {
		mockGetAdminEmails.mockResolvedValue([]);

		await sendNewCompanyAlert({
			id: 'co-1',
			name: 'Acme Corp',
			slug: 'acme-corp',
		});

		expect(mockSendEmail).not.toHaveBeenCalled();
	});

	it('does not throw when getAdminEmails rejects', async () => {
		mockGetAdminEmails.mockRejectedValue(new Error('DB down'));

		await expect(
			sendNewCompanyAlert({ id: 'co-1', name: 'Acme Corp', slug: 'acme-corp' }),
		).resolves.toBeUndefined();
		expect(mockSendEmail).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// sendImpersonationStartAlert
// ---------------------------------------------------------------------------

describe('sendImpersonationStartAlert', () => {
	const baseInput = {
		adminEmail: 'admin@example.com',
		adminUserId: 'admin-1',
		targetEmail: 'target@example.com',
		targetUserId: 'target-1',
		reason: 'Support request',
		expiresAt: new Date('2026-01-01T12:00:00Z'),
		sessionId: 'sess-123',
	};

	it('sends to recipients excluding the acting admin', async () => {
		mockGetAdminEmails.mockResolvedValue([
			'admin@example.com',
			'ops@example.com',
		]);

		await sendImpersonationStartAlert(baseInput);

		expect(mockSendEmail).toHaveBeenCalledTimes(1);
		expect(mockSendEmail.mock.calls[0][0]).toBe('ops@example.com');
	});

	it('sends with isCritical: true', async () => {
		mockGetAdminEmails.mockResolvedValue(['ops@example.com']);

		await sendImpersonationStartAlert({ ...baseInput, adminEmail: null });

		expect(mockSendEmail.mock.calls[0][3]).toEqual({ isCritical: true });
	});

	it('does not send when acting admin is the only recipient', async () => {
		mockGetAdminEmails.mockResolvedValue(['admin@example.com']);

		await sendImpersonationStartAlert(baseInput);

		expect(mockSendEmail).not.toHaveBeenCalled();
	});

	it('does not throw when getAdminEmails rejects', async () => {
		mockGetAdminEmails.mockRejectedValue(new Error('DB down'));

		await expect(
			sendImpersonationStartAlert(baseInput),
		).resolves.toBeUndefined();
		expect(mockSendEmail).not.toHaveBeenCalled();
	});

	it('subject contains admin email', async () => {
		mockGetAdminEmails.mockResolvedValue(['ops@example.com']);

		await sendImpersonationStartAlert(baseInput);

		expect(mockSendEmail.mock.calls[0][1]).toContain('admin@example.com');
	});

	it('logs loudly when sendEmail returns false, rather than swallowing it', async () => {
		// This alert used to call sendEmail directly instead of going through
		// the shared sendAdminAlert/sendToRecipients helper, so it did NOT
		// inherit the boolean-check fix applied there — caught by red-team
		// review as a regression risk on the most security-sensitive alert in
		// this file (the only detection mechanism for unauthorized
		// impersonation). Now routed through sendToRecipients like every other
		// alert here.
		mockGetAdminEmails.mockResolvedValue(['ops@example.com']);
		mockSendEmail.mockResolvedValue(false);
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		await sendImpersonationStartAlert(baseInput);

		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining('ops@example.com'),
		);
		errorSpy.mockRestore();
	});
});

// ---------------------------------------------------------------------------
// sendAdvisoryDispatchFailureAlert
// ---------------------------------------------------------------------------

describe('sendAdvisoryDispatchFailureAlert', () => {
	// The route (`src/app/api/cron/advisory-scan-heartbeat/route.ts`) mocks
	// this whole module, so its own tests never exercise this function's real
	// body — only that the route CALLS it. These are the direct tests of what
	// it actually does: goes through the shared `sendAdminAlert` helper (so it
	// inherits the empty-recipients and getAdminEmails-rejects behavior), and
	// — the one property worth pinning on its own — forwards `isCritical: true`
	// through to `sendEmail`, the same way `sendImpersonationStartAlert` does,
	// since this is a security-relevant notice and not a bounce-suppression
	// candidate (see the function's own docstring).

	it('sends to all admin recipients', async () => {
		mockGetAdminEmails.mockResolvedValue([
			'admin@example.com',
			'ops@example.com',
		]);

		await sendAdvisoryDispatchFailureAlert('GitHub API returned 401');

		expect(mockSendEmail).toHaveBeenCalledTimes(2);
	});

	it('subject names the failing cron', async () => {
		mockGetAdminEmails.mockResolvedValue(['admin@example.com']);

		await sendAdvisoryDispatchFailureAlert('GitHub API returned 401');

		expect(mockSendEmail.mock.calls[0][1]).toContain('advisory-scan-heartbeat');
	});

	it('html contains the details verbatim', async () => {
		mockGetAdminEmails.mockResolvedValue(['admin@example.com']);

		await sendAdvisoryDispatchFailureAlert('GitHub API returned 401: nope');

		const html = mockSendEmail.mock.calls[0][2] as string;
		expect(html).toContain('GitHub API returned 401: nope');
	});

	it('sends with isCritical: true', async () => {
		mockGetAdminEmails.mockResolvedValue(['admin@example.com']);

		await sendAdvisoryDispatchFailureAlert('token missing');

		expect(mockSendEmail.mock.calls[0][3]).toEqual({ isCritical: true });
	});

	it('does not send when no recipients', async () => {
		mockGetAdminEmails.mockResolvedValue([]);

		await sendAdvisoryDispatchFailureAlert('token missing');

		expect(mockSendEmail).not.toHaveBeenCalled();
	});

	it('does not throw when getAdminEmails rejects', async () => {
		mockGetAdminEmails.mockRejectedValue(new Error('DB down'));

		await expect(
			sendAdvisoryDispatchFailureAlert('token missing'),
		).resolves.toBeUndefined();
		expect(mockSendEmail).not.toHaveBeenCalled();
	});

	it('logs loudly when sendEmail returns false, rather than swallowing it', async () => {
		// sendEmail() never throws — it returns `false` on a Resend error or a
		// bounce-suppressed address. This is the alert meant to warn that the
		// advisory-scan heartbeat itself is broken; if a failed send here goes
		// unnoticed, the escalation path silently fails the same way the thing
		// it's warning about did.
		mockGetAdminEmails.mockResolvedValue(['admin@example.com']);
		mockSendEmail.mockResolvedValue(false);
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		await sendAdvisoryDispatchFailureAlert('GitHub API returned 401');

		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining('admin@example.com'),
		);
		errorSpy.mockRestore();
	});
});
