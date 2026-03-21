import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		cronJobRun: { create: vi.fn(async () => ({})) },
	},
}));

import { prisma } from '@/server/repositories/prisma';
import { withCronAuth } from './cron-auth';

function makeRequest(authHeader?: string) {
	const headers = new Headers();
	if (authHeader) headers.set('authorization', authHeader);
	return new Request('http://localhost/api/cron/test-job', { headers });
}

describe('withCronAuth', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		process.env.CRON_SECRET = 'test-secret';
	});

	it('returns 401 when no auth header', async () => {
		const handler = vi.fn();
		const wrapped = withCronAuth('test-job', handler);
		const res = await wrapped(makeRequest());

		expect(res.status).toBe(401);
		expect(handler).not.toHaveBeenCalled();
	});

	it('returns 401 when auth header is wrong', async () => {
		const handler = vi.fn();
		const wrapped = withCronAuth('test-job', handler);
		const res = await wrapped(makeRequest('Bearer wrong'));

		expect(res.status).toBe(401);
		expect(handler).not.toHaveBeenCalled();
	});

	it('returns 401 when CRON_SECRET is empty', async () => {
		process.env.CRON_SECRET = '';
		const handler = vi.fn();
		const wrapped = withCronAuth('test-job', handler);
		const res = await wrapped(makeRequest('Bearer anything'));

		expect(res.status).toBe(401);
	});

	it('calls handler and records SUCCESS on valid auth', async () => {
		const handler = vi.fn(async () => ({
			ok: true as const,
			processed: 5,
		}));
		const wrapped = withCronAuth('test-job', handler);
		const res = await wrapped(makeRequest('Bearer test-secret'));

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toEqual({ ok: true, processed: 5 });

		expect(handler).toHaveBeenCalledOnce();
		expect(prisma.cronJobRun.create).toHaveBeenCalledWith({
			data: expect.objectContaining({
				jobName: 'test-job',
				status: 'SUCCESS',
				durationMs: expect.any(Number),
				resultSummary: { ok: true, processed: 5 },
			}),
		});
	});

	it('records FAILURE and returns 500 when handler throws', async () => {
		const handler = vi.fn(async () => {
			throw new Error('Something broke');
		});
		const wrapped = withCronAuth('test-job', handler);

		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const res = await wrapped(makeRequest('Bearer test-secret'));

		expect(res.status).toBe(500);
		const body = await res.json();
		expect(body).toEqual({ error: 'Internal server error' });

		expect(prisma.cronJobRun.create).toHaveBeenCalledWith({
			data: expect.objectContaining({
				jobName: 'test-job',
				status: 'FAILURE',
				error: 'Something broke',
			}),
		});
		errorSpy.mockRestore();
	});

	it('still returns 500 if recording the failure itself fails', async () => {
		const handler = vi.fn(async () => {
			throw new Error('Handler error');
		});
		vi.mocked(prisma.cronJobRun.create).mockRejectedValueOnce(
			new Error('DB write failed'),
		);

		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const wrapped = withCronAuth('test-job', handler);
		const res = await wrapped(makeRequest('Bearer test-secret'));

		expect(res.status).toBe(500);
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining('Failed to record CronJobRun'),
			expect.any(Error),
		);
		errorSpy.mockRestore();
	});

	it('records durationMs as a non-negative number', async () => {
		const handler = vi.fn(async () => ({ ok: true as const }));
		const wrapped = withCronAuth('test-job', handler);
		await wrapped(makeRequest('Bearer test-secret'));

		const createCall = vi.mocked(prisma.cronJobRun.create).mock.calls[0][0];
		expect(createCall.data.durationMs).toBeGreaterThanOrEqual(0);
	});
});
