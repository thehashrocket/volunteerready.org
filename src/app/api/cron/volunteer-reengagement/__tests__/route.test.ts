import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		cronJobRun: { create: vi.fn(async () => ({})) },
	},
}));

vi.mock('@/server/services/reengagement-service', () => ({
	sendReengagementEmails: vi.fn(async () => ({
		membersProcessed: 0,
		emailsSent: 0,
		nextCursor: null,
	})),
}));

import * as reengagementService from '@/server/services/reengagement-service';
import { GET } from '../route';

function makeRequest(authHeader?: string) {
	const headers = new Headers();
	if (authHeader) headers.set('authorization', authHeader);
	return new Request('http://localhost/api/cron/volunteer-reengagement', {
		headers,
	});
}

describe('GET /api/cron/volunteer-reengagement', () => {
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
		vi.mocked(reengagementService.sendReengagementEmails).mockResolvedValueOnce(
			{
				membersProcessed: 15,
				emailsSent: 10,
				nextCursor: 'cursor-xyz',
			},
		);

		const res = await GET(makeRequest('Bearer test-secret'));
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body).toEqual({
			ok: true,
			membersProcessed: 15,
			emailsSent: 10,
			nextCursor: 'cursor-xyz',
		});
	});

	it('returns 500 when service throws', async () => {
		vi.mocked(reengagementService.sendReengagementEmails).mockRejectedValueOnce(
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
