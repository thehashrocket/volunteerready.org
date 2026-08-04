import crypto from 'node:crypto';
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

	// -------------------------------------------------------------------------
	// Raw-body integrity, verified against a REAL signature.
	//
	// Added alongside the Next.js 16.2.12 bump, three of whose advisories
	// concern request-body handling — GHSA-4633-3j49-mh5q specifically about
	// bodies carrying invalid UTF-8. Every test above this block sets no
	// RESEND_WEBHOOK_SECRET, so verification is skipped and none of them can see
	// a body corruption at all.
	//
	// This route is the one place the HMAC is computed in-process rather than
	// inside a mocked service, so the assertion can be end-to-end: sign real
	// bytes, post those bytes, and require the route to accept them. That makes
	// it strictly stronger than the equivalent Checkr/Sterling tests, which can
	// only prove the handoff.
	// -------------------------------------------------------------------------
	describe('raw body integrity (real HMAC)', () => {
		const SECRET = 'whsec_test_secret';

		function sign(raw: Buffer): string {
			return crypto.createHmac('sha256', SECRET).update(raw).digest('hex');
		}

		function postRaw(raw: Buffer, signature: string): Request {
			return new Request('http://localhost/api/resend/webhook', {
				method: 'POST',
				body: raw,
				headers: { 'svix-signature': signature },
			});
		}

		beforeEach(() => {
			process.env.RESEND_WEBHOOK_SECRET = SECRET;
		});

		it('accepts a correctly signed body', async () => {
			const raw = Buffer.from(
				JSON.stringify({
					type: 'email.delivered',
					data: { email_id: 'msg-sig', to: ['a@b.com'], subject: 'S' },
				}),
			);

			const res = await POST(postRaw(raw, sign(raw)));

			expect(res.status).toBe(200);
		});

		it('rejects a body whose bytes changed after signing', async () => {
			// The control for the test above: proves acceptance is actually
			// signature-dependent and not just "200 because nothing threw".
			const raw = Buffer.from(JSON.stringify({ type: 'email.delivered' }));
			const tampered = Buffer.from(JSON.stringify({ type: 'email.bounced' }));

			const res = await POST(postRaw(tampered, sign(raw)));

			expect(res.status).toBe(400);
			expect(await res.json()).toEqual({ error: 'Invalid signature' });
		});

		it('verifies a body containing invalid UTF-8 without corrupting it', async () => {
			// The load-bearing case. 0xFF/0xFE are not legal UTF-8; a route that
			// reads .text() and re-encodes turns them into U+FFFD, so the HMAC no
			// longer matches the bytes Resend signed and EVERY legitimate delivery
			// is rejected as forged. Signed over the true bytes, so this passes
			// only if the route never round-trips the body through a string.
			const raw = Buffer.concat([
				Buffer.from('{"type":"email.delivered","data":{"subject":"'),
				Buffer.from([0xff, 0xfe]),
				Buffer.from('","email_id":"msg-utf8","to":["a@b.com"]}}'),
			]);

			const res = await POST(postRaw(raw, sign(raw)));

			// 200 proves signature verification saw the original bytes. (The JSON
			// parse that follows tolerates the invalid sequence via lossy decode —
			// that is downstream of the signature and not what is under test.)
			expect(res.status).toBe(200);
		});

		it('rejects when the signature header is absent', async () => {
			const raw = Buffer.from(JSON.stringify({ type: 'email.delivered' }));

			const res = await POST(postRaw(raw, ''));

			expect(res.status).toBe(400);
		});
	});
});
