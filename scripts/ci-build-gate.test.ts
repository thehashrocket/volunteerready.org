import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * CI runs the deploy path, and every property that makes that gate work is
 * invisible to CI's own exit code.
 *
 * The gap this guards was not hypothetical: dependabot #193 (the TypeScript 7
 * bump, v0.41.8.0) went green on lint+typecheck, tests AND security advisories,
 * and still broke the Vercel deploy with "TypeScript 7.0.2 does not provide the
 * compiler API required by Next.js". `pnpm typecheck` is `tsc --noEmit`, which
 * invokes the compiler as a PROGRAM and passes on TS 7 either way; only
 * `next build` loads the compiler API. Delete the `build` job and that failure
 * class goes straight back to being caught by production — with a fully green
 * pipeline, because nothing else in the suite asserts on how CI is invoked.
 *
 * Same class as `scripts/lint-gate.test.ts` and `scripts/docs-nav-links.test.ts`:
 * a guard for config that the tool it configures cannot check itself.
 *
 * `scripts/vercel-build.sh` has three stages and the job gates the last two —
 * the production seed and the compile. Most of what is asserted below was
 * established EMPIRICALLY, by running the job's exact conditions locally with
 * every `.env*` file moved aside, because reading the code does not tell you
 * which of ~40 `process.env` reads actually fire during a build:
 *
 *   - A reachable, MIGRATED database is required. `/sitemap.xml` queries
 *     organizations during static export, so against a closed port the build
 *     aborts on Prisma P1001 at 69/92 pages. The rows may be empty, so for the
 *     compile alone the seed would be unnecessary — it is gated for its OWN
 *     sake, because a broken `seed-production.ts` breaks every deploy while
 *     leaving every other check green.
 *   - That seed must run the PRODUCTION branch. `prisma/seed.ts` dispatches on
 *     NODE_ENV, so a bare `pnpm seed` gates `seedDev()` — a branch that never
 *     deploys. Complete-looking, and worthless.
 *   - `RESEND_FROM_EMAIL` is the ONLY env var needed beyond the workflow's
 *     existing three. `getFromEmail()` throws at import and `server/auth.ts`
 *     calls it at module scope, so page-data collection for
 *     `/api/auth/[...nextauth]` fails the build without it.
 *   - The order is migrate → seed → build, and none of it may be made
 *     non-blocking.
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
 * Scoping matters: `pnpm prisma migrate deploy` also appears in the `test` job,
 * so a whole-file `toContain` would pass with the build job's own migrate step
 * deleted — which is exactly what a first, unscoped draft of this file did.
 *
 * Returns `''` rather than throwing when the job is missing. That is
 * load-bearing: this runs in the `describe` body, i.e. at COLLECTION time, so a
 * throw takes the whole file out of the run — and deleting the `build` job made
 * the suite report "8 files, 208 passed" with every assertion here silently
 * gone. An empty block makes each `it` fail on its own terms instead. Found by
 * mutation-testing this file, not by reading it.
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

