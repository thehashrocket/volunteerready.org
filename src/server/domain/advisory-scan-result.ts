/**
 * Reads the outcome of the scheduled `security-advisories-scheduled.yml` run.
 *
 * The heartbeat cron used to watch only whether the scan could be STARTED.
 * A scan that ran and found a fixable advisory reported through nothing but
 * GitHub's own "workflow run failed" email, and a run GitHub cancelled before
 * any step executed (2026-10-05) reported through nothing at all. On
 * 2026-10-12 the scan named both open advisories and nobody saw it until
 * someone asked. This turns the latest completed run into a verdict the
 * heartbeat can alert on.
 *
 * Only the latest completed run counts: an earlier success does not excuse a
 * later failure, and a later success means the problem is fixed.
 */

/** The fields this module reads from GitHub's workflow-run object. */
export type WorkflowRun = {
	conclusion: string | null;
	html_url: string;
	updated_at: string;
};

/**
 * `missing`, `failed` and `stale` come from `assessLastScan()`. `disabled` is
 * set by the heartbeat itself when a human has turned the workflow off, so
 * no scans run until someone turns it back on.
 */
export type ScanProblem = 'missing' | 'failed' | 'stale' | 'disabled';

/** What the heartbeat alerts on; also the input of `sendAdvisoryScanResultAlert()`. */
export type ScanFailure = {
	ok: false;
	problem: ScanProblem;
	details: string;
	runUrl: string | null;
};

export type ScanAssessment =
	| { ok: true; runUrl: string; completedAt: string }
	| ScanFailure;

/**
 * The scan runs daily and the heartbeat dispatches one more run each day, so
 * a healthy repo always has a completed run under a day old. 48 hours
 * tolerates one missed day (GitHub delays `schedule:` runs by hours) without
 * letting a stopped scan go unnoticed for long. It assumes both schedules
 * stay daily: the workflow's `cron` and the heartbeat's entry in vercel.json.
 */
export const SCAN_MAX_AGE_HOURS = 48;

/**
 * Whether one entry of GitHub's `workflow_runs` list has the fields this
 * module reads. GitHub documents them as always present; checking anyway
 * means a malformed response is reported as one, never judged as a scan.
 */
export function isWorkflowRun(value: unknown): value is WorkflowRun {
	if (typeof value !== 'object' || value === null) return false;
	const run = value as Record<string, unknown>;
	return (
		typeof run.html_url === 'string' &&
		typeof run.updated_at === 'string' &&
		(typeof run.conclusion === 'string' || run.conclusion === null)
	);
}

export function assessLastScan(
	run: WorkflowRun | undefined,
	now: Date,
): ScanAssessment {
	if (!run) {
		return {
			ok: false,
			problem: 'missing',
			details: 'The scheduled advisory scan has no completed run.',
			runUrl: null,
		};
	}

	// `cancelled`, `timed_out`, `skipped` and the rest all mean no verdict on
	// the dependencies, which is not a pass.
	if (run.conclusion !== 'success') {
		return {
			ok: false,
			problem: 'failed',
			details: `The latest scheduled advisory scan ended with conclusion "${run.conclusion ?? 'none'}" at ${run.updated_at}.`,
			runUrl: run.html_url,
		};
	}

	const ageHours =
		(now.getTime() - new Date(run.updated_at).getTime()) / 3_600_000;
	// A NaN age (unparseable timestamp) fails this comparison, so it is
	// reported as stale rather than passed.
	if (!(ageHours <= SCAN_MAX_AGE_HOURS)) {
		return {
			ok: false,
			problem: 'stale',
			details: `The latest scheduled advisory scan passed, but it finished at ${run.updated_at}, more than ${SCAN_MAX_AGE_HOURS} hours ago. Scans have stopped running.`,
			runUrl: run.html_url,
		};
	}

	return { ok: true, runUrl: run.html_url, completedAt: run.updated_at };
}
