import crypto from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	SterlingApiError,
	SterlingAuthError,
	SterlingRateLimitError,
	SterlingSignatureError,
	SterlingTimeoutError,
	SterlingValidationError,
	SterlingWebhookError,
	sterlingAdapter,
} from '../sterling';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_ACCESS_TOKEN = 'sk_test_sterling_key_123';

const validPii = {
	firstName: 'Jane',
	lastName: 'Doe',
	email: 'jane@example.com',
	dob: '1990-01-15',
	ssn: '123456789',
};

function mockFetchResponse(
	status: number,
	body: unknown,
	headers?: Record<string, string>,
): Response {
	return {
		ok: status >= 200 && status < 300,
		status,
		headers: new Headers(headers),
		json: () => Promise.resolve(body),
	} as Response;
}

// ---------------------------------------------------------------------------
// initiateCheck
// ---------------------------------------------------------------------------

describe('SterlingAdapter.initiateCheck', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('returns reportId on successful screening creation', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
			mockFetchResponse(201, { id: 'scr_abc123' }),
		);

		const result = await sterlingAdapter.initiateCheck(
			validPii,
			'standard_criminal',
			MOCK_ACCESS_TOKEN,
		);

		expect(result).toEqual({ reportId: 'scr_abc123' });

		const call = vi.mocked(fetch).mock.calls[0];
		expect(call[0]).toBe('https://api.sterlingcheck.app/v2/screenings');
		const opts = call[1] as RequestInit;
		expect(opts.method).toBe('POST');
		expect(opts.headers).toMatchObject({
			Authorization: `Bearer ${MOCK_ACCESS_TOKEN}`,
			'Content-Type': 'application/json',
		});

		const body = JSON.parse(opts.body as string);
		expect(body.packageId).toBe('standard_criminal');
		expect(body.candidate.firstName).toBe('Jane');
		expect(body.candidate.ssn).toBe('123456789');
	});

	it('throws SterlingAuthError on 401', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
			mockFetchResponse(401, { error: 'Unauthorized' }),
		);

		await expect(
			sterlingAdapter.initiateCheck(validPii, 'pkg', MOCK_ACCESS_TOKEN),
		).rejects.toThrow(SterlingAuthError);
	});

	it('throws SterlingAuthError on 403', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
			mockFetchResponse(403, { error: 'Forbidden' }),
		);

		await expect(
			sterlingAdapter.initiateCheck(validPii, 'pkg', MOCK_ACCESS_TOKEN),
		).rejects.toThrow(SterlingAuthError);
	});

	it('throws SterlingValidationError on 422', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
			mockFetchResponse(422, { error: 'Invalid SSN' }),
		);

		await expect(
			sterlingAdapter.initiateCheck(validPii, 'pkg', MOCK_ACCESS_TOKEN),
		).rejects.toThrow(SterlingValidationError);
	});

	it('throws SterlingRateLimitError on 429 with retry-after header', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
			mockFetchResponse(429, { error: 'Rate limited' }, { 'retry-after': '5' }),
		);

		try {
			await sterlingAdapter.initiateCheck(validPii, 'pkg', MOCK_ACCESS_TOKEN);
			expect.unreachable('Should have thrown');
		} catch (err) {
			expect(err).toBeInstanceOf(SterlingRateLimitError);
			expect((err as SterlingRateLimitError).retryAfterMs).toBe(5000);
		}
	});

	it('throws SterlingApiError on other non-OK status', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
			mockFetchResponse(503, { error: 'Service unavailable' }),
		);

		try {
			await sterlingAdapter.initiateCheck(validPii, 'pkg', MOCK_ACCESS_TOKEN);
			expect.unreachable('Should have thrown');
		} catch (err) {
			expect(err).toBeInstanceOf(SterlingApiError);
			expect((err as SterlingApiError).status).toBe(503);
		}
	});

	it('throws SterlingApiError when response has no id', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
			mockFetchResponse(200, { status: 'created' }),
		);

		await expect(
			sterlingAdapter.initiateCheck(validPii, 'pkg', MOCK_ACCESS_TOKEN),
		).rejects.toThrow(SterlingApiError);
	});

	it('throws SterlingTimeoutError on abort', async () => {
		vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() => {
			const err = new Error('The operation was aborted');
			err.name = 'AbortError';
			return Promise.reject(err);
		});

		await expect(
			sterlingAdapter.initiateCheck(validPii, 'pkg', MOCK_ACCESS_TOKEN),
		).rejects.toThrow(SterlingTimeoutError);
	});
});

// ---------------------------------------------------------------------------
// verifyWebhookSignature
// ---------------------------------------------------------------------------

