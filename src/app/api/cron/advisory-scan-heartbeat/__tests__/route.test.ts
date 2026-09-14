import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		cronJobRun: { create: vi.fn(async () => ({})) },
	},
}));

vi.mock('@/server/lib/admin-alerts', () => ({
	sendAdvisoryDispatchFailureAlert: vi.fn(async () => undefined),
}));

import * as adminAlerts from '@/server/lib/admin-alerts';
import { GET } from '../route';

const WORKFLOW_URL =
	'https://api.github.com/repos/thehashrocket/volunteerready.org/actions/workflows/security-advisories-scheduled.yml';

function makeRequest(authHeader?: string) {
	const headers = new Headers();
	if (authHeader) headers.set('authorization', authHeader);
	return new Request('http://localhost/api/cron/advisory-scan-heartbeat', {
		headers,
	});
}

function stateResponse(state: string) {
	return new Response(JSON.stringify({ state }), { status: 200 });
}

describe('GET /api/cron/advisory-scan-heartbeat', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		process.env.CRON_SECRET = 'test-secret';
		process.env.GITHUB_ADVISORY_DISPATCH_TOKEN = 'test-github-token';
		vi.stubGlobal('fetch', vi.fn());
	});

	it('returns 401 when no auth header', async () => {
		const res = await GET(makeRequest());
		expect(res.status).toBe(401);
	});

	it('returns 500 and alerts when GITHUB_ADVISORY_DISPATCH_TOKEN is unset', async () => {
		delete process.env.GITHUB_ADVISORY_DISPATCH_TOKEN;
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		const res = await GET(makeRequest('Bearer test-secret'));

		expect(res.status).toBe(500);
		expect(fetch).not.toHaveBeenCalled();
		expect(adminAlerts.sendAdvisoryDispatchFailureAlert).toHaveBeenCalledTimes(
			1,
		);
		errorSpy.mockRestore();
	});

	describe('workflow already active (the normal case)', () => {
		beforeEach(() => {
			vi.mocked(fetch)
				.mockResolvedValueOnce(stateResponse('active')) // GET state
				.mockResolvedValueOnce(new Response(null, { status: 204 })); // POST dispatch
		});

		it('does NOT call the enable endpoint, and dispatches directly', async () => {
			const res = await GET(makeRequest('Bearer test-secret'));

			expect(res.status).toBe(200);
			const body = await res.json();
			expect(body).toEqual({
				ok: true,
				dispatchedWorkflow: 'security-advisories-scheduled.yml',
				wasReEnabled: false,
			});

			expect(fetch).toHaveBeenCalledTimes(2);
			const calls = vi.mocked(fetch).mock.calls;
			expect(calls[0]?.[0]).toBe(WORKFLOW_URL);
			expect(calls.some(([url]) => url === `${WORKFLOW_URL}/enable`)).toBe(
				false,
			);

			const [dispatchUrl, dispatchInit] = calls[1] as [string, RequestInit];
			expect(dispatchUrl).toBe(`${WORKFLOW_URL}/dispatches`);
			expect(dispatchInit.method).toBe('POST');
			expect(
				(dispatchInit.headers as Record<string, string>).Authorization,
			).toBe('Bearer test-github-token');
			expect(
				(dispatchInit.headers as Record<string, string>)['Content-Type'],
			).toBe('application/json');
			expect(JSON.parse(dispatchInit.body as string)).toEqual({ ref: 'main' });
			expect(
				adminAlerts.sendAdvisoryDispatchFailureAlert,
			).not.toHaveBeenCalled();
		});
	});

	describe('workflow disabled by inactivity (the case this route exists for)', () => {
		it('enables the workflow BEFORE dispatching, and reports wasReEnabled: true', async () => {
			vi.mocked(fetch)
				.mockResolvedValueOnce(stateResponse('disabled_inactivity')) // GET state
				.mockResolvedValueOnce(new Response(null, { status: 204 })) // PUT enable
				.mockResolvedValueOnce(new Response(null, { status: 204 })); // POST dispatch

			const res = await GET(makeRequest('Bearer test-secret'));

			expect(res.status).toBe(200);
			const body = await res.json();
			expect(body).toEqual({
				ok: true,
				dispatchedWorkflow: 'security-advisories-scheduled.yml',
				wasReEnabled: true,
			});

			expect(fetch).toHaveBeenCalledTimes(3);
			const calls = vi.mocked(fetch).mock.calls;
			const [enableUrl, enableInit] = calls[1] as [string, RequestInit];
			expect(enableUrl).toBe(`${WORKFLOW_URL}/enable`);
			expect(enableInit.method).toBe('PUT');

			const [dispatchUrl] = calls[2] as [string, RequestInit];
			expect(dispatchUrl).toBe(`${WORKFLOW_URL}/dispatches`);

			// Enable must happen BEFORE dispatch, not just both happen.
			expect(calls[1]?.[0]).toBe(`${WORKFLOW_URL}/enable`);
			expect(calls[2]?.[0]).toBe(`${WORKFLOW_URL}/dispatches`);
		});

		it('returns 500 and alerts if the enable call itself fails, without ever dispatching', async () => {
			vi.mocked(fetch)
				.mockResolvedValueOnce(stateResponse('disabled_inactivity'))
				.mockResolvedValueOnce(new Response('Forbidden', { status: 403 }));
			const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			const res = await GET(makeRequest('Bearer test-secret'));

			expect(res.status).toBe(500);
			expect(fetch).toHaveBeenCalledTimes(2);
			expect(
				adminAlerts.sendAdvisoryDispatchFailureAlert,
			).toHaveBeenCalledTimes(1);
			expect(
				vi.mocked(adminAlerts.sendAdvisoryDispatchFailureAlert).mock
					.calls[0]?.[0],
			).toContain('re-enabling');
			errorSpy.mockRestore();
		});
	});

	it('does NOT call enable for a MANUALLY disabled workflow — a human turned it off on purpose', async () => {
		// Dispatching against a still-disabled workflow will fail on GitHub's
		// side, and that failure is correctly alerted on by the generic
		// dispatch-call handling — but this route must never override a
		// deliberate human decision by calling enable itself.
		vi.mocked(fetch)
			.mockResolvedValueOnce(stateResponse('disabled_manually'))
			.mockResolvedValueOnce(
				new Response('Workflow is disabled', { status: 403 }),
			);
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		await GET(makeRequest('Bearer test-secret'));

		const calls = vi.mocked(fetch).mock.calls;
		expect(calls.some(([url]) => url === `${WORKFLOW_URL}/enable`)).toBe(false);
		errorSpy.mockRestore();
	});

	it('returns 500 and alerts when the workflow-state check returns non-2xx', async () => {
		vi.mocked(fetch).mockResolvedValueOnce(
			new Response('Not Found', { status: 404 }),
		);
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		const res = await GET(makeRequest('Bearer test-secret'));

		expect(res.status).toBe(500);
		expect(fetch).toHaveBeenCalledTimes(1);
		expect(adminAlerts.sendAdvisoryDispatchFailureAlert).toHaveBeenCalledTimes(
			1,
		);
		expect(
			vi.mocked(adminAlerts.sendAdvisoryDispatchFailureAlert).mock
				.calls[0]?.[0],
		).toContain('checking workflow state');
		errorSpy.mockRestore();
	});

	it('returns 500 and alerts on a non-2xx GitHub response from the dispatch call, rather than reading it as success', async () => {
		// The exact failure class documented in this repo's TODOS.md/CLAUDE.md
		// history: sendEmail returns false without throwing, and a caller that
		// only checks for a thrown rejection ships a hole. Same shape here —
		// `fetch` resolving is not the same as GitHub accepting the dispatch.
		vi.mocked(fetch)
			.mockResolvedValueOnce(stateResponse('active'))
			.mockResolvedValueOnce(new Response('Bad credentials', { status: 401 }));
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		const res = await GET(makeRequest('Bearer test-secret'));

		expect(res.status).toBe(500);
		expect(adminAlerts.sendAdvisoryDispatchFailureAlert).toHaveBeenCalledTimes(
			1,
		);
		expect(
			vi.mocked(adminAlerts.sendAdvisoryDispatchFailureAlert).mock
				.calls[0]?.[0],
		).toContain('401');
		errorSpy.mockRestore();
	});

	it('returns 500 and alerts when fetch itself rejects (network failure)', async () => {
		// This is the case AbortSignal.timeout()/try-catch exists for: a
		// rejected promise, not a resolved non-2xx response. Before that catch
		// existed, this shipped past a green suite asserting only res.status.
		vi.mocked(fetch).mockRejectedValueOnce(new Error('network unreachable'));
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		const res = await GET(makeRequest('Bearer test-secret'));

		expect(res.status).toBe(500);
		expect(adminAlerts.sendAdvisoryDispatchFailureAlert).toHaveBeenCalledTimes(
			1,
		);
		expect(
			vi.mocked(adminAlerts.sendAdvisoryDispatchFailureAlert).mock
				.calls[0]?.[0],
		).toContain('network unreachable');
		errorSpy.mockRestore();
	});

	it('passes an AbortSignal to every fetch call, so a stalled response cannot hang the function', async () => {
		vi.mocked(fetch)
			.mockResolvedValueOnce(stateResponse('active'))
			.mockResolvedValueOnce(new Response(null, { status: 204 }));

		await GET(makeRequest('Bearer test-secret'));

		for (const [, init] of vi.mocked(fetch).mock.calls) {
			expect((init as RequestInit | undefined)?.signal).toBeInstanceOf(
				AbortSignal,
			);
		}
	});
});
