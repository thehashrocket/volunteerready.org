import {
	assessLastScan,
	isWorkflowRun,
	type ScanAssessment,
} from '@/server/domain/advisory-scan-result';
import {
	sendAdvisoryDispatchFailureAlert,
	sendAdvisoryScanResultAlert,
} from '@/server/lib/admin-alerts';
import { withCronAuth } from '@/server/lib/cron-auth';

/**
 * A same-repo GitHub Actions `schedule:` trigger cannot watch for its own
 * 60-day repo-inactivity auto-disable — if the repo is genuinely idle that
 * long, every scheduled workflow in it, including a would-be watchdog, is
 * disabled at the same time. This Vercel cron is the external trigger:
 * Vercel's own scheduler is a completely independent system, unaffected by
 * GitHub's inactivity policy. See docs/branch-protection.md.
 *
 * ACTUALLY self-healing, not just alerting — this took three independent
 * adversarial review passes to catch. `workflow_dispatch` on a workflow
 * GitHub has auto-disabled for inactivity does NOT revive it: the disable
 * applies to the whole workflow, every trigger included, not just
 * `schedule:`. A bare dispatch call against a disabled workflow fails (and
 * this file's `!res.ok` handling correctly alerts on that) but never
 * actually restores scanning — so the first version of this route was only
 * ever a weekly "please go click Enable" email, not the guarantee its own
 * docstring claimed. Confirmed live for this repo: `thehashrocket/
 * volunteerready.org` is public, and the 60-day policy applies to public
 * repos. Fixed by checking the workflow's `state` first and calling
 * GitHub's `enable` endpoint when it's `disabled_inactivity` — BEFORE
 * dispatching, never for `disabled_manually` (a human turned it off on
 * purpose; this route must not override that).
 *
 * If GitHub's native schedule DID fire (the normal case, workflow already
 * `active`), this just triggers a second run the same day — harmless:
 * `pnpm audit` is idempotent and cheap, and `check-advisories.ts`'s only
 * side effect on success is a log line.
 *
 * It also reads the RESULT of the last completed scan (`assessLastScan()`).
 * Starting the scan was never the whole job: the 2026-10-12 run found two
 * open advisories and reported them only through GitHub's own failure email,
 * which nobody read, and the 2026-10-05 run was cancelled before any step ran
 * with no signal at all. A failed, inconclusive, missing or stale scan now sends an admin
 * alert and fails this cron run (Sentry monitor + CronJobRun FAILURE), on
 * every daily run until a scan passes. A workflow a human disabled is never
 * re-enabled or dispatched; it gets one daily "disabled" alert instead.
 */

