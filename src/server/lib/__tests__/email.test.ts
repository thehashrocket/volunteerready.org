import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock module dependencies
// ---------------------------------------------------------------------------

const mockSend = vi.fn();
const mockFindUnique = vi.fn();
const mockCreate = vi.fn();
const mockUserFindUnique = vi.fn();

vi.mock('@/server/lib/resend', () => ({
	getResend: () => ({ emails: { send: mockSend } }),
	getFromEmail: () => 'noreply@volunteerready.org',
}));

vi.mock('@/server/lib/email-template', () => ({
	buildEmailHtml: (content: string) => `<html>${content}</html>`,
}));

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		emailBounceStatus: {
			findUnique: (...args: unknown[]) => mockFindUnique(...args),
		},
		user: {
			findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
		},
		emailEvent: {
			// NOT `.catch(() => {})`. That wrapper used to swallow every rejection
			// before it reached the code under test, which made the "still
			// suppresses when the audit write fails" case below assert nothing —
			// it passed identically with `recordUnclaimedSuppression`'s try/catch
			// deleted. Both production call sites handle rejection themselves.
			create: (...args: unknown[]) => mockCreate(...args),
		},
	},
}));

// ---------------------------------------------------------------------------
// Imports — must come AFTER vi.mock() calls
// ---------------------------------------------------------------------------

import { sendEmail } from '@/server/lib/email';

