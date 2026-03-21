import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock module dependencies
// ---------------------------------------------------------------------------

const mockSend = vi.fn();
const mockFindUnique = vi.fn();
const mockCreate = vi.fn();

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
		emailEvent: {
			create: (...args: unknown[]) => mockCreate(...args).catch(() => {}),
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
		mockFindUnique.mockResolvedValue(null); // No bounce status by default
		mockCreate.mockResolvedValue({}); // Event logging succeeds
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
