import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		cronJobRun: { create: vi.fn(async () => ({})) },
	},
}));

vi.mock('@/server/lib/admin-alerts', () => ({
	sendAdvisoryDispatchFailureAlert: vi.fn(async () => undefined),
	sendAdvisoryScanResultAlert: vi.fn(async () => undefined),
}));

import * as adminAlerts from '@/server/lib/admin-alerts';
import { prisma } from '@/server/repositories/prisma';
import { GET } from '../route';

const WORKFLOW_URL =
	'https://api.github.com/repos/thehashrocket/volunteerready.org/actions/workflows/security-advisories-scheduled.yml';
const RUNS_URL = `${WORKFLOW_URL}/runs?branch=main&status=completed&per_page=1`;
const DISPATCH_URL = `${WORKFLOW_URL}/dispatches`;
const ENABLE_URL = `${WORKFLOW_URL}/enable`;
const RUN_URL =
	'https://github.com/thehashrocket/volunteerready.org/actions/runs/42';

function makeRequest(authHeader?: string) {
	const headers = new Headers();
	if (authHeader) headers.set('authorization', authHeader);
	return new Request('http://localhost/api/cron/advisory-scan-heartbeat', {
		headers,
	});
}

const authed = () => GET(makeRequest('Bearer test-secret'));

function stateResponse(state: string) {
	return new Response(JSON.stringify({ state }), { status: 200 });
}

/** The latest completed run, finished just now unless told otherwise. */
function runsResponse(
	conclusion: string | null,
	updatedAt = new Date().toISOString(),
) {
	return new Response(
		JSON.stringify({
			workflow_runs: [{ conclusion, html_url: RUN_URL, updated_at: updatedAt }],
		}),
		{ status: 200 },
	);
}

const noRunsResponse = () =>
	new Response(JSON.stringify({ workflow_runs: [] }), { status: 200 });
const dispatched = () => new Response(null, { status: 204 });
const fiveDaysAgo = () =>
	new Date(Date.now() - 5 * 24 * 3_600_000).toISOString();

/** Queues one fetch response per call, in order. */
function mockFetchSequence(...responses: Response[]) {
	for (const res of responses) vi.mocked(fetch).mockResolvedValueOnce(res);
}

const fetchUrls = () => vi.mocked(fetch).mock.calls.map(([url]) => url);
const firstArg = (fn: (...args: never[]) => unknown) =>
	vi.mocked(fn).mock.calls[0]?.[0];