describe('sendEmail', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		mockSend.mockReset();
		mockFindUnique.mockReset();
		mockCreate.mockReset();
		mockUserFindUnique.mockReset();
		mockFindUnique.mockResolvedValue(null); // No bounce status by default
		mockUserFindUnique.mockResolvedValue({ accountState: 'ACTIVE' });
		mockCreate.mockResolvedValue({}); // Event logging succeeds
		delete process.env.UNCLAIMED_EMAIL_GUARD_ENABLED;
	});

	it('sends email via Resend and returns true on success', async () => {
		mockSend.mockResolvedValueOnce({ data: { id: 'msg-123' } });

		const result = await sendEmail(
			'user@example.com',
			'Welcome',
			'<p>Hello</p>',
		);

		expect(result).toBe(true);
		expect(mockSend).toHaveBeenCalledWith({
			from: 'noreply@volunteerready.org',
			to: 'user@example.com',
			subject: 'Welcome',
			html: '<html><p>Hello</p></html>',
		});
	});

	it('returns false and logs error on failure', async () => {
		const consoleError = vi
			.spyOn(console, 'error')
			.mockImplementation(() => {});
		mockSend.mockRejectedValueOnce(new Error('Network error'));

		const result = await sendEmail(
			'user@example.com',
			'Welcome',
			'<p>Hello</p>',
		);

		expect(result).toBe(false);
		expect(consoleError).toHaveBeenCalledWith(
			'[sendEmail] Failed to send email:',
			expect.objectContaining({ to: 'user@example.com', subject: 'Welcome' }),
		);

		consoleError.mockRestore();
	});

	it('skips delivery for suppressed addresses', async () => {
		const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		mockFindUnique.mockResolvedValueOnce({
			suppressedAt: new Date(),
			bounceCount: 3,
		});

		const result = await sendEmail(
			'bounced@example.com',
			'Subject',
			'<p>Body</p>',
		);

		expect(result).toBe(false);
		expect(mockSend).not.toHaveBeenCalled();
		expect(consoleWarn).toHaveBeenCalledWith(
			'[sendEmail] Skipping suppressed address:',
			expect.objectContaining({ to: 'bounced@example.com' }),
		);

		consoleWarn.mockRestore();
	});

	it('sends critical emails even to suppressed addresses', async () => {
		mockFindUnique.mockResolvedValueOnce({
			suppressedAt: new Date(),
			bounceCount: 5,
		});
		mockSend.mockResolvedValueOnce({ data: { id: 'msg-456' } });

		const result = await sendEmail(
			'bounced@example.com',
			'FCRA Notice',
			'<p>Important</p>',
			{ isCritical: true },
		);

		expect(result).toBe(true);
		expect(mockSend).toHaveBeenCalled();
		// Should NOT check bounce status for critical emails
		expect(mockFindUnique).not.toHaveBeenCalled();
	});

	it('logs SENT event after successful delivery', async () => {
		mockSend.mockResolvedValueOnce({ data: { id: 'msg-789' } });

		await sendEmail('user@example.com', 'Test', '<p>Hi</p>');

		// Event logging is fire-and-forget — flush microtask queue
		await new Promise((r) => setTimeout(r, 0));

		expect(mockCreate).toHaveBeenCalledWith({
			data: expect.objectContaining({
				resendId: 'msg-789',
				to: 'user@example.com',
				subject: 'Test',
				eventType: 'SENT',
			}),
		});
	});

	it('does not suppress addresses below bounce cap', async () => {
		mockFindUnique.mockResolvedValueOnce({
			suppressedAt: null,
			bounceCount: 2,
		});
		mockSend.mockResolvedValueOnce({ data: { id: 'msg-000' } });

		const result = await sendEmail('user@example.com', 'Test', '<p>Hi</p>');

		expect(result).toBe(true);
		expect(mockSend).toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// T4 — unclaimed suppression guard
// ---------------------------------------------------------------------------

describe('sendEmail — unclaimed guard', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		mockSend.mockReset();
		mockFindUnique.mockReset();
		mockCreate.mockReset();
		mockUserFindUnique.mockReset();
		mockFindUnique.mockResolvedValue(null);
		mockCreate.mockResolvedValue({});
		mockSend.mockResolvedValue({ data: { id: 'msg-guard' } });
		delete process.env.UNCLAIMED_EMAIL_GUARD_ENABLED;
	});

	it('SECURITY: suppresses an UNCLAIMED recipient when the sender opts in', async () => {
		const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		mockUserFindUnique.mockResolvedValueOnce({ accountState: 'UNCLAIMED' });

		const result = await sendEmail(
			'shadow@example.com',
			'Your shift is tomorrow',
			'<p>Body</p>',
			{ suppressUnclaimed: true },
		);

		expect(result).toBe(false);
		expect(mockSend).not.toHaveBeenCalled();

		consoleWarn.mockRestore();
	});

	it('SECURITY: is opt-in — an UNCLAIMED recipient still receives mail from a sender that does not opt in', async () => {
		mockUserFindUnique.mockResolvedValue({ accountState: 'UNCLAIMED' });

		const result = await sendEmail(
			'shadow@example.com',
			'You were added to a roster',
			'<p>Body</p>',
		);

		expect(result).toBe(true);
		expect(mockSend).toHaveBeenCalled();
		// The lookup must not even run — the guard costs nothing for the
		// transactional senders that never opt in.
		expect(mockUserFindUnique).not.toHaveBeenCalled();
	});

	it('sends to an ACTIVE recipient even when the sender opts in', async () => {
		mockUserFindUnique.mockResolvedValueOnce({ accountState: 'ACTIVE' });

		const result = await sendEmail('real@example.com', 'Digest', '<p>Hi</p>', {
			suppressUnclaimed: true,
		});

		expect(result).toBe(true);
		expect(mockSend).toHaveBeenCalled();
	});

	it('fails open when the address has no User row', async () => {
		mockUserFindUnique.mockResolvedValueOnce(null);

		const result = await sendEmail(
			'nobody@example.com',
			'Digest',
			'<p>Hi</p>',
			{ suppressUnclaimed: true },
		);

		expect(result).toBe(true);
		expect(mockSend).toHaveBeenCalled();
	});

	it('SECURITY: looks the recipient up by the canonical form, trimmed as well as lowercased', async () => {
		// The T1 trigger stores lower(btrim(email)). A bare .toLowerCase() here
		// would miss the row for a padded address and the guard would fail OPEN.
		mockUserFindUnique.mockResolvedValueOnce({ accountState: 'UNCLAIMED' });
		const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

		await sendEmail('  Shadow@Example.COM  ', 'Digest', '<p>Hi</p>', {
			suppressUnclaimed: true,
		});

		expect(mockUserFindUnique).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { email: 'shadow@example.com' },
			}),
		);

		consoleWarn.mockRestore();
	});

	it('writes a SUPPRESSED_UNCLAIMED EmailEvent so the non-delivery is answerable later', async () => {
		const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		mockUserFindUnique.mockResolvedValueOnce({ accountState: 'UNCLAIMED' });

		await sendEmail(
			'Shadow@Example.com',
			'Your shift is tomorrow',
			'<p>x</p>',
			{
				suppressUnclaimed: true,
			},
		);

		expect(mockCreate).toHaveBeenCalledWith({
			data: {
				resendId: null,
				to: 'shadow@example.com',
				subject: 'Your shift is tomorrow',
				eventType: 'SUPPRESSED_UNCLAIMED',
			},
		});

		consoleWarn.mockRestore();
	});

	it('isCritical bypasses the unclaimed guard as well as the bounce guard', async () => {
		mockUserFindUnique.mockResolvedValue({ accountState: 'UNCLAIMED' });

		const result = await sendEmail(
			'shadow@example.com',
			'FCRA Notice',
			'<p>Important</p>',
			{ isCritical: true, suppressUnclaimed: true },
		);

		expect(result).toBe(true);
		expect(mockSend).toHaveBeenCalled();
		expect(mockUserFindUnique).not.toHaveBeenCalled();
		expect(mockFindUnique).not.toHaveBeenCalled();
	});

	it('UNCLAIMED_EMAIL_GUARD_ENABLED=false disables the guard entirely', async () => {
		process.env.UNCLAIMED_EMAIL_GUARD_ENABLED = 'false';
		mockUserFindUnique.mockResolvedValue({ accountState: 'UNCLAIMED' });

		const result = await sendEmail('shadow@example.com', 'D', '<p>x</p>', {
			suppressUnclaimed: true,
		});

		expect(result).toBe(true);
		expect(mockSend).toHaveBeenCalled();
		expect(mockUserFindUnique).not.toHaveBeenCalled();
	});

	it('any value other than the exact string "false" leaves the guard on', async () => {
		// A typo'd kill switch must fail toward the privacy control, not away.
		const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		for (const value of ['0', 'no', 'off', '', 'FALSE']) {
			process.env.UNCLAIMED_EMAIL_GUARD_ENABLED = value;
			mockSend.mockClear();
			mockUserFindUnique.mockResolvedValueOnce({ accountState: 'UNCLAIMED' });

			const result = await sendEmail('shadow@example.com', 'D', '<p>x</p>', {
				suppressUnclaimed: true,
			});

			expect(result, `value=${JSON.stringify(value)}`).toBe(false);
			expect(mockSend).not.toHaveBeenCalled();
		}
		consoleWarn.mockRestore();
	});

	it('runs the bounce and unclaimed lookups concurrently, not in series', async () => {
		// Sequential lookups would double the per-recipient latency of every
		// cron send. Assert both are in flight before either resolves.
		let bounceStarted = false;
		let userStartedWhileBouncePending = false;

		mockFindUnique.mockImplementationOnce(async () => {
			bounceStarted = true;
			await new Promise((r) => setTimeout(r, 5));
			return null;
		});
		mockUserFindUnique.mockImplementationOnce(async () => {
			userStartedWhileBouncePending = bounceStarted;
			return { accountState: 'ACTIVE' };
		});

		await sendEmail('user@example.com', 'D', '<p>x</p>', {
			suppressUnclaimed: true,
		});

		expect(userStartedWhileBouncePending).toBe(true);
	});

	it('still suppresses, as a decision not a crash, when the SUPPRESSED_UNCLAIMED write fails', async () => {
		const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const consoleError = vi
			.spyOn(console, 'error')
			.mockImplementation(() => {});
		mockUserFindUnique.mockResolvedValueOnce({ accountState: 'UNCLAIMED' });
		mockCreate.mockRejectedValueOnce(new Error('db down'));

		const result = await sendEmail('shadow@example.com', 'D', '<p>x</p>', {
			suppressUnclaimed: true,
		});

		// Sending mail we decided to withhold because the audit write failed
		// would be the wrong recovery.
		expect(result).toBe(false);
		expect(mockSend).not.toHaveBeenCalled();

		// Asserting on WHICH log fired is what makes this test mean anything.
		// `false` alone proves nothing: if the rejection escaped
		// `recordUnclaimedSuppression`, sendEmail's outer catch would swallow it
		// and return `false` too. Only the log distinguishes "suppressed, and the
		// bookkeeping happened to fail" from "the whole send blew up" — and the
		// difference matters, because the second would mean an unrelated future
		// throw in the suppression path silently reads as a normal suppression.
		expect(consoleError).toHaveBeenCalledWith(
			'[sendEmail] Failed to log SUPPRESSED_UNCLAIMED event:',
			expect.any(Error),
		);
		expect(consoleError).not.toHaveBeenCalledWith(
			'[sendEmail] Failed to send email:',
			expect.anything(),
		);

		consoleWarn.mockRestore();
		consoleError.mockRestore();
	});

	it('a bounce-suppressed UNCLAIMED address returns on the bounce branch and does not double-log', async () => {
		const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		mockFindUnique.mockResolvedValueOnce({
			suppressedAt: new Date(),
			bounceCount: 3,
		});
		mockUserFindUnique.mockResolvedValueOnce({ accountState: 'UNCLAIMED' });

		const result = await sendEmail('shadow@example.com', 'D', '<p>x</p>', {
			suppressUnclaimed: true,
		});

		expect(result).toBe(false);
		expect(mockSend).not.toHaveBeenCalled();
		expect(mockCreate).not.toHaveBeenCalled();

		consoleWarn.mockRestore();
	});
});
