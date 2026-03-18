import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock module dependencies
// ---------------------------------------------------------------------------

const mockSend = vi.fn();

vi.mock('@/server/lib/resend', () => ({
	getResend: () => ({ emails: { send: mockSend } }),
	getFromEmail: () => 'noreply@volunteerready.org',
}));

vi.mock('@/server/lib/email-template', () => ({
	buildEmailHtml: (content: string) => `<html>${content}</html>`,
}));

// ---------------------------------------------------------------------------
// Imports — must come AFTER vi.mock() calls
// ---------------------------------------------------------------------------

import { sendEmail } from '@/server/lib/email';

describe('sendEmail', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('sends email via Resend and returns true on success', async () => {
		mockSend.mockResolvedValueOnce({ id: 'msg-123' });

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
});
