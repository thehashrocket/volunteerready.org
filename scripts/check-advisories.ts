/**
 * CI advisory gate.
 *
 * Fails the build when a HIGH or CRITICAL Dependabot alert is open **and a
 * patched version exists**. Nothing else fails it.
 *
 * The shape is deliberate, and the two halves pull in opposite directions:
 *
 * FAIL CLOSED on a fixable high/critical. This is the only state where the
 * build should stop, because it is the only one where somebody can act
 * immediately. A 23-alert backlog accumulated here precisely because nothing
 * ever said no.
 *
 * FAIL OPEN on everything else — an API error, a missing token, an advisory
 * with no patch available. A gate that blocks every PR because GitHub returned
 * 502, or because a maintainer has not shipped a fix yet, gets switched off
 * within a week, and a switched-off gate protects nothing.
 *
 * BUT FAILING OPEN IS ANNOUNCED, NEVER SILENT. This is the part that is easy
 * to get wrong: a gate that cannot run and a gate that passed produce the same
 * green check, and the whole value of the control is that those two states are
 * distinguishable. Every fail-open path emits a GitHub `::warning` annotation
 * that surfaces on the run summary and says which state it is in.
 *
 * Requires a token with `security_events: read`. `GITHUB_TOKEN` can be granted
 * it via a `permissions:` block, but a token WITHOUT it gets 403 — which is a
 * fail-open path, so the gate degrades into a visible warning rather than a
 * broken build. That is the intended behaviour on a fork PR, where secrets are
 * not available at all.
 */

const OWNER_REPO = process.env.GITHUB_REPOSITORY ?? '';
const TOKEN = process.env.GITHUB_TOKEN ?? '';

/** The severities worth stopping a build for. */
export const BLOCKING_SEVERITIES = ['high', 'critical'] as const;

export type Alert = {
	number: number;
	state: string;
	security_advisory?: { severity?: string; summary?: string };
	security_vulnerability?: {
		first_patched_version?: { identifier?: string } | null;
	} | null;
	dependency?: { package?: { name?: string } };
};

export type Decision = {
	blocking: BlockingAlert[];
	unpatched: string[];
	ignored: number;
};

export type BlockingAlert = {
	number: number;
	severity: string;
	packageName: string;
	patchedVersion: string;
	summary: string;
};

/**
 * Pure decision step, separated from the fetch so it can be tested without a
 * network. Takes the FULL alert list and does its own `state === 'open'`
 * filter rather than trusting the caller's query string — the API's `state`
 * parameter has been wrong before in other tools, and a gate that silently
 * evaluates dismissed alerts is worse than no gate.
 */
export function decideAdvisoryGate(alerts: Alert[]): Decision {
	const open = alerts.filter((a) => a.state === 'open');
	const blocking: BlockingAlert[] = [];
	const unpatched: string[] = [];

	for (const alert of open) {
		const severity = (alert.security_advisory?.severity ?? '').toLowerCase();
		if (!BLOCKING_SEVERITIES.includes(severity as 'high' | 'critical')) {
			continue;
		}

		const packageName = alert.dependency?.package?.name ?? 'unknown';
		const patchedVersion =
			alert.security_vulnerability?.first_patched_version?.identifier ?? '';

		// No patch published — nothing the build could ask anyone to do.
		if (!patchedVersion) {
			unpatched.push(`#${alert.number} ${packageName} (${severity})`);
			continue;
		}

		blocking.push({
			number: alert.number,
			severity,
			packageName,
			patchedVersion,
			summary: alert.security_advisory?.summary ?? '',
		});
	}

	return {
		blocking,
		unpatched,
		ignored: open.length - blocking.length - unpatched.length,
	};
}

/** GitHub Actions workflow-command annotations. Plain text elsewhere. */
function annotate(level: 'warning' | 'error' | 'notice', message: string) {
	const oneLine = message.replace(/\n/g, '%0A');
	if (process.env.GITHUB_ACTIONS === 'true') {
		console.log(`::${level}::${oneLine}`);
	} else {
		console.log(`[${level}] ${message}`);
	}
}

/** Fail-open: say so loudly, then exit 0. */
function failOpen(reason: string): never {
	annotate(
		'warning',
		`Advisory gate DID NOT RUN: ${reason}. This is not a pass — the check was skipped.`,
	);
	process.exit(0);
}

async function main(): Promise<void> {
	if (!OWNER_REPO) failOpen('GITHUB_REPOSITORY is not set');
	if (!TOKEN) failOpen('no token available (expected on fork PRs)');

	let alerts: Alert[];
	try {
		const res = await fetch(
			`https://api.github.com/repos/${OWNER_REPO}/dependabot/alerts?state=open&per_page=100`,
			{
				headers: {
					Authorization: `Bearer ${TOKEN}`,
					Accept: 'application/vnd.github+json',
					'X-GitHub-Api-Version': '2022-11-28',
				},
			},
		);

		if (!res.ok) {
			// 403 is the common one: the token lacks `security_events: read`, or
			// Dependabot alerts are disabled for the repo.
			failOpen(`GitHub API returned ${res.status} ${res.statusText}`);
		}

		const body: unknown = await res.json();
		if (!Array.isArray(body))
			failOpen('GitHub API returned an unexpected shape');
		alerts = body as Alert[];
	} catch (err) {
		failOpen(`could not reach the GitHub API (${(err as Error).message})`);
	}

	const { blocking, unpatched, ignored } = decideAdvisoryGate(alerts);

	for (const name of unpatched) {
		annotate(
			'warning',
			`${name} is high/critical with NO patch available — not blocking, nothing to upgrade to yet.`,
		);
	}

	if (blocking.length === 0) {
		annotate(
			'notice',
			`Advisory gate passed: no fixable high/critical alerts (${unpatched.length} unpatched, ${ignored} below threshold).`,
		);
		return;
	}

	const lines = blocking.map(
		(b) =>
			`  #${b.number} [${b.severity}] ${b.packageName} → fixed in ${b.patchedVersion}${
				b.summary ? ` — ${b.summary}` : ''
			}`,
	);
	annotate(
		'error',
		`Advisory gate FAILED: ${blocking.length} fixable high/critical alert(s).\n${lines.join('\n')}`,
	);
	console.error(
		'\nEach of these has a published fix. Upgrade the package, or dismiss the\n' +
			'alert with a recorded reason if it is genuinely not reachable.\n',
	);
	process.exit(1);
}

// Only run when invoked directly, so the test can import the pure function.
if (process.argv[1]?.endsWith('check-advisories.ts')) {
	void main();
}