describe('SterlingAdapter.verifyWebhookSignature', () => {
	const SECRET = 'whsec_test_secret_123';

	beforeEach(() => {
		vi.restoreAllMocks();
		process.env.STERLING_WEBHOOK_SECRET = SECRET;
	});

	afterEach(() => {
		delete process.env.STERLING_WEBHOOK_SECRET;
	});

	function sign(body: Buffer): string {
		return crypto.createHmac('sha256', SECRET).update(body).digest('hex');
	}

	it('passes with valid signature', () => {
		const body = Buffer.from('{"type":"screening.completed"}');
		const sig = sign(body);

		expect(() => sterlingAdapter.verifyWebhookSignature(body, sig)).not.toThrow();
	});

	it('throws SterlingSignatureError on invalid signature', () => {
		const body = Buffer.from('{"type":"screening.completed"}');

		expect(() =>
			sterlingAdapter.verifyWebhookSignature(body, 'bad_signature'),
		).toThrow(SterlingSignatureError);
	});

	it('throws SterlingSignatureError on empty signature', () => {
		const body = Buffer.from('{"type":"screening.completed"}');

		expect(() => sterlingAdapter.verifyWebhookSignature(body, '')).toThrow(
			SterlingSignatureError,
		);
	});

	it('throws SterlingSignatureError when STERLING_WEBHOOK_SECRET is not set', () => {
		delete process.env.STERLING_WEBHOOK_SECRET;
		const body = Buffer.from('test');

		expect(() => sterlingAdapter.verifyWebhookSignature(body, 'sig')).toThrow(
			SterlingSignatureError,
		);
	});

	it('rejects signatures with different lengths (constant-time safe)', () => {
		const body = Buffer.from('test');
		// Short signature — must fail the length check, not timingSafeEqual
		expect(() => sterlingAdapter.verifyWebhookSignature(body, 'ab')).toThrow(
			SterlingSignatureError,
		);
	});
});

// ---------------------------------------------------------------------------
// parseActionableWebhookPayload
// ---------------------------------------------------------------------------

describe('SterlingAdapter.parseActionableWebhookPayload', () => {
	it('returns reportId and result for screening.completed', () => {
		const result = sterlingAdapter.parseActionableWebhookPayload({
			type: 'screening.completed',
			data: { id: 'scr_123', result: 'clear' },
		});

		expect(result).toEqual({ reportId: 'scr_123', result: 'clear' });
	});

	it('returns null for non-completed events', () => {
		expect(
			sterlingAdapter.parseActionableWebhookPayload({
				type: 'screening.created',
				data: { id: 'scr_123' },
			}),
		).toBeNull();
	});

	it('returns null for unknown event types', () => {
		expect(
			sterlingAdapter.parseActionableWebhookPayload({
				type: 'account.updated',
				data: {},
			}),
		).toBeNull();
	});

	it('throws SterlingWebhookError when payload is not an object', () => {
		expect(() =>
			sterlingAdapter.parseActionableWebhookPayload('not an object'),
		).toThrow(SterlingWebhookError);
	});

	it('throws SterlingWebhookError when payload is null', () => {
		expect(() =>
			sterlingAdapter.parseActionableWebhookPayload(null),
		).toThrow(SterlingWebhookError);
	});

	it('throws SterlingWebhookError when screening.completed has no data.id', () => {
		expect(() =>
			sterlingAdapter.parseActionableWebhookPayload({
				type: 'screening.completed',
				data: { result: 'clear' },
			}),
		).toThrow(SterlingWebhookError);
	});

	it('throws SterlingWebhookError when screening.completed has no data.result', () => {
		expect(() =>
			sterlingAdapter.parseActionableWebhookPayload({
				type: 'screening.completed',
				data: { id: 'scr_123' },
			}),
		).toThrow(SterlingWebhookError);
	});
});

// ---------------------------------------------------------------------------
// OAuth stubs (Sterling uses API keys, not OAuth)
// ---------------------------------------------------------------------------

describe('SterlingAdapter OAuth stubs', () => {
	it('exchangeOAuthCode throws SterlingApiError with 501', async () => {
		try {
			await sterlingAdapter.exchangeOAuthCode('some_code');
			expect.unreachable('Should have thrown');
		} catch (err) {
			expect(err).toBeInstanceOf(SterlingApiError);
			expect((err as SterlingApiError).status).toBe(501);
		}
	});

	it('getOAuthUrl throws SterlingApiError with 501', () => {
		try {
			sterlingAdapter.getOAuthUrl('some_state');
			expect.unreachable('Should have thrown');
		} catch (err) {
			expect(err).toBeInstanceOf(SterlingApiError);
			expect((err as SterlingApiError).status).toBe(501);
		}
	});
});
