import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------

const mockCreate = vi.fn();
const mockFindFirst = vi.fn();
const mockUpsert = vi.fn();
const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		emailEvent: {
			create: (...args: unknown[]) => mockCreate(...args),
			findFirst: (...args: unknown[]) => mockFindFirst(...args),
		},
		emailBounceStatus: {
			upsert: (...args: unknown[]) => mockUpsert(...args),
			findUnique: (...args: unknown[]) => mockFindUnique(...args),
			update: (...args: unknown[]) => mockUpdate(...args),
		},
	},
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { POST } from '@/app/api/resend/webhook/route';

function makeRequest(body: unknown, signature = ''): Request {
	const raw = JSON.stringify(body);
	return new Request('http://localhost/api/resend/webhook', {
		method: 'POST',
		body: raw,
		headers: { 'svix-signature': signature },
	});
}

describe('Resend webhook handler', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockCreate.mockResolvedValue({});
		mockFindFirst.mockResolvedValue(null); // No duplicate by default
		mockUpsert.mockResolvedValue({});
		mockFindUnique.mockResolvedValue(null);
		mockUpdate.mockResolvedValue({});
		// Ensure no RESEND_WEBHOOK_SECRET set (skip verification in tests)
		delete process.env.RESEND_WEBHOOK_SECRET;
	});

	it('logs DELIVERED event and returns 200', async () => {
		const res = await POST(
			makeRequest({
				type: 'email.delivered',
				data: {
					email_id: 'msg-1',
					to: ['User@Example.com'],
					subject: 'Hello',
				},
			}),
		);

		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json).toEqual({ received: true });

		expect(mockCreate).toHaveBeenCalledWith({
			data: expect.objectContaining({
				resendId: 'msg-1',
				to: 'user@example.com', // lowercased
				subject: 'Hello',
				eventType: 'DELIVERED',
			}),
		});
	});

	it('skips unknown event types with 200', async () => {
		const res = await POST(
			makeRequest({
				type: 'email.opened',
				data: { email_id: 'msg-2', to: ['a@b.com'] },
			}),
		);

		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json).toEqual({ received: true, skipped: true });
		expect(mockCreate).not.toHaveBeenCalled();
	});

	it('returns 400 for invalid JSON', async () => {
		const req = new Request('http://localhost/api/resend/webhook', {
			method: 'POST',
			body: 'not json{{{',
		});

		const res = await POST(req);
		expect(res.status).toBe(400);
	});

	it('upserts bounce status on BOUNCED event', async () => {
		mockFindUnique.mockResolvedValueOnce({
			bounceCount: 1,
			suppressedAt: null,
		});

		await POST(
			makeRequest({
				type: 'email.bounced',
				data: { email_id: 'msg-3', to: ['bounce@test.com'], subject: 'Test' },
			}),
		);

		expect(mockUpsert).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { email: 'bounce@test.com' },
				create: expect.objectContaining({
					email: 'bounce@test.com',
					bounceCount: 1,
				}),
				update: expect.objectContaining({ bounceCount: { increment: 1 } }),
			}),
		);
	});

	it('suppresses address when bounce count reaches cap', async () => {
		mockFindUnique.mockResolvedValueOnce({
			bounceCount: 3,
			suppressedAt: null,
		});

		const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

		await POST(
			makeRequest({
				type: 'email.bounced',
				data: { email_id: 'msg-4', to: ['bad@test.com'], subject: 'Test' },
			}),
		);

		expect(mockUpdate).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { email: 'bad@test.com' },
				data: { suppressedAt: expect.any(Date) },
			}),
		);
		expect(consoleWarn).toHaveBeenCalledWith(
			'[resend-webhook] Address suppressed after bounce cap:',
			'bad@test.com',
		);

		consoleWarn.mockRestore();
	});

	it('does not re-suppress already-suppressed address', async () => {
		mockFindUnique.mockResolvedValueOnce({
			bounceCount: 5,
			suppressedAt: new Date('2026-01-01'),
		});

		await POST(
			makeRequest({
				type: 'email.bounced',
				data: { email_id: 'msg-5', to: ['already@test.com'], subject: 'Test' },
			}),
		);

		// Should not call update since suppressedAt is already set
		expect(mockUpdate).not.toHaveBeenCalled();
	});

	it('handles COMPLAINED events same as BOUNCED', async () => {
		mockFindUnique.mockResolvedValueOnce({
			bounceCount: 1,
			suppressedAt: null,
		});

		await POST(
			makeRequest({
				type: 'email.complained',
				data: { email_id: 'msg-6', to: ['spam@test.com'], subject: 'Test' },
			}),
		);

		expect(mockUpsert).toHaveBeenCalled();
		expect(mockCreate).toHaveBeenCalledWith({
			data: expect.objectContaining({ eventType: 'COMPLAINED' }),
		});
	});

	it('returns 500 on DB error so Resend retries', async () => {
		const consoleError = vi
			.spyOn(console, 'error')
			.mockImplementation(() => {});
		mockCreate.mockRejectedValueOnce(new Error('DB connection failed'));

		const res = await POST(
			makeRequest({
				type: 'email.sent',
				data: { email_id: 'msg-7', to: ['user@test.com'], subject: 'Test' },
			}),
		);

		expect(res.status).toBe(500);
		consoleError.mockRestore();
	});
});
