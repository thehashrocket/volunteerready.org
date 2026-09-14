import { execFile } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { promisify } from 'node:util';

/**
 * CI advisory gate.
 *
 * Fails the build when a HIGH or CRITICAL advisory is open against an installed
 * package **and a patched version exists**. Nothing else fails it.
 *
 * WHY `pnpm audit` AND NOT THE DEPENDABOT ALERTS API. The first version of this
 * script read `GET /repos/{owner}/{repo}/dependabot/alerts` with the Actions
 * `GITHUB_TOKEN` and a `security-events: read` permission. That does not work,
 * and it was not obvious from the config — verified by running it in CI, where
 * it produced:
 *
 *     Advisory gate DID NOT RUN: GitHub API returned 403 Forbidden.
 *
 * The token is minted for the Actions GitHub App, and that App has no Dependabot
 * alerts permission to grant, so no `permissions:` block can fix it; it needs a
 * PAT. A gate that requires a hand-provisioned secret is a gate that is one
 * expired token away from silently never running again — which is the exact
 * failure this file exists to prevent. `pnpm audit` reads the same GitHub
 * Advisory Database through the registry, needs no credential at all, and
 * therefore also works on fork PRs where secrets are unavailable.
 *
 * The trade-off is deliberate: `pnpm audit` cannot see alerts dismissed in
 * GitHub's UI. Dismissals move into `pnpm.auditConfig.ignoreGhsas` in
 * package.json instead — which is better for this purpose, because an in-repo
 * ignore is version-controlled, diffed, and argued about in review, whereas a
 * UI dismissal is invisible to everyone who was not looking at the alerts tab.
 * `scripts/pnpm-overrides.test.ts` requires a written reason for each one.
 *
 * FAIL CLOSED on a fixable high/critical — the only state where somebody can
 * act immediately. A 23-alert backlog accumulated here because nothing said no.
 *
 * FAIL OPEN on everything else: audit could not run, output unparseable, or an
 * advisory with no published patch. A gate that blocks every PR because the
 * registry returned 502, or because an upstream maintainer has not shipped a
 * fix, gets switched off within a week — and a switched-off gate protects
 * nothing.
 *
 * BUT FAILING OPEN IS ANNOUNCED, NEVER SILENT. A gate that could not run and a
 * gate that passed produce the same green check, and the whole value of the
 * control is that those two are distinguishable. Every fail-open path emits a
 * GitHub `::warning` annotation. That property is what caught the 403 above.
 */

const execFileAsync = promisify(execFile);

/** The severities worth stopping a build for. */
export const BLOCKING_SEVERITIES = ['high', 'critical'] as const;

/** npm's sentinel in `patched_versions` for "no fix exists yet". */
export const NO_PATCH = '<0.0.0';

export type Advisory = {
	severity?: string;
	module_name?: string;
	patched_versions?: string;
	github_advisory_id?: string;
	title?: string;
};

export type AuditReport = { advisories?: Record<string, Advisory> };

export type BlockingAdvisory = {
	id: string;
	severity: string;
	packageName: string;
	patchedVersions: string;
	title: string;
};

export type Decision = {
	blocking: BlockingAdvisory[];
	unpatched: string[];
	ignored: number;
};

/**
 * Pure decision step, separated from the subprocess so it can be tested without
 * running an audit.
 */