describe('CI build gate', () => {
	const workflow = readRepoText('.github/workflows/ci.yml');
	const build = jobBlock(workflow, 'build');

	it('defines a job that compiles the app', () => {
		expect(build).not.toBe('');
	});

	it('runs `next build`, the only step that loads the TS compiler API', () => {
		expect(build).toMatch(/^\s*-\s*run:\s*pnpm next build\s*$/m);
	});

	it('does NOT run `pnpm build`, which branches on VERCEL_ENV', () => {
		// `pnpm build` is scripts/vercel-build.sh. The two stages worth gating
		// are run as explicit steps instead, so each fails on its own line —
		// and so the VERCEL_ENV branching (a production-only `migrate deploy`
		// and an email-collision pre-check that can only ever pass against an
		// empty ephemeral database) stays out of CI.
		expect(build).not.toMatch(/^\s*-\s*run:\s*pnpm build\s*$/m);
	});

	it('keeps the gate unconditional and blocking', () => {
		// Every other assertion here is a text-presence check, so a job that
		// still CONTAINS `pnpm next build` but never runs it — or runs it and
		// ignores the result — satisfies them all while the gate is gone. Both
		// spellings put the branch straight back into the failure this job
		// exists to close: a build break reaching Vercel behind a green CI run.
		// Raised by an adversarial cross-model pass, not by the checklist.
		expect(build).not.toMatch(/^\s*if:/m);
		expect(build).not.toMatch(/continue-on-error:\s*true/);
	});

	it('gives the build a database, because static export queries one', () => {
		// Not decoration: /sitemap.xml queries organizations during export, so
		// with no reachable DB the build dies on Prisma P1001 partway through
		// page generation.
		expect(build).toMatch(/image:\s*postgres:16-alpine/);
		expect(build).toMatch(/DATABASE_URL:/);
	});

	it('runs migrate → seed → build, in that order', () => {
		const migrate = build.indexOf('pnpm prisma migrate deploy');
		const seed = build.indexOf('run: pnpm seed');
		const compile = build.indexOf('pnpm next build');

		expect(migrate).toBeGreaterThan(-1);
		expect(seed).toBeGreaterThan(-1);
		expect(compile).toBeGreaterThan(-1);
		expect(migrate).toBeLessThan(seed);
		expect(seed).toBeLessThan(compile);
	});

	it('seeds the PRODUCTION branch, the one Vercel actually runs', () => {
		// `prisma/seed.ts` dispatches on NODE_ENV: without it the step runs
		// `seedDev()` (demo data) instead of `seedProduction()`, so the gate
		// covers a branch that never deploys while looking complete. A broken
		// `seed-production.ts` breaks every deploy and nothing else catches it.
		expect(build).toMatch(
			/run: pnpm seed\s*\n\s*env:\s*\n\s*NODE_ENV: production/,
		);
	});

	it('keeps NODE_ENV off the job, where it would break the install', () => {
		// Job-level NODE_ENV=production also applies to
		// `pnpm install --frozen-lockfile`, which then skips devDependencies —
		// taking `next` itself out of node_modules and failing the build for a
		// reason that has nothing to do with the code under test.
		const jobEnv = build.slice(
			build.indexOf('\n    env:'),
			build.indexOf('\n    steps:'),
		);
		expect(jobEnv).not.toContain('NODE_ENV');
	});

	it('sets RESEND_FROM_EMAIL, without which page-data collection fails', () => {
		// `getFromEmail()` throws at import and `server/auth.ts` calls it at
		// module scope, so /api/auth/[...nextauth] fails to collect page data.
		// This is the one env var the build needs beyond the workflow's three.
		expect(build).toMatch(/RESEND_FROM_EMAIL:/);
	});

	it('keeps RESEND_FROM_EMAIL scoped to the build job', () => {
		// At workflow level it would leak into the `test` job, where a spec that
		// observes the variable being ABSENT would silently change meaning.
		const workflowEnv = workflow.slice(0, workflow.indexOf('\njobs:'));
		expect(workflowEnv).not.toContain('RESEND_FROM_EMAIL');
	});
});

describe('TypeScript 7 build-compiler flag', () => {
	it('keeps useTypeScriptCli while TypeScript 7+ is installed', () => {
		// TS 7 is the native Go port and ships no `lib/typescript.js`, so Next
		// cannot load the JS compiler API it type-checks builds with.
		//
		// The `build` job above does NOT catch the removal of this flag: as of
		// Next 16.3 the CLI checker is the DEFAULT, so deleting the line builds
		// green TODAY and breaks only when a future Next flips the default back
		// — by which time nothing connects the failure to this edit. The value
		// we need is not the one we would get by accident, which is why the flag
		// is explicit and why this assertion exists.
		//
		// Read the INSTALLED major, not package.json's range: a lockfile-only
		// bump moves what actually runs without touching the range. When this
		// repo moves off TS 7 the guard retires itself.
		const { version } = JSON.parse(
			readRepoText('node_modules/typescript/package.json'),
		) as { version: string };
		const major = Number.parseInt(version.split('.')[0] ?? '0', 10);

		if (major < 7) return;

		expect(readRepoText('next.config.ts')).toMatch(/useTypeScriptCli:\s*true/);
	});
});