const GITHUB_REPO_OWNER = 'thehashrocket';
const GITHUB_REPO_NAME = 'volunteerready.org';
const WORKFLOW_FILE = 'security-advisories-scheduled.yml';
const WORKFLOW_URL = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/actions/workflows/${WORKFLOW_FILE}`;
// `branch=main`: the workflow also accepts `workflow_dispatch` from any ref,
// and a feature-branch run must not stand in for main's verdict.
const RUNS_URL = `${WORKFLOW_URL}/runs?branch=main&status=completed&per_page=1`;

// Comfortably under Vercel's function duration limit, leaving room for the
// alert send afterward. Without this, a stalled (not rejected, not
// resolved) GitHub response runs until the PLATFORM kills the function from
// outside — bypassing this file's own try/catch entirely, so neither the
// CronJobRun FAILURE row nor the alert email fires. That is the exact
// silent-failure shape this whole feature exists to eliminate, and it was
// found independently by two separate adversarial review passes. Native
// `AbortSignal.timeout()` rather than the manual AbortController + setTimeout
// + clearTimeout pattern `sterling.ts` uses — both work, this one is fewer
// lines for the same guarantee.
const REQUEST_TIMEOUT_MS = 30_000;

/** Every heartbeat fault alerts the same way before failing the cron run. */
async function alertAndThrow(details: string): Promise<never> {
	await sendAdvisoryDispatchFailureAlert(details);
	throw new Error(`advisory-scan-heartbeat: ${details}`);
}

/**
 * One GitHub API call, with the network-rejection and non-2xx handling that
 * would otherwise be repeated at every call in `GET` below. `label` names
 * which call failed in the alert email.
 */
async function githubApiCall(
	url: string,
	init: RequestInit,
	label: string,
): Promise<Response> {
	let res: Response;
	try {
		res = await fetch(url, {
			...init,
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		});
	} catch (err) {
		return alertAndThrow(
			`${label}: fetch() failed: ${err instanceof Error ? err.message : String(err)}`,
		);
	}

	if (!res.ok) {
		const body = await res.text().catch(() => '<no body>');
		return alertAndThrow(
			`${label}: GitHub API returned ${res.status}: ${body.slice(0, 500)}`,
		);
	}

	return res;
}

/**
 * A 2xx response's JSON body. An unreadable one (an HTML error page from a
 * proxy, a truncated body) is a heartbeat fault, alerted like any other
 * GitHub call failure.
 */
async function readJson(
	res: Response,
	label: string,
): Promise<Record<string, unknown>> {
	let body: unknown;
	try {
		body = await res.json();
	} catch (err) {
		return alertAndThrow(
			`${label}: response was not JSON: ${err instanceof Error ? err.message : String(err)}`,
		);
	}
	if (typeof body !== 'object' || body === null) {
		return alertAndThrow(`${label}: response was not a JSON object`);
	}
	return body as Record<string, unknown>;
}

/**
 * The verdict on main's latest completed scan. A response that cannot be
 * read (not JSON, no `workflow_runs` list, a malformed run) is a heartbeat
 * fault, never read as "no scan has run".
 */
async function readLastScan(
	headers: Record<string, string>,
): Promise<ScanAssessment> {
	const label = 'reading the last scan result';
	const res = await githubApiCall(RUNS_URL, { headers }, label);
	const runs = (await readJson(res, label)).workflow_runs;
	if (!Array.isArray(runs)) {
		return alertAndThrow(`${label}: response has no workflow_runs list`);
	}
	const latest: unknown = runs[0];
	if (latest !== undefined && !isWorkflowRun(latest)) {
		return alertAndThrow(`${label}: the latest run has an unexpected shape`);
	}
	return assessLastScan(latest, new Date());
}

export const GET = withCronAuth('advisory-scan-heartbeat', async () => {
	const token = process.env.GITHUB_ADVISORY_DISPATCH_TOKEN;
	if (!token) {
		return alertAndThrow('GITHUB_ADVISORY_DISPATCH_TOKEN is not configured');
	}

	const headers = {
		Authorization: `Bearer ${token}`,
		Accept: 'application/vnd.github+json',
		'X-GitHub-Api-Version': '2022-11-28',
	};

	const stateLabel = 'checking workflow state';
	const stateRes = await githubApiCall(WORKFLOW_URL, { headers }, stateLabel);
	const { state } = await readJson(stateRes, stateLabel);
	if (typeof state !== 'string') {
		return alertAndThrow(`${stateLabel}: response has no state`);
	}

	// `disabled_manually` means a human turned the workflow off on purpose,
	// and overriding that would be the wrong kind of "self-healing." A
	// dispatch would only be refused, and the last scan would read as stale
	// within two days, so instead send one alert naming the real cause, every
	// day it stays off: a forgotten manual disable must not go quiet.
	if (state === 'disabled_manually') {
		await sendAdvisoryScanResultAlert({
			problem: 'disabled',
			details:
				'The workflow is disabled manually in GitHub (state "disabled_manually"), so the heartbeat did not dispatch a scan.',
			runUrl: null,
		});
		throw new Error(
			'advisory-scan-heartbeat: last scan disabled: the scan workflow is disabled manually',
		);
	}

	// Only `disabled_inactivity` is ours to revive.
	const wasReEnabled = state === 'disabled_inactivity';
	if (wasReEnabled) {
		await githubApiCall(
			`${WORKFLOW_URL}/enable`,
			{ method: 'PUT', headers },
			're-enabling a workflow disabled by inactivity',
		);
	}

	// Read the last scan's verdict BEFORE dispatching, so the run started
	// below is never the one assessed, and alert before the dispatch call so
	// a dispatch failure cannot swallow the result alert. A failed read
	// (already alerted) must not cost the day's dispatch either: starting a
	// scan is this route's original job, so the read error is rethrown after.
	let lastScan: ScanAssessment | undefined;
	let readError: unknown;
	try {
		lastScan = await readLastScan(headers);
	} catch (err) {
		readError = err;
	}
	if (lastScan && !lastScan.ok) {
		await sendAdvisoryScanResultAlert(lastScan);
	}

	// GitHub returns 204 No Content on a successful dispatch.
	await githubApiCall(
		`${WORKFLOW_URL}/dispatches`,
		{
			method: 'POST',
			headers: { ...headers, 'Content-Type': 'application/json' },
			body: JSON.stringify({ ref: 'main' }),
		},
		'dispatching workflow',
	);

	// Fail the cron run after the fresh scan is dispatched: `withCronAuth`
	// records it as FAILURE and reports an error to its Sentry monitor, a
	// second channel that does not depend on the alert email being read. If
	// the dispatch above failed, the run records that error instead; the scan
	// problem has already gone out by email. A re-enable is noted in the
	// message, since a failed run records nothing else from this route.
	const reEnabledNote = wasReEnabled
		? ' (this run re-enabled the workflow after GitHub disabled it for inactivity)'
		: '';
	if (!lastScan) {
		const message =
			readError instanceof Error ? readError.message : String(readError);
		throw new Error(`${message}${reEnabledNote}`, { cause: readError });
	}
	if (!lastScan.ok) {
		throw new Error(
			`advisory-scan-heartbeat: last scan ${lastScan.problem}: ${lastScan.details}${reEnabledNote}`,
		);
	}

	return {
		ok: true,
		dispatchedWorkflow: WORKFLOW_FILE,
		wasReEnabled,
		lastScan: { runUrl: lastScan.runUrl, completedAt: lastScan.completedAt },
	};
});
