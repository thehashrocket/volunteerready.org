import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * CI runs the Playwright suite, and — exactly as with the `build` job — every
 * property that makes that gate work is invisible to CI's own exit code.
 *
 * The gap this closes was measured, not theorised. Before this job existed
 * every spec in `e2e/` ran only when someone remembered to type `pnpm e2e`, and
 * the last miss has a date on it: on 2026-08-07 (v0.41.16.0) adding `?since=`
 * to the version check silently broke both tests in
 * `e2e/app-update-prompt.spec.ts` — the mock glob `'**​/api/version'` does not
 * match a URL carrying a query string, so interception stopped firing, the real
 * endpoint answered, the build ids matched and the strip never rendered. Lint,
 * typecheck, 2,785 unit tests and `docs:build` stayed green throughout.
 *
 * Same class as `scripts/ci-build-gate.test.ts`, `scripts/lint-gate.test.ts`
 * and `scripts/docs-nav-links.test.ts`: a guard for config that the tool it
 * configures cannot check itself. Delete the job, drop the seed, install no
 * browser, or make the run non-blocking, and the pipeline goes green with the
 * whole browser layer gone.
 *
 * What is deliberately NOT asserted here: how long the suite takes, whether any
 * particular spec exists, or whether the assertions inside them are any good.
 * This file only pins that the suite RUNS, blocking, with what it needs.
 */

const REPO_ROOT = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'..',
);

function readRepoText(relPath: string): string {
	return readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
}

/**
 * Slice one job out of the workflow. Jobs sit at exactly two spaces of
 * indentation, so the next line matching that shape ends the block.
 *
 * Scoping is load-bearing for the same reason it is in `ci-build-gate.test.ts`:
 * `pnpm prisma migrate deploy` and the postgres service block appear in three
 * jobs, so a whole-file `toContain` would pass with this job's own steps
 * deleted.
 *
 * Returns `''` rather than throwing when the job is missing — this runs in the
 * `describe` body, i.e. at COLLECTION time, and a throw would take the whole
 * file out of the run and report the deletion as a smaller, greener suite.
 */
