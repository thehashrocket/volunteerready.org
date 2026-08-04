import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@/prisma/generated/client';

// ---------------------------------------------------------------------------
// Mock the background check service — the route handler is a thin HTTP wrapper
// whose entire job is (a) reading the RAW body before anything consumes the
// stream and (b) mapping thrown errors onto the status codes Checkr's retry
// policy reads.
//
// The route imports its `instanceof` classes from the SERVICE, which merely
// re-exports them from the adapter. So the mock must hand back the REAL
// classes — a locally-redeclared stand-in would make every `instanceof` branch
// pass against a fake hierarchy and prove nothing about the route. The adapter
// imports only `node:crypto` and types, so importing it here is cheap.
// ---------------------------------------------------------------------------

const mockHandleCheckrWebhookEvent = vi.fn();

vi.mock('@/server/services/backgroundCheckService', async () => {
	const checkr = await vi.importActual<
		typeof import('@/server/lib/adapters/background-check/checkr')
	>('@/server/lib/adapters/background-check/checkr');
	return {
		CheckrWebhookError: checkr.CheckrWebhookError,
		CheckrSignatureError: checkr.CheckrSignatureError,
		CheckrBadPayloadError: checkr.CheckrBadPayloadError,
		CheckrRequeueError: checkr.CheckrRequeueError,
		handleCheckrWebhookEvent: (...args: unknown[]) =>
			mockHandleCheckrWebhookEvent(...args),
	};
});

// Mock next/headers — the route reads x-checkr-signature through it.
const mockHeadersGet = vi.fn();
vi.mock('next/headers', () => ({
	headers: vi.fn(async () => ({ get: mockHeadersGet })),
}));

import {
	CheckrBadPayloadError,
	CheckrRequeueError,
	CheckrSignatureError,
} from '@/server/lib/adapters/background-check/checkr';
import { POST } from '../route';

function post(body: BodyInit): Request {
	return new Request('http://localhost/api/checkr/webhook', {
		method: 'POST',
		body,
	});
}

