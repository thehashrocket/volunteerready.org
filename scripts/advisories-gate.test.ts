import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { jobBlock, stripYamlComments } from './ci-gate-test-utils';

/**
 * `check-advisories.ts` fails open by design (see its own header comment),
 * and the historical incident this guards against was NOT a `continue-
 * on-error:`/`if: false` config bug — it was the script's own deliberate
 * fail-open path degrading to a `::warning` annotation, which renders as a
 * plain green check in the PR's top-level list. See `scripts/check-
 * advisories.ts`'s `buildFailOpenReport`/`writeStepSummary` for the fix to
 * THAT half.
 *
 * This file guards the OTHER, distinct failure class — the one the four
 * sibling `*-gate.test.ts` files already exist for: config that silences a
 * job while every string describing it stays in place (`if: false`,
 * `continue-on-error: true`, a deleted job, a reordered step). Nothing
 * silenced this job via config in the actual incident, but it's a real,
 * recurring class in this repo (hence four prior guards) and worth a fifth.
 *
 * Also guards a path-filter variant the siblings don't need to: a
 * `paths:`/`paths-ignore:` filter at the workflow trigger level could
 * exclude dependency-only PRs (package.json/pnpm-lock.yaml changes) from
 * triggering CI at all — precisely the PRs this gate exists to check.
 */

const REPO_ROOT = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'..',
);

function readRepoText(relPath: string): string {
	return readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
}

describe('CI advisories gate', () => {
	const workflow = readRepoText('.github/workflows/ci.yml');
	// Comment-stripped ONCE, up front — every assertion below runs against
	// this, not the raw block, so a prose comment mentioning
	// "continue-on-error:" or "paths:" can never redden this file against
	// correct config. (The exact trap `e2e-ci-gate.test.ts`'s own docstring
	// records hitting against `playwright.config.ts`.)
	const advisories = stripYamlComments(jobBlock(workflow, 'advisories'));

	it('defines a job that runs the advisory check', () => {
		expect(advisories).not.toBe('');
	});

	it('runs `pnpm tsx scripts/check-advisories.ts`', () => {
		expect(advisories).toMatch(
			/^\s*-\s*run:\s*pnpm tsx scripts\/check-advisories\.ts\s*$/m,
		);
	});

	it('installs before checking, frozen', () => {
		const install = advisories.indexOf('pnpm install --frozen-lockfile');
		const check = advisories.indexOf('pnpm tsx scripts/check-advisories.ts');

		expect(install).toBeGreaterThan(-1);
		expect(check).toBeGreaterThan(install);
	});

	it('keeps the gate unconditional and blocking', () => {
		// No `if:` at all in this job — unlike e2e's artifact-upload case,
		// there's no legitimate conditional step here, so the bar is "none",
		// not "only failure()".
		expect(advisories).not.toMatch(/^\s*if:/m);
		expect(advisories).not.toMatch(/continue-on-error:/);
	});

	it('is not restricted by a workflow-level path filter', () => {
		const trigger = stripYamlComments(
			workflow.slice(0, workflow.indexOf('\njobs:')),
		);
		expect(trigger).not.toMatch(/paths(-ignore)?:/);
	});
});

describe('CI advisories scheduled scan', () => {
	const scheduled = stripYamlComments(
		readRepoText('.github/workflows/security-advisories-scheduled.yml'),
	);

	it('runs on a schedule, so an idle main branch still gets scanned', () => {
		// The literal historical incident window had zero PR/push activity for
		// four weeks — the PR-triggered `advisories` job above does nothing
		// when nothing triggers it at all.
		expect(scheduled).toMatch(/^\s*schedule:\s*$/m);
		expect(scheduled).toMatch(/^\s*-\s*cron:\s*['"][^'"]+['"]\s*$/m);
	});

	it('also accepts workflow_dispatch, for the Vercel-cron heartbeat', () => {
		// See `src/app/api/cron/advisory-scan-heartbeat/` — an external
		// trigger immune to GitHub's 60-day repo-inactivity auto-disable,
		// which a same-repo scheduled workflow cannot watch for in itself.
		expect(scheduled).toMatch(/^\s*workflow_dispatch:/m);
	});

	it('runs the same advisory check as the PR-triggered job', () => {
		expect(scheduled).toMatch(
			/^\s*-\s*run:\s*pnpm tsx scripts\/check-advisories\.ts\s*$/m,
		);
	});

	it('installs before checking, frozen — same ordering as the PR-triggered job', () => {
		// Mirrors the "CI advisories gate" describe block's own ordering test
		// above. Caught missing by red-team review: this describe block guards
		// against the two duplicated step sequences silently diverging, but
		// ordering is a property it hadn't actually checked for this file.
		const install = scheduled.indexOf('pnpm install --frozen-lockfile');
		const check = scheduled.indexOf('pnpm tsx scripts/check-advisories.ts');

		expect(install).toBeGreaterThan(-1);
		expect(check).toBeGreaterThan(install);
	});

	it('keeps the scheduled job unconditional and blocking too', () => {
		expect(scheduled).not.toMatch(/^\s*if:/m);
		expect(scheduled).not.toMatch(/continue-on-error:/);
	});
});