function jobBlock(workflow: string, jobName: string): string {
	const lines = workflow.split('\n');
	const start = lines.indexOf(`  ${jobName}:`);
	if (start === -1) return '';

	// `[^#\s]` excludes comments: this workflow documents its jobs in 2-space
	// comment blocks, and one ending in a colon would otherwise read as the next
	// job and truncate the slice.
	const rest = lines.slice(start + 1);
	const relativeEnd = rest.findIndex((line) => /^ {2}[^#\s].*:\s*$/.test(line));
	const end = relativeEnd === -1 ? lines.length : start + 1 + relativeEnd;
	return lines.slice(start, end).join('\n');
}

/**
 * Drop WHOLE-LINE `#` comments.
 *
 * Needed because this workflow explains itself at length, and prose naturally
 * names the very things these assertions forbid — the first draft of the
 * localhost check below went red against a comment saying the guard needs no
 * `E2E_ALLOW_REMOTE_DB`, which is the same false positive
 * `error-disclosure.guard.test.ts` and `plan-features.guard.test.ts` both had
 * to learn.
 *
 * Whole-line only, deliberately: a trailing-`#` strip would corrupt any quoted
 * value containing one — a password in a connection string, a `--health-cmd` —
 * and YAML gives no cheap way to tell a comment from a `#` inside quotes.
 */
function stripYamlComments(yaml: string): string {
	return yaml
		.split('\n')
		.filter((line) => !/^\s*#/.test(line))
		.join('\n');
}

describe('CI e2e gate', () => {
	const workflow = readRepoText('.github/workflows/ci.yml');
	const e2e = stripYamlComments(jobBlock(workflow, 'e2e'));

	it('defines a job that runs the browser suite', () => {
		expect(e2e).not.toBe('');
	});

	it('runs `pnpm e2e`', () => {
		expect(e2e).toMatch(/^\s*-\s*run:\s*pnpm e2e\s*$/m);
	});

	it('keeps the gate unconditional and blocking', () => {
		// Every other assertion here is a text-presence check, so a job that
		// still CONTAINS `pnpm e2e` but never reaches it — or reaches it and
		// ignores the result — satisfies them all while the gate is gone, with a
		// green check mark on the PR claiming otherwise.
		//
		// Assert on the VALUE of every `if:`, not on its indentation. An earlier
		// draft banned `if:` at four spaces (job level) and let step level
		// through, reasoning that the artifact upload legitimately needs
		// `if: failure()`. That was wrong, and pre-landing review caught it by
		// execution: appending `if: false` AFTER the `run:` key leaves
		// `- run: pnpm e2e` matching, sits at step indentation, and passed all
		// twenty tests with the suite fully disabled.
		//
		// `failure()` is the one legitimate condition in this job (upload the
		// report only on a red run). Anything else is a gate being removed.
		const conditions = [...e2e.matchAll(/^\s*if:\s*(.+?)\s*$/gm)].map(
			(m) => m[1],
		);
		for (const condition of conditions) {
			expect(condition).toBe('failure()');
		}

		// Ban the KEY, not the literal value `true`. GitHub allows an
		// expression-valued `continue-on-error`, and a continued error is
		// reported as a SUCCESSFUL conclusion — so `continue-on-error: ${{ ... }}`
		// disables the gate while a `not.toMatch(/continue-on-error:\s*true/)`
		// stays green. Raised by an adversarial cross-model pass. There is no
		// legitimate use of the key in this job, so the key itself is the rule.
		expect(e2e).not.toMatch(/continue-on-error:/);
	});

	it('does not hand the suite a base URL, which would hollow it out', () => {
		// `PLAYWRIGHT_BASE_URL` is the single most effective way to make this job
		// pass while testing almost nothing, and every part of it is silent:
		// `playwright.config.ts` sets `webServer: undefined` (no dev server at
		// all), `e2e/global-setup.ts` returns before warming a single route, and
		// if the URL is not localhost the four authenticated specs
		// (staff-created-volunteers, staff-tables-mobile, esg-dashboard,
		// impersonation-company-picker) `test.skip` themselves by design.
		//
		// The result is a green E2E check that ran public smoke tests against
		// somebody else's server. Raised by an adversarial cross-model pass.
		expect(e2e).not.toContain('PLAYWRIGHT_BASE_URL');
	});

	it('does not set CAPTURE, which swaps the suite for the screenshot pipeline', () => {
		// `playwright.config.ts` treats CAPTURE=1 as MUTUALLY EXCLUSIVE project
		// sets: it registers the capture project and DEREGISTERS chromium. So
		// `CAPTURE=1 pnpm e2e` runs zero e2e specs, regenerates
		// `public/marketing/*.png` instead, and exits 0 — a green gate that
		// asserted nothing and rewrote tracked assets on the runner.
		expect(e2e).not.toContain('CAPTURE');
	});

	it('gives the suite a database, because the specs seed sessions into one', () => {
		// Authenticated specs mint NextAuth `Session` rows directly
		// (`e2e/utils/db.ts`) rather than driving a login form. With no
		// reachable database every one of them fails at `beforeAll`.
		expect(e2e).toMatch(/image:\s*postgres:16-alpine/);
		expect(e2e).toMatch(/DATABASE_URL:/);
	});

	it('points DATABASE_URL at localhost, which the e2e guard requires', () => {
		// `e2e/utils/db.ts` refuses a non-local host unless E2E_ALLOW_REMOTE_DB=1,
		// because the specs bulk-delete by prefix. A remote URL here would either
		// fail every authenticated spec or, with the override, sweep rows out of
		// a shared database.
		expect(e2e).toMatch(/DATABASE_URL:\s*"postgresql:\/\/[^"]*@localhost:/);
		expect(e2e).not.toContain('E2E_ALLOW_REMOTE_DB');
	});

	it('seeds the DEV branch, the only one carrying the test accounts', () => {
		// The mirror image of the build job's trap. `seedProduction()` creates
		// the platform org and skill catalog and nothing else, so the four
		// `@volunteermatch.local` accounts the authenticated specs look up by
		// hand would not exist — `app-update-prompt.spec.ts` throws "seed data
		// missing — run pnpm seed:dev" by name.
		//
		// `seed:dev` explicitly, never a bare `pnpm seed`: that dispatches on an
		// unset NODE_ENV and is one job-level variable away from silently
		// seeding the wrong branch.
		expect(e2e).toMatch(/^\s*run:\s*pnpm seed:dev\s*$/m);
		expect(e2e).not.toMatch(/^\s*run:\s*pnpm seed\s*$/m);
		expect(e2e).not.toMatch(/NODE_ENV:\s*production/);
	});

	it('installs a browser, without which every spec errors before asserting', () => {
		// The runner ships no Playwright browsers. `--with-deps` adds the system
		// libraries too; without it Chromium is present but will not launch.
		expect(e2e).toMatch(/playwright install --with-deps chromium/);
	});

	it('runs migrate → seed → browsers → suite, in that order', () => {
		const migrate = e2e.indexOf('pnpm prisma migrate deploy');
		const seed = e2e.indexOf('pnpm seed:dev');
		const browsers = e2e.indexOf('playwright install');
		const run = e2e.indexOf('run: pnpm e2e');

		expect(migrate).toBeGreaterThan(-1);
		expect(seed).toBeGreaterThan(-1);
		expect(browsers).toBeGreaterThan(-1);
		expect(run).toBeGreaterThan(-1);
		expect(migrate).toBeLessThan(seed);
		expect(seed).toBeLessThan(browsers);
		expect(browsers).toBeLessThan(run);
	});

	it('sets RESEND_FROM_EMAIL, without which the dev server cannot compile auth', () => {
		// `getFromEmail()` throws at import and `server/auth.ts` calls it at
		// module scope, so `/api/auth/[...nextauth]` fails to compile and every
		// authenticated spec loses its session.
		expect(e2e).toMatch(/RESEND_FROM_EMAIL:/);
	});

	it('keeps RESEND_FROM_EMAIL scoped to the job', () => {
		// At workflow level it would reach the `test` job, where a spec that
		// observes the variable being ABSENT silently changes meaning.
		const workflowEnv = workflow.slice(0, workflow.indexOf('\njobs:'));
		expect(workflowEnv).not.toContain('RESEND_FROM_EMAIL');
	});

	it('carries a timeout, so a hung dev server fails as a timeout', () => {
		// `webServer.timeout` only covers the boot. A run that wedges after that
		// would otherwise sit until GitHub's 6-hour default, holding the
		// concurrency group and blocking the queue.
		expect(e2e).toMatch(/timeout-minutes:\s*\d+/);
	});

	it('uploads the report when the suite fails', () => {
		// The one artifact that makes a red run diagnosable without re-running
		// it locally against a differently-seeded database.
		expect(e2e).toMatch(/if:\s*failure\(\)/);
		expect(e2e).toMatch(/upload-artifact/);
	});
});

/**
 * Drop TypeScript comments, LINE comments first.
 *
 * The ordering is not stylistic — it is the same trap `error-disclosure.
 * guard.test.ts` and `plan-features.guard.test.ts` each had to learn. A line
 * comment containing `/*` (or, here, any of the code these assertions look for)
 * would otherwise open a block the block-pass then closes somewhere later,
 * swallowing real code in between.
 *
 * This exists because the first version of this describe asserted against the
 * raw file, and `playwright.config.ts` documents its own reporter choice by
 * quoting it — so `open: 'never'` appears in prose one line above the code.
 * Mutation-testing caught it: rewriting the COMMENT satisfied the assertion
 * while the setting was free to change. A guard that a comment can satisfy is
 * checking the documentation, not the config.
 */
function stripTsComments(source: string): string {
	return source.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

/** The `timeout:` at ONE leading tab — a top-level `defineConfig` key. */
function topLevelTimeout(config: string): RegExpMatchArray | null {
	return config.match(
		/^\ttimeout:\s*process\.env\.CI\s*\?\s*([\d_]+)\s*:\s*([\d_]+)/m,
	);
}

/** The `timeout:` inside the `webServer` block, whatever its indentation. */
function webServerTimeout(config: string): RegExpMatchArray | null {
	const start = config.indexOf('webServer:');
	if (start === -1) return null;
	return config
		.slice(start)
		.match(/timeout:\s*process\.env\.CI\s*\?\s*([\d_]+)\s*:\s*([\d_]+)/);
}

/**
 * Both timeouts exist for one reason — a cold CI runner compiles routes that a
 * developer's machine has cached — so both are pinned the same way: the CI side
 * must be strictly roomier, and the NUMBER is free to move.
 */
function expectCiRoomierThanLocal(match: RegExpMatchArray | null): void {
	expect(match).not.toBeNull();
	const ci = Number((match?.[1] ?? '0').replaceAll('_', ''));
	const local = Number((match?.[2] ?? '0').replaceAll('_', ''));
	expect(ci).toBeGreaterThan(local);
}

describe('Playwright CI configuration', () => {
	const config = stripTsComments(readRepoText('playwright.config.ts'));

	/**
	 * The CI side of `reporter: process.env.CI ? <ci> : <local>`.
	 *
	 * Reading the whole file and asserting "html appears somewhere" is
	 * branch-INSENSITIVE, and that is not a nitpick: inverting the ternary to
	 * `process.env.CI ? 'github' : [['html', …]]` leaves every such assertion
	 * green while CI silently stops producing the artifact the workflow uploads.
	 * Raised by an adversarial cross-model pass. Slice the branch, then assert.
	 */
	const ciReporter = (() => {
		const start = config.match(/reporter:\s*process\.env\.CI\s*\?/);
		if (start?.index === undefined) return '';

		// Walk to the ternary's `:` at bracket depth ZERO. A plain non-greedy
		// `([\s\S]*?):` stops at the first colon it meets, which for this value
		// is the one inside `{ open: 'never' }` — the slice then ends mid-object
		// and the `open: 'never'` assertion fails against correct config. That
		// was a live red test, not a hypothetical: the depth-blind version is
		// what this function replaced.
		let depth = 0;
		const from = start.index + start[0].length;
		for (let i = from; i < config.length; i++) {
			const ch = config[i];
			if (ch === '[' || ch === '{' || ch === '(') depth++;
			else if (ch === ']' || ch === '}' || ch === ')') depth--;
			else if (ch === ':' && depth === 0) return config.slice(from, i);
		}
		return '';
	})();

	it('resolves its reporter off `process.env.CI`', () => {
		expect(ciReporter).not.toBe('');
	});

	it('writes an HTML report ON THE CI BRANCH, or the upload collects nothing', () => {
		// Drop the html reporter and the failure path degrades to annotations
		// only, with no trace and no report — and nothing goes red to say so.
		expect(ciReporter).toMatch(/\[['"]html['"]/);
		expect(ciReporter).toMatch(/open:\s*['"]never['"]/);
	});

	it('keeps `github` on the CI branch too, for inline PR annotations', () => {
		expect(ciReporter).toMatch(/\[['"]github['"]\]/);
	});

	it('SELF-CHECK: the comment stripper actually removes prose', () => {
		// This one guards the guard, and it is not symmetric with the YAML
		// stripper above. A broken `stripYamlComments` fails SAFE — comments
		// survive, the E2E_ALLOW_REMOTE_DB assertion matches prose and goes RED,
		// so the breakage announces itself. A broken `stripTsComments` fails
		// UNSAFE: comments survive, the assertions below match them, and every
		// test in this describe passes while the real setting is free to change.
		//
		// That is not hypothetical — it is exactly the state this file shipped in
		// until mutation-testing caught it. So pin the direction that goes quiet.
		const withOnlyAProseMention = [
			"// reporter: [['github'], ['html', { open: 'never' }]] — explained here",
			'/* forbidOnly: !!process.env.CI, described in a block comment */',
			'export default { testDir: "./e2e" }',
		].join('\n');
		const stripped = stripTsComments(withOnlyAProseMention);

		expect(stripped).not.toContain('github');
		expect(stripped).not.toContain("open: 'never'");
		expect(stripped).not.toContain('forbidOnly');
		// ...while leaving the real code untouched.
		expect(stripped).toContain('testDir');
	});

	it('SELF-CHECK: line comments are stripped BEFORE block comments', () => {
		// The ordering trap `error-disclosure.guard.test.ts` had to learn. A line
		// comment mentioning a glob contains `/*` (here, `api/**`). Strip blocks
		// first and that `/*` opens a block which stays open until the NEXT `*/`
		// anywhere in the file — swallowing every real line in between, and
		// reading as a clean file rather than as an error.
		//
		// The fixture needs THREE things or it proves nothing: an unclosed `/*`
		// inside a line comment, real code after it, and a genuine block comment
		// LATER to supply the closing `*/`. The first version of this test had
		// only the first two — its `/*` closed on its own line — so it passed
		// under both orderings. Mutation-testing caught that; do not "simplify"
		// the fixture back down.
		const lineCommentOpensABlock = [
			'// route note: a glob like src/app/api/** is deliberately excluded',
			'export default { forbidOnly: !!process.env.CI }',
			'/* a genuine block comment, whose */ closes the one opened above */',
		].join('\n');

		expect(stripTsComments(lineCommentOpensABlock)).toContain('forbidOnly');
	});

	it('fails a run containing a stray `.only`', () => {
		// `forbidOnly` under CI is what stops a debugging `test.only` from
		// reducing the suite to one test and passing.
		expect(config).toMatch(/forbidOnly:\s*!!process\.env\.CI/);
	});

	it('boots its own server under CI rather than reusing one', () => {
		// `reuseExistingServer: !process.env.CI` — a reused server would be a
		// different build than the one under test.
		expect(config).toMatch(/reuseExistingServer:\s*!process\.env\.CI/);
	});

	it('gives each TEST more room under CI than locally', () => {
		// Distinct from the webServer ceiling below, and empirically the tighter
		// of the two: `globalSetup` warms public routes only, so an authenticated
		// spec pays for its route's first Turbopack compile inside its own test
		// timeout. The suite's first CI run reported `1 flaky` for exactly that.
		//
		// Property, not number: collapsing the ternary is the regression.
		//
		// Anchored to ONE leading tab, i.e. a top-level `defineConfig` key. There
		// are two `timeout:` keys in this file and an unanchored match silently
		// reads whichever comes first — so when this assertion was added, the
		// collapse mutation passed by matching `webServer.timeout` instead, and
		// the webServer assertion below started reading THIS one. Both were
		// vacuous at once. Same scoping lesson `jobBlock` encodes for the YAML.
		expectCiRoomierThanLocal(topLevelTimeout(config));
	});

	it('gives the dev server MORE boot room under CI than locally', () => {
		// `webServer.url` is polled until it answers, and answering `/` means
		// Turbopack has compiled it. A CI runner has no `.next` cache, so the
		// first compile is the slowest thing in the job — and a boot timeout
		// surfaces as "the dev server never came up", which reads as the app
		// being broken rather than slow, and takes the whole suite with it.
		//
		// The PROPERTY is pinned, not the number: 300_000 is a tuning value and
		// should be free to move, but collapsing the ternary back to a single
		// flat timeout is the regression worth catching.
		//
		// Sliced from `webServer:` onward. Unanchored, this matched the
		// TOP-LEVEL timeout the moment a second one was added — see the
		// per-test assertion above for the pair of vacuous tests that produced.
		expectCiRoomierThanLocal(webServerTimeout(config));
	});

	it('keeps the sequential route warmup wired as globalSetup', () => {
		// Removing it does not fail immediately — it fails intermittently, as a
		// manifest-race 500 reported against whichever route lost, which reads
		// as a flaky unrelated spec. That is precisely the shape that gets a
		// green suite declared flaky and ignored.
		expect(config).toMatch(/globalSetup:\s*['"]\.\/e2e\/global-setup\.ts['"]/);
	});
});
