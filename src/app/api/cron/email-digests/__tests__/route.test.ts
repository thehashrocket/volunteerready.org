import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		cronJobRun: { create: vi.fn(async () => ({})) },
	},
}));

vi.mock('@/server/services/digest-service', () => ({
	sendDigestEmails: vi.fn(async () => ({
		digestsSent: 0,
		notificationsIncluded: 0,
		nextCursor: null,
	})),
}));

import * as digestService from '@/server/services/digest-service';
import { GET } from '../route';

function makeRequest(authHeader?: string) {
	const headers = new Headers();
	if (authHeader) headers.set('authorization', authHeader);
	return new Request('http://localhost/api/cron/email-digests', {
		headers,
	});
}

describe('GET /api/cron/email-digests', () => {
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
		vi.mocked(digestService.sendDigestEmails).mockResolvedValueOnce({
			digestsSent: 5,
			notificationsIncluded: 23,
			nextCursor: 'abc123',
		});

		const res = await GET(makeRequest('Bearer test-secret'));
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body).toEqual({
			ok: true,
			digestsSent: 5,
			notificationsIncluded: 23,
			nextCursor: 'abc123',
		});
	});

	it('returns 500 when service throws', async () => {
		vi.mocked(digestService.sendDigestEmails).mockRejectedValueOnce(
			new Error('DB down'),
		);

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
