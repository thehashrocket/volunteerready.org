import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the background check service. Unlike the Checkr route, this one imports
// its `instanceof` classes straight from the adapter rather than through the
// service, so only the handler needs stubbing.
// ---------------------------------------------------------------------------

const mockHandleSterlingWebhookEvent = vi.fn();

vi.mock('@/server/services/backgroundCheckService', () => ({
	handleSterlingWebhookEvent: (...args: unknown[]) =>
		mockHandleSterlingWebhookEvent(...args),
}));

// Mock next/headers — the route reads x-sterling-signature through it.
const mockHeadersGet = vi.fn();
vi.mock('next/headers', () => ({
	headers: vi.fn(async () => ({ get: mockHeadersGet })),
}));

import {
	SterlingSignatureError,
	SterlingWebhookError,
} from '@/server/lib/adapters/background-check/sterling';
import { POST } from '../route';

function post(body: BodyInit): Request {
	return new Request('http://localhost/api/sterling/webhook', {
		method: 'POST',
		body,
	});
}

describe('POST /api/sterling/webhook', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockHeadersGet.mockReturnValue('sha256=deadbeef');
	});

	// -------------------------------------------------------------------------
	// Raw-body integrity — see the Checkr route test for why this is the
	// property the Next.js request-body advisories bear on. Sterling verifies
	// with HMAC-SHA256 over the raw bytes and a constant-time compare, so a
	// re-encoded body fails verification on every legitimate delivery.
	// -------------------------------------------------------------------------
	describe('raw body integrity', () => {
		it('hands the service the exact bytes received, without re-encoding', async () => {
			const payload = JSON.stringify({ event: 'screening.completed' });
			mockHandleSterlingWebhookEvent.mockResolvedValueOnce(undefined);

			await POST(post(payload));

			const [rawBody] = mockHandleSterlingWebhookEvent.mock.calls[0];
			expect(Buffer.isBuffer(rawBody)).toBe(true);
			expect((rawBody as Buffer).toString('utf8')).toBe(payload);
		});

		it('preserves invalid UTF-8 byte sequences byte-for-byte', async () => {
			const bytes = new Uint8Array([0x7b, 0x22, 0xff, 0xfe, 0x22, 0x7d]);
			mockHandleSterlingWebhookEvent.mockResolvedValueOnce(undefined);

			await POST(post(bytes));

			const [rawBody] = mockHandleSterlingWebhookEvent.mock.calls[0];
			expect(Uint8Array.from(rawBody as Buffer)).toEqual(bytes);
		});
	});

	describe('signature header', () => {
		it('forwards the x-sterling-signature header to the service', async () => {
			mockHeadersGet.mockReturnValue('sha256=abc123');
			mockHandleSterlingWebhookEvent.mockResolvedValueOnce(undefined);

			await POST(post('{}'));

			expect(mockHeadersGet).toHaveBeenCalledWith('x-sterling-signature');
			expect(mockHandleSterlingWebhookEvent.mock.calls[0][1]).toBe(
				'sha256=abc123',
			);
		});

		it('passes an empty string when the header is absent', async () => {
			mockHeadersGet.mockReturnValue(null);
			mockHandleSterlingWebhookEvent.mockResolvedValueOnce(undefined);

			await POST(post('{}'));

			expect(mockHandleSterlingWebhookEvent.mock.calls[0][1]).toBe('');
		});
	});

	describe('status routing', () => {
		it('returns 200 { received: true } for a processed event', async () => {
			mockHandleSterlingWebhookEvent.mockResolvedValueOnce(undefined);

			const res = await POST(post('{}'));

			expect(res.status).toBe(200);
			expect(await res.json()).toEqual({ received: true });
		});

		it('returns 400 for a bad signature — Sterling does NOT retry 4xx', async () => {
			mockHandleSterlingWebhookEvent.mockRejectedValueOnce(
				new SterlingSignatureError(),
			);

			const res = await POST(post('{}'));

			expect(res.status).toBe(400);
			expect(await res.json()).toEqual({ error: 'Invalid request' });
		});

		it('returns 400 for an unparseable payload', async () => {
			mockHandleSterlingWebhookEvent.mockRejectedValueOnce(
				new SterlingWebhookError('Invalid Sterling webhook payload'),
			);

			const res = await POST(post('not json'));

			expect(res.status).toBe(400);
			expect(await res.json()).toEqual({ error: 'Invalid request' });
		});

		it('returns 500 for an unexpected error so Sterling retries', async () => {
			// Sterling has no dedicated requeue branch — an unknown screeningId
			// falls through to this 500, which is what makes Sterling retry.
			vi.spyOn(console, 'error').mockImplementation(() => {});
			mockHandleSterlingWebhookEvent.mockRejectedValueOnce(
				new Error('DB connection pool exhausted'),
			);

			const res = await POST(post('{}'));

			expect(res.status).toBe(500);
			expect(await res.json()).toEqual({ error: 'Internal error' });
		});

		it('does not leak the internal error message to the caller', async () => {
			vi.spyOn(console, 'error').mockImplementation(() => {});
			mockHandleSterlingWebhookEvent.mockRejectedValueOnce(
				new Error('connect ECONNREFUSED 10.0.0.4:5432'),
			);

			const res = await POST(post('{}'));

			expect(JSON.stringify(await res.json())).not.toContain('ECONNREFUSED');
		});
	});
});