describe('POST /api/checkr/webhook', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockHeadersGet.mockReturnValue('sha256=deadbeef');
	});

	// -------------------------------------------------------------------------
	// Raw-body integrity.
	//
	// This is the property the Next.js request-body advisories bear on
	// (GHSA-68g3-v927-f742 and GHSA-4633-3j49-mh5q, the latter specifically
	// about bodies carrying invalid UTF-8). Checkr's signature is an HMAC over
	// the bytes it sent; if anything between the wire and the adapter re-encodes
	// them, verification fails and every real webhook is rejected as forged.
	// Status-code tests cannot see that — they mock the verifier away.
	// -------------------------------------------------------------------------
	describe('raw body integrity', () => {
		it('hands the service the exact bytes received, without re-encoding', async () => {
			const payload = JSON.stringify({ type: 'report.completed', id: 'evt_1' });
			mockHandleCheckrWebhookEvent.mockResolvedValueOnce(undefined);

			await POST(post(payload));

			const [rawBody] = mockHandleCheckrWebhookEvent.mock.calls[0];
			expect(Buffer.isBuffer(rawBody)).toBe(true);
			expect((rawBody as Buffer).toString('utf8')).toBe(payload);
		});

		it('preserves invalid UTF-8 byte sequences byte-for-byte', async () => {
			// 0xFF and 0xFE are not legal UTF-8. A body decoded to a string and
			// re-encoded would come back as U+FFFD REPLACEMENT CHARACTER (0xEF
			// 0xBF 0xBD), silently changing the bytes the HMAC is computed over.
			const bytes = new Uint8Array([0x7b, 0x22, 0xff, 0xfe, 0x22, 0x7d]);
			mockHandleCheckrWebhookEvent.mockResolvedValueOnce(undefined);

			await POST(post(bytes));

			const [rawBody] = mockHandleCheckrWebhookEvent.mock.calls[0];
			expect(Uint8Array.from(rawBody as Buffer)).toEqual(bytes);
		});

		it('never calls .json() — that would consume the stream first', async () => {
			// Ordering, asserted directly rather than inferred. A body stream can
			// only be read once, so a .json() call anywhere ahead of
			// arrayBuffer() leaves the signature to be verified over nothing.
			const req = post(JSON.stringify({ id: 'evt_1' }));
			const jsonSpy = vi.spyOn(req, 'json');
			const arrayBufferSpy = vi.spyOn(req, 'arrayBuffer');
			mockHandleCheckrWebhookEvent.mockResolvedValueOnce(undefined);

			await POST(req);

			expect(jsonSpy).not.toHaveBeenCalled();
			expect(arrayBufferSpy).toHaveBeenCalledTimes(1);
		});
	});

	describe('signature header', () => {
		it('forwards the x-checkr-signature header to the service', async () => {
			mockHeadersGet.mockReturnValue('sha256=abc123');
			mockHandleCheckrWebhookEvent.mockResolvedValueOnce(undefined);

			await POST(post('{}'));

			expect(mockHeadersGet).toHaveBeenCalledWith('x-checkr-signature');
			expect(mockHandleCheckrWebhookEvent.mock.calls[0][1]).toBe(
				'sha256=abc123',
			);
		});

		it('passes an empty string when the header is absent', async () => {
			// Never `undefined` — the adapter compares against a computed HMAC and
			// must take the "does not match" path, not a type error.
			mockHeadersGet.mockReturnValue(null);
			mockHandleCheckrWebhookEvent.mockResolvedValueOnce(undefined);

			await POST(post('{}'));

			expect(mockHandleCheckrWebhookEvent.mock.calls[0][1]).toBe('');
		});
	});

	// -------------------------------------------------------------------------
	// Status routing. Each code is a different instruction to Checkr's retry
	// scheduler, so getting one wrong either drops a report on the floor or
	// retries a poisoned event for 72 hours.
	// -------------------------------------------------------------------------
	describe('status routing', () => {
		it('returns 200 { received: true } for a processed event', async () => {
			mockHandleCheckrWebhookEvent.mockResolvedValueOnce(undefined);

			const res = await POST(post('{}'));

			expect(res.status).toBe(200);
			expect(await res.json()).toEqual({ received: true });
		});

		it('returns 400 for a bad signature — Checkr does NOT retry 4xx', async () => {
			mockHandleCheckrWebhookEvent.mockRejectedValueOnce(
				new CheckrSignatureError(),
			);

			const res = await POST(post('{}'));

			expect(res.status).toBe(400);
			expect(await res.json()).toEqual({ error: 'Invalid request' });
		});

		it('returns 400 for an unparseable payload', async () => {
			// CheckrBadPayloadError extends CheckrWebhookError, so it shares the
			// 400 branch. Asserted separately because the subclass relationship is
			// what routes it, and that is exactly what a refactor can break.
			mockHandleCheckrWebhookEvent.mockRejectedValueOnce(
				new CheckrBadPayloadError(),
			);

			const res = await POST(post('not json'));

			expect(res.status).toBe(400);
			expect(await res.json()).toEqual({ error: 'Invalid request' });
		});

		it('returns 200 { duplicate: true } on P2002 — already processed', async () => {
			mockHandleCheckrWebhookEvent.mockRejectedValueOnce(
				new Prisma.PrismaClientKnownRequestError(
					'Unique constraint failed on the fields: (`checkrId`)',
					{ code: 'P2002', clientVersion: '7.0.0' },
				),
			);

			const res = await POST(post('{}'));

			expect(res.status).toBe(200);
			expect(await res.json()).toEqual({ received: true, duplicate: true });
		});

		it('returns 500 for an unknown reportId so Checkr retries for 72h', async () => {
			// CheckrRequeueError extends Error, NOT CheckrWebhookError — if it ever
			// gains that parent it would silently become a 400 and Checkr would
			// stop retrying a report that simply had not landed yet.
			vi.spyOn(console, 'warn').mockImplementation(() => {});
			mockHandleCheckrWebhookEvent.mockRejectedValueOnce(
				new CheckrRequeueError('unknown report rpt_1'),
			);

			const res = await POST(post('{}'));

			expect(res.status).toBe(500);
			expect(await res.json()).toEqual({ error: 'Requeue' });
		});

		it('returns 500 for an unexpected error so Checkr retries', async () => {
			vi.spyOn(console, 'error').mockImplementation(() => {});
			mockHandleCheckrWebhookEvent.mockRejectedValueOnce(
				new Error('DB connection pool exhausted'),
			);

			const res = await POST(post('{}'));

			expect(res.status).toBe(500);
			expect(await res.json()).toEqual({ error: 'Internal error' });
		});

		it('does not leak the internal error message to the caller', async () => {
			// Route Handlers never reach tRPC's errorFormatter, so this redaction
			// is the route's own responsibility.
			vi.spyOn(console, 'error').mockImplementation(() => {});
			mockHandleCheckrWebhookEvent.mockRejectedValueOnce(
				new Error('connect ECONNREFUSED 10.0.0.4:5432'),
			);

			const res = await POST(post('{}'));

			expect(JSON.stringify(await res.json())).not.toContain('ECONNREFUSED');
		});
	});
});
