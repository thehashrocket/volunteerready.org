import { sendAdvisoryDispatchFailureAlert } from '@/server/lib/admin-alerts';
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
 * `active`), this just triggers a second run the same week — harmless:
 * `pnpm audit` is idempotent and cheap, and `check-advisories.ts`'s only
 * side effect on success is a log line.
 */

const GITHUB_REPO_OWNER = 'thehashrocket';
const GITHUB_REPO_NAME = 'volunteerready.org';
const WORKFLOW_FILE = 'security-advisories-scheduled.yml';
const WORKFLOW_URL = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/actions/workflows/${WORKFLOW_FILE}`;

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

/**
 * One GitHub API call, with the network-rejection and non-2xx handling that
 * would otherwise be repeated three times in `GET` below (workflow-state
 * check, enable, dispatch) — each of which must alert-and-throw the same
 * way on failure. `label` names which call failed in the alert email.
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
		const details = `${label}: fetch() failed: ${err instanceof Error ? err.message : String(err)}`;
		await sendAdvisoryDispatchFailureAlert(details);
		throw new Error(`advisory-scan-heartbeat: ${details}`);
	}

	if (!res.ok) {
		const body = await res.text().catch(() => '<no body>');
		const details = `${label}: GitHub API returned ${res.status}: ${body.slice(0, 500)}`;
		await sendAdvisoryDispatchFailureAlert(details);
		throw new Error(`advisory-scan-heartbeat: ${details}`);
	}

	return res;
}

export const GET = withCronAuth('advisory-scan-heartbeat', async () => {
	const token = process.env.GITHUB_ADVISORY_DISPATCH_TOKEN;
	if (!token) {
		const details = 'GITHUB_ADVISORY_DISPATCH_TOKEN is not configured';
		await sendAdvisoryDispatchFailureAlert(details);
		throw new Error(`advisory-scan-heartbeat: ${details}`);
	}

	const headers = {
		Authorization: `Bearer ${token}`,
		Accept: 'application/vnd.github+json',
		'X-GitHub-Api-Version': '2022-11-28',
	};

	const stateRes = await githubApiCall(
		WORKFLOW_URL,
		{ headers },
		'checking workflow state',
	);
	const { state } = (await stateRes.json()) as { state?: string };

	// Only `disabled_inactivity` is ours to revive. `disabled_manually` means
	// a human turned it off on purpose, and overriding that would be the
	// wrong kind of "self-healing."
	const wasReEnabled = state === 'disabled_inactivity';
	if (wasReEnabled) {
		await githubApiCall(
			`${WORKFLOW_URL}/enable`,
			{ method: 'PUT', headers },
			're-enabling a workflow disabled by inactivity',
		);
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

	return { ok: true, dispatchedWorkflow: WORKFLOW_FILE, wasReEnabled };
});