export function decideAdvisoryGate(report: AuditReport): Decision {
	const advisories = Object.entries(report.advisories ?? {});
	const blocking: BlockingAdvisory[] = [];
	const unpatched: string[] = [];

	for (const [id, advisory] of advisories) {
		const severity = (advisory.severity ?? '').toLowerCase();
		if (!BLOCKING_SEVERITIES.includes(severity as 'high' | 'critical')) {
			continue;
		}

		const packageName = advisory.module_name ?? 'unknown';
		const patchedVersions = advisory.patched_versions ?? '';
		const label = advisory.github_advisory_id ?? id;

		// No published fix — nothing the build could ask anyone to do.
		if (!patchedVersions || patchedVersions === NO_PATCH) {
			unpatched.push(`${label} ${packageName} (${severity})`);
			continue;
		}

		blocking.push({
			id: label,
			severity,
			packageName,
			patchedVersions,
			title: advisory.title ?? '',
		});
	}

	return {
		blocking,
		unpatched,
		ignored: advisories.length - blocking.length - unpatched.length,
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

/**
 * Everything `failOpen()` needs to say, computed once and written twice: a
 * one-line `::warning` annotation (buried one click deep in the job's own
 * log/annotations view) and a bolder `$GITHUB_STEP_SUMMARY` entry (one click
 * from the run's Summary tab). A `::warning` alone renders as a plain green
 * check in the PR's top-level list — this is not sufficient on its own,
 * which is the whole reason this function exists as something separate from
 * `annotate()`.
 *
 * Pure by design — no `process.env`, no I/O — so the CI-run-only fail-open
 * path (previously untested; see `check-advisories.test.ts`'s docstring on
 * why) is directly testable.
 */
export function buildFailOpenReport(reason: string): {
	warningLine: string;
	summaryMarkdown: string;
} {
	return {
		warningLine: `Advisory gate DID NOT RUN: ${reason}. This is not a pass — the check was skipped.`,
		summaryMarkdown: `## ⚠️ Security advisories gate did not run

**This is not a pass.** \`pnpm audit\` could not produce a usable report
(\`${reason}\`), so no advisories were checked on this PR. The gate exited 0
so a registry hiccup doesn't block every PR — but that means a **genuine**
break here (a lockfile bug, a tool bug) looks identical to "nothing to
report" unless someone reads this summary.

Run \`pnpm tsx scripts/check-advisories.ts\` locally to see what actually
happened.
`,
	};
}

/**
 * Appends to the file named by `$GITHUB_STEP_SUMMARY` (GitHub sets this in
 * every job; appending is the documented contract). A silent no-op when the
 * env var is unset (e.g. running locally) — `annotate()`'s own console
 * output already covers that case, much more visibly than a file nobody is
 * looking at.
 *
 * The write itself must NEVER throw. This is a best-effort side channel
 * whose entire point is to make the non-blocking fail-open path MORE
 * visible, not to give it a new way to crash instead of exiting 0. A
 * permissions error, a full disk, or an unusual runner degrades this back
 * to exactly today's behavior (the `::warning` annotation alone), never to
 * a nonzero exit.
 */
export function writeStepSummary(markdown: string): void {
	const path = process.env.GITHUB_STEP_SUMMARY;
	if (!path) return;

	try {
		appendFileSync(path, markdown);
	} catch {
		// Swallowed deliberately — see the docstring above.
	}
}

/** Fail-open: say so loudly, then exit 0. */
function failOpen(reason: string): never {
	const { warningLine, summaryMarkdown } = buildFailOpenReport(reason);
	annotate('warning', warningLine);
	writeStepSummary(summaryMarkdown);
	process.exit(0);
}

async function main(): Promise<void> {
	let stdout: string;
	try {
		// `pnpm audit` exits NON-ZERO when it finds anything, so a thrown error
		// here is expected and its stdout is still the report. Only a genuinely
		// missing/failed run leaves us with nothing to parse.
		const result = await execFileAsync('pnpm', ['audit', '--json'], {
			maxBuffer: 32 * 1024 * 1024,
		});
		stdout = result.stdout;
	} catch (err) {
		const maybe = err as { stdout?: string; message?: string };
		if (!maybe.stdout?.trim()) {
			failOpen(
				`\`pnpm audit\` produced no output (${maybe.message ?? 'unknown'})`,
			);
		}
		stdout = maybe.stdout;
	}

	let report: AuditReport;
	try {
		report = JSON.parse(stdout) as AuditReport;
	} catch {
		failOpen('`pnpm audit --json` returned output that is not JSON');
	}

	if (
		typeof report !== 'object' ||
		report === null ||
		!('advisories' in report)
	) {
		failOpen('`pnpm audit --json` returned an unexpected shape');
	}

	const { blocking, unpatched, ignored } = decideAdvisoryGate(report);

	for (const name of unpatched) {
		annotate(
			'warning',
			`${name} is high/critical with NO patch available — not blocking, nothing to upgrade to yet.`,
		);
	}

	if (blocking.length === 0) {
		annotate(
			'notice',
			`Advisory gate passed: no fixable high/critical advisories (${unpatched.length} unpatched, ${ignored} below threshold).`,
		);
		return;
	}

	const lines = blocking.map(
		(b) =>
			`  ${b.id} [${b.severity}] ${b.packageName} → fixed in ${b.patchedVersions}${
				b.title ? ` — ${b.title}` : ''
			}`,
	);
	annotate(
		'error',
		`Advisory gate FAILED: ${blocking.length} fixable high/critical advisory(ies).\n${lines.join('\n')}`,
	);
	console.error(
		'\nEach of these has a published fix. Upgrade the package, or — if it is\n' +
			'genuinely not reachable — add its GHSA to pnpm.auditConfig.ignoreGhsas\n' +
			'in package.json AND record why in docs/dependency-overrides.md.\n',
	);
	process.exit(1);
}

// Only run when invoked directly, so the test can import the pure function.
if (process.argv[1]?.endsWith('check-advisories.ts')) {
	void main();
}
