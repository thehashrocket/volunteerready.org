import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — hoisted before imports
// ---------------------------------------------------------------------------

const mockValidateToken = vi.fn();
const mockUpsert = vi.fn();

vi.mock('@/server/lib/digest-unsubscribe-token', () => ({
	validateUnsubscribeTokenFromEnv: (...args: unknown[]) =>
		mockValidateToken(...args),
}));

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		userMarketplacePreference: {
			upsert: (...args: unknown[]) => mockUpsert(...args),
		},
	},
}));

import { GET, POST } from './route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(
	method: string,
	params: Record<string, string> = {},
): Request {
	const url = new URL('http://localhost/api/unsubscribe/digest');
	for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
	return new Request(url.toString(), { method });
}

const VALID_PARAMS = { userId: 'user-1', token: 'tok-abc' };

// ---------------------------------------------------------------------------
// GET tests
// ---------------------------------------------------------------------------

describe('GET /api/unsubscribe/digest', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockValidateToken.mockReturnValue(true);
	});

	it('returns 400 when userId is missing', async () => {
		const res = await GET(makeRequest('GET', { token: 'tok' }));
		expect(res.status).toBe(400);
		const body = await res.text();
		expect(body).toContain('Invalid unsubscribe link');
	});

	it('returns 400 when token is missing', async () => {
		const res = await GET(makeRequest('GET', { userId: 'u1' }));
		expect(res.status).toBe(400);
	});

	it('returns 500 when token validation throws', async () => {
		mockValidateToken.mockImplementation(() => {
			throw new Error('env not set');
		});
		const res = await GET(makeRequest('GET', VALID_PARAMS));
		expect(res.status).toBe(500);
		const body = await res.text();
		expect(body).toContain('temporarily unavailable');
	});

	it('returns 400 when token is invalid', async () => {
		mockValidateToken.mockReturnValue(false);
		const res = await GET(makeRequest('GET', VALID_PARAMS));
		expect(res.status).toBe(400);
		const body = await res.text();
		expect(body).toContain('Invalid or expired');
	});

	it('returns 200 confirmation page with a form (does NOT mutate)', async () => {
		const res = await GET(makeRequest('GET', VALID_PARAMS));
		expect(res.status).toBe(200);
		const body = await res.text();
		expect(body).toContain('<form');
		expect(body).toContain('method="POST"');
		// GET must never call the upsert
		expect(mockUpsert).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// POST tests
// ---------------------------------------------------------------------------

describe('POST /api/unsubscribe/digest', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockValidateToken.mockReturnValue(true);
		mockUpsert.mockResolvedValue({});
	});

	it('returns 400 when params are missing', async () => {
		const res = await POST(makeRequest('POST', {}));
		expect(res.status).toBe(400);
	});

	it('returns 500 when token validation throws', async () => {
		mockValidateToken.mockImplementation(() => {
			throw new Error('secret missing');
		});
		const res = await POST(makeRequest('POST', VALID_PARAMS));
		expect(res.status).toBe(500);
	});

	it('returns 400 when token is invalid', async () => {
		mockValidateToken.mockReturnValue(false);
		const res = await POST(makeRequest('POST', VALID_PARAMS));
		expect(res.status).toBe(400);
	});

	it('upserts DigestFrequency.OFF and returns 200 on success', async () => {
		const res = await POST(makeRequest('POST', VALID_PARAMS));
		expect(res.status).toBe(200);
		expect(mockUpsert).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { userId: 'user-1' },
				create: expect.objectContaining({ digestFrequency: 'OFF' }),
				update: expect.objectContaining({ digestFrequency: 'OFF' }),
			}),
		);
		const body = await res.text();
		expect(body).toContain('Unsubscribed');
	});

	it('returns 200 (treats as already unsubscribed) when user is deleted (P2025)', async () => {
		const { Prisma } = await import('@/prisma/generated/client');
		const p2025 = new Prisma.PrismaClientKnownRequestError('not found', {
			code: 'P2025',
			clientVersion: '5',
		});
		mockUpsert.mockRejectedValue(p2025);

		const res = await POST(makeRequest('POST', VALID_PARAMS));
		expect(res.status).toBe(200);
	});

	it('returns 500 when upsert throws a non-P2025 error', async () => {
		const { Prisma } = await import('@/prisma/generated/client');
		const p2003 = new Prisma.PrismaClientKnownRequestError('foreign key', {
			code: 'P2003',
			clientVersion: '5',
		});
		mockUpsert.mockRejectedValue(p2003);

		const res = await POST(makeRequest('POST', VALID_PARAMS));
		expect(res.status).toBe(500);
	});
});
