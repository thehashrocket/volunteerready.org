import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/services/credential-expiry-service', () => ({
	expireStaleCredentialsAndTokens: vi.fn(async () => ({
		credentialsExpired: 0,
		tokensExpired: 0,
	})),
	purgeOldDismissedNotifications: vi.fn(async () => ({
		notificationsPurged: 0,
	})),
}));

import * as expiryService from '@/server/services/credential-expiry-service';
import { GET } from '../route';

function makeRequest(authHeader?: string) {
	const headers = new Headers();
	if (authHeader) headers.set('authorization', authHeader);
	return new Request('http://localhost/api/cron/expire-credentials', {
		headers,
	});
}

describe('GET /api/cron/expire-credentials', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		process.env.CRON_SECRET = 'test-secret';
	});

	it('returns 401 when no auth header', async () => {
		const res = await GET(makeRequest());
		expect(res.status).toBe(401);
	});

	it('returns 401 when auth header is wrong', async () => {
		const res = await GET(makeRequest('Bearer wrong-secret'));
		expect(res.status).toBe(401);
	});

	it('returns 200 with counts on valid auth', async () => {
		vi.mocked(
			expiryService.expireStaleCredentialsAndTokens,
		).mockResolvedValueOnce({
			credentialsExpired: 3,
			tokensExpired: 1,
		});
		vi.mocked(
			expiryService.purgeOldDismissedNotifications,
		).mockResolvedValueOnce({
			notificationsPurged: 5,
		});

		const res = await GET(makeRequest('Bearer test-secret'));
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body).toEqual({
			ok: true,
			credentialsExpired: 3,
			tokensExpired: 1,
			notificationsPurged: 5,
		});
	});

	it('returns 500 when service throws', async () => {
		vi.mocked(
			expiryService.expireStaleCredentialsAndTokens,
		).mockRejectedValueOnce(new Error('DB down'));

		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const res = await GET(makeRequest('Bearer test-secret'));

		expect(res.status).toBe(500);
		errorSpy.mockRestore();
	});

	it('returns 401 when CRON_SECRET is not set', async () => {
		process.env.CRON_SECRET = '';
		const res = await GET(makeRequest('Bearer anything'));
		expect(res.status).toBe(401);
	});
});