describe('GET /api/cron/advisory-scan-heartbeat', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		process.env.CRON_SECRET = 'test-secret';
		process.env.GITHUB_ADVISORY_DISPATCH_TOKEN = 'test-github-token';
		vi.stubGlobal('fetch', vi.fn());
		// withCronAuth logs every thrown error; the failure paths below are
		// expected, so keep their output out of the test log.
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.mocked(console.error).mockRestore();
	});

	it('returns 401 when no auth header', async () => {
		const res = await GET(makeRequest());
		expect(res.status).toBe(401);
	});

	it('returns 500 and alerts when GITHUB_ADVISORY_DISPATCH_TOKEN is unset', async () => {
		delete process.env.GITHUB_ADVISORY_DISPATCH_TOKEN;

		const res = await authed();

		expect(res.status).toBe(500);
		expect(fetch).not.toHaveBeenCalled();
		expect(adminAlerts.sendAdvisoryDispatchFailureAlert).toHaveBeenCalledTimes(
			1,
		);
	});

	describe('workflow already active, last scan passed (the normal case)', () => {
		const completedAt = new Date().toISOString();

		beforeEach(() => {
			mockFetchSequence(
				stateResponse('active'),
				runsResponse('success', completedAt),
				dispatched(),
			);
		});

		it('does NOT call the enable endpoint, reads the last run, then dispatches', async () => {
			const res = await authed();

			expect(res.status).toBe(200);
			expect(await res.json()).toEqual({
				ok: true,
				dispatchedWorkflow: 'security-advisories-scheduled.yml',
				wasReEnabled: false,
				lastScan: { runUrl: RUN_URL, completedAt },
			});
			expect(fetchUrls()).toEqual([WORKFLOW_URL, RUNS_URL, DISPATCH_URL]);

			// The runs read is authenticated like every other call: without the
			// token a private repo answers 404 and a public one rate-limits.
			const [, runsInit] = vi.mocked(fetch).mock.calls[1] as [
				string,
				RequestInit,
			];
			expect(runsInit.method ?? 'GET').toBe('GET');
			expect((runsInit.headers as Record<string, string>).Authorization).toBe(
				'Bearer test-github-token',
			);

			const [, dispatchInit] = vi.mocked(fetch).mock.calls[2] as [
				string,
				RequestInit,
			];
			const dispatchHeaders = dispatchInit.headers as Record<string, string>;
			expect(dispatchInit.method).toBe('POST');
			expect(dispatchHeaders.Authorization).toBe('Bearer test-github-token');
			expect(dispatchHeaders['Content-Type']).toBe('application/json');
			expect(JSON.parse(dispatchInit.body as string)).toEqual({ ref: 'main' });
			expect(
				adminAlerts.sendAdvisoryDispatchFailureAlert,
			).not.toHaveBeenCalled();
			expect(adminAlerts.sendAdvisoryScanResultAlert).not.toHaveBeenCalled();
		});

		it('records the cron run as SUCCESS', async () => {
			await authed();

			expect(prisma.cronJobRun.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({ status: 'SUCCESS' }),
				}),
			);
		});
	});

	describe('last scan did not pass (the case the result check exists for)', () => {
		it('alerts with the failed run, still dispatches a fresh scan, then fails the cron run', async () => {
			// The 2026-10-12 shape: the scan ran and found fixable advisories.
			mockFetchSequence(
				stateResponse('active'),
				runsResponse('failure'),
				dispatched(),
			);

			const res = await authed();

			expect(res.status).toBe(500);
			expect(adminAlerts.sendAdvisoryScanResultAlert).toHaveBeenCalledTimes(1);
			expect(firstArg(adminAlerts.sendAdvisoryScanResultAlert)).toMatchObject({
				problem: 'failed',
				runUrl: RUN_URL,
			});
			expect(fetchUrls()).toContain(DISPATCH_URL);
			// The FAILURE row is what reaches the Sentry monitor and the cron
			// history, independent of whether the email is read.
			expect(prisma.cronJobRun.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({ status: 'FAILURE' }),
				}),
			);
			expect(
				adminAlerts.sendAdvisoryDispatchFailureAlert,
			).not.toHaveBeenCalled();
		});

		// Classification itself is covered in advisory-scan-result.test.ts;
		// these pin that the route feeds GitHub's response shapes into it.
		it.each([
			['an empty run list', noRunsResponse, 'missing'],
			[
				'a run old enough to be stale',
				() => runsResponse('success', fiveDaysAgo()),
				'stale',
			],
		] as const)(
			'alerts on %s and still dispatches',
			async (_, runs, problem) => {
				mockFetchSequence(stateResponse('active'), runs(), dispatched());

				const res = await authed();

				expect(res.status).toBe(500);
				expect(firstArg(adminAlerts.sendAdvisoryScanResultAlert)).toMatchObject(
					{
						problem,
					},
				);
				expect(fetchUrls()).toContain(DISPATCH_URL);
			},
		);

		it('sends the result alert even when the dispatch that follows fails', async () => {
			mockFetchSequence(
				stateResponse('active'),
				runsResponse('failure'),
				new Response('Bad credentials', { status: 401 }),
			);

			const res = await authed();

			expect(res.status).toBe(500);
			expect(adminAlerts.sendAdvisoryScanResultAlert).toHaveBeenCalledTimes(1);
			expect(
				adminAlerts.sendAdvisoryDispatchFailureAlert,
			).toHaveBeenCalledTimes(1);
		});
	});

	// A read that fails or returns something unreadable is a heartbeat fault:
	// alerted as one (never as "no scan has run"), and it must not cost the
	// day's dispatch, which is this route's original job.
	it.each([
		[
			'a non-2xx response',
			() => new Response('Forbidden', { status: 403 }),
			'403',
		],
		[
			'a body that is not JSON',
			() => new Response('<html>', { status: 200 }),
			'not JSON',
		],
		[
			'a body with no workflow_runs list',
			() => new Response('{}', { status: 200 }),
			'no workflow_runs list',
		],
		[
			'a null run',
			() => new Response('{"workflow_runs":[null]}', { status: 200 }),
			'unexpected shape',
		],
		[
			'a run missing its fields',
			() => new Response('{"workflow_runs":[{}]}', { status: 200 }),
			'unexpected shape',
		],
	] as const)(
		'alerts on %s when reading the last run, still dispatches, then fails the run',
		async (_, runs, named) => {
			mockFetchSequence(stateResponse('active'), runs(), dispatched());

			const res = await authed();

			expect(res.status).toBe(500);
			expect(firstArg(adminAlerts.sendAdvisoryDispatchFailureAlert)).toContain(
				'reading the last scan result',
			);
			expect(firstArg(adminAlerts.sendAdvisoryDispatchFailureAlert)).toContain(
				named,
			);
			expect(adminAlerts.sendAdvisoryScanResultAlert).not.toHaveBeenCalled();
			expect(fetchUrls()).toContain(DISPATCH_URL);
			expect(prisma.cronJobRun.create).toHaveBeenCalledWith(
				expect.objectContaining({
					// The record names the read failure, not whatever a missing
					// verdict would throw further down.
					data: expect.objectContaining({
						status: 'FAILURE',
						error: expect.stringContaining('reading the last scan result'),
					}),
				}),
			);
		},
	);

	it('sends both heartbeat alerts when the read fails and the dispatch fails too', async () => {
		mockFetchSequence(
			stateResponse('active'),
			new Response('Forbidden', { status: 403 }),
			new Response('Bad credentials', { status: 401 }),
		);

		const res = await authed();

		expect(res.status).toBe(500);
		const calls = vi.mocked(adminAlerts.sendAdvisoryDispatchFailureAlert).mock
			.calls;
		expect(calls).toHaveLength(2);
		expect(calls[0]?.[0]).toContain('reading the last scan result');
		expect(calls[1]?.[0]).toContain('dispatching workflow');
		expect(adminAlerts.sendAdvisoryScanResultAlert).not.toHaveBeenCalled();
	});

	describe('workflow disabled by inactivity (the case this route exists for)', () => {
		it('names the re-enable in the FAILURE record when the scan it then reads is red', async () => {
			// A failed run records only its error message, so the one change
			// this route made to the repo has to be in it.
			mockFetchSequence(
				stateResponse('disabled_inactivity'),
				new Response(null, { status: 204 }), // PUT enable
				runsResponse('failure'),
				dispatched(),
			);

			const res = await authed();

			expect(res.status).toBe(500);
			expect(prisma.cronJobRun.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						status: 'FAILURE',
						error: expect.stringContaining('re-enabled the workflow'),
					}),
				}),
			);
		});

		// Generated by /ship coverage audit.
		// Value: protects=the FAILURE record names the re-enable when the last-scan
		// read fails; fails_when=the read-error branch rethrows readError without
		// reEnabledNote; why_new=the existing re-enable case covers only a red
		// verdict; seam=none; no_claim=GitHub enable semantics (mocked fetch; unit only)
		it('names the re-enable in the FAILURE record when reading the last scan fails', async () => {
			mockFetchSequence(
				stateResponse('disabled_inactivity'),
				new Response(null, { status: 204 }), // PUT enable
				new Response('Forbidden', { status: 403 }),
				dispatched(),
			);

			const res = await authed();

			expect(res.status).toBe(500);
			expect(fetchUrls()).toContain(DISPATCH_URL);
			expect(prisma.cronJobRun.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						status: 'FAILURE',
						error: expect.stringMatching(
							/reading the last scan result.*re-enabled the workflow/s,
						),
					}),
				}),
			);
		});

		it('enables the workflow BEFORE dispatching, and reports wasReEnabled: true', async () => {
			mockFetchSequence(
				stateResponse('disabled_inactivity'),
				new Response(null, { status: 204 }), // PUT enable
				runsResponse('success'),
				dispatched(),
			);

			const res = await authed();

			expect(res.status).toBe(200);
			expect(await res.json()).toMatchObject({
				ok: true,
				dispatchedWorkflow: 'security-advisories-scheduled.yml',
				wasReEnabled: true,
			});
			const [, enableInit] = vi.mocked(fetch).mock.calls[1] as [
				string,
				RequestInit,
			];
			expect(enableInit.method).toBe('PUT');
			// Enable must happen BEFORE dispatch, not just both happen.
			expect(fetchUrls()).toEqual([
				WORKFLOW_URL,
				ENABLE_URL,
				RUNS_URL,
				DISPATCH_URL,
			]);
		});

		it('returns 500 and alerts if the enable call itself fails, without ever dispatching', async () => {
			mockFetchSequence(
				stateResponse('disabled_inactivity'),
				new Response('Forbidden', { status: 403 }),
			);

			const res = await authed();

			expect(res.status).toBe(500);
			expect(fetch).toHaveBeenCalledTimes(2);
			expect(
				adminAlerts.sendAdvisoryDispatchFailureAlert,
			).toHaveBeenCalledTimes(1);
			expect(firstArg(adminAlerts.sendAdvisoryDispatchFailureAlert)).toContain(
				're-enabling',
			);
		});
	});

	it('for a MANUALLY disabled workflow: never enables it, sends one "disabled" alert, skips the dispatch and fails the run', async () => {
		// A human turned it off on purpose: the route must not override that,
		// a dispatch would only be refused, and the last scan would soon read
		// as stale. One alert naming the real cause, every day it stays off.
		mockFetchSequence(stateResponse('disabled_manually'));

		const res = await authed();

		expect(res.status).toBe(500);
		expect(fetchUrls()).toEqual([WORKFLOW_URL]);
		expect(adminAlerts.sendAdvisoryScanResultAlert).toHaveBeenCalledTimes(1);
		expect(firstArg(adminAlerts.sendAdvisoryScanResultAlert)).toMatchObject({
			problem: 'disabled',
			runUrl: null,
		});
		expect(adminAlerts.sendAdvisoryDispatchFailureAlert).not.toHaveBeenCalled();
		expect(prisma.cronJobRun.create).toHaveBeenCalledWith(
			expect.objectContaining({
				// Same documented prefix as every other scan problem, so the
				// FAILURE row reads as "paused", not as a broken heartbeat.
				data: expect.objectContaining({
					status: 'FAILURE',
					error: expect.stringMatching(
						/^advisory-scan-heartbeat: last scan disabled/,
					),
				}),
			}),
		);
	});

	it.each([
		[
			'a body that is not JSON',
			() => new Response('<html>', { status: 200 }),
			'not JSON',
		],
		[
			'a body with no state',
			() => new Response('{}', { status: 200 }),
			'no state',
		],
		// Generated by /ship coverage audit.
		// Value: protects=readJson alerts on a JSON body that is not an object;
		// fails_when=the null/non-object guard is dropped (destructuring null then
		// throws a bare TypeError: 500 with no alert); why_new=no row sent a
		// valid-JSON non-object; seam=none; no_claim=real GitHub bodies (mocked fetch)
		[
			'a JSON null body',
			() => new Response('null', { status: 200 }),
			'not a JSON object',
		],
	] as const)(
		'alerts on %s from the workflow-state check, without dispatching',
		async (_, stateRes, named) => {
			mockFetchSequence(stateRes());

			const res = await authed();

			expect(res.status).toBe(500);
			expect(fetchUrls()).toEqual([WORKFLOW_URL]);
			expect(firstArg(adminAlerts.sendAdvisoryDispatchFailureAlert)).toContain(
				'checking workflow state',
			);
			expect(firstArg(adminAlerts.sendAdvisoryDispatchFailureAlert)).toContain(
				named,
			);
		},
	);

	it('returns 500 and alerts when the workflow-state check returns non-2xx', async () => {
		mockFetchSequence(new Response('Not Found', { status: 404 }));

		const res = await authed();

		expect(res.status).toBe(500);
		expect(fetch).toHaveBeenCalledTimes(1);
		expect(adminAlerts.sendAdvisoryDispatchFailureAlert).toHaveBeenCalledTimes(
			1,
		);
		expect(firstArg(adminAlerts.sendAdvisoryDispatchFailureAlert)).toContain(
			'checking workflow state',
		);
	});

	it('returns 500 and alerts on a non-2xx GitHub response from the dispatch call, rather than reading it as success', async () => {
		// The exact failure class documented in this repo's TODOS.md/CLAUDE.md
		// history: sendEmail returns false without throwing, and a caller that
		// only checks for a thrown rejection ships a hole. Same shape here —
		// `fetch` resolving is not the same as GitHub accepting the dispatch.
		mockFetchSequence(
			stateResponse('active'),
			runsResponse('success'),
			new Response('Bad credentials', { status: 401 }),
		);

		const res = await authed();

		expect(res.status).toBe(500);
		expect(adminAlerts.sendAdvisoryDispatchFailureAlert).toHaveBeenCalledTimes(
			1,
		);
		expect(firstArg(adminAlerts.sendAdvisoryDispatchFailureAlert)).toContain(
			'401',
		);
	});

	it('returns 500 and alerts when fetch itself rejects (network failure)', async () => {
		// This is the case AbortSignal.timeout()/try-catch exists for: a
		// rejected promise, not a resolved non-2xx response. Before that catch
		// existed, this shipped past a green suite asserting only res.status.
		vi.mocked(fetch).mockRejectedValueOnce(new Error('network unreachable'));

		const res = await authed();

		expect(res.status).toBe(500);
		expect(adminAlerts.sendAdvisoryDispatchFailureAlert).toHaveBeenCalledTimes(
			1,
		);
		expect(firstArg(adminAlerts.sendAdvisoryDispatchFailureAlert)).toContain(
			'network unreachable',
		);
	});

	it('passes an AbortSignal to every fetch call, so a stalled response cannot hang the function', async () => {
		mockFetchSequence(
			stateResponse('active'),
			runsResponse('success'),
			dispatched(),
		);

		await authed();

		expect(fetch).toHaveBeenCalledTimes(3);
		for (const [, init] of vi.mocked(fetch).mock.calls) {
			expect((init as RequestInit | undefined)?.signal).toBeInstanceOf(
				AbortSignal,
			);
		}
	});
});
