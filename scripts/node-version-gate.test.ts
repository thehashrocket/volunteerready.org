import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guards the Node version, which is declared in THREE places that must agree
 * and which nothing else compares — plus a FOURTH that nothing declares at all:
 * the floor the dependency tree actually requires.
 *
 * - `.nvmrc` (`24.16`) — what a developer's shell picks, and what all five CI
 *   jobs resolve through `node-version-file`.
 * - `package.json` `engines.node` (`24.x`) — what VERCEL builds and runs on.
 * - `.github/workflows/ci.yml` — five `actions/setup-node` steps.
 * - `pnpm-lock.yaml` — packages declaring their own `engines.node` floors.
 *
 * WHY `engines` EXISTS AT ALL. Without it Vercel picks "the latest Node LTS
 * available on Vercel", which is a MOVING DEFAULT. It happened to be 24 the day
 * this landed, so local, CI and production agreed by coincidence rather than by
 * declaration. The day Vercel promotes the next LTS, production moves to a Node
 * major the test suite has never run on, `.nvmrc` still says 24, and nothing in
 * the repo notices — the failure surfaces as a production-only runtime error
 * with a green CI. `engines.node` overrides both the project setting and the
 * platform default, which is what turns that coincidence into a guarantee.
 *
 * `engines` is ADVISORY LOCALLY, and that is fine. Verified by execution: with
 * `engines.node` set to `99.x`, `pnpm install` prints `WARN Unsupported engine`
 * and exits 0 — there is no `.npmrc`, so `engine-strict` is at its default of
 * false. A contributor on Node 22 gets a nudge, not a wall. Vercel is where it
 * binds.
 *
 * WHY THIS TEST EXISTS. `engines` is the fix, and it is exactly the kind of fix
 * that rots: it is one line of JSON that nothing reads back. Adding it while
 * leaving `.nvmrc` free to move independently trades a repo-vs-Vercel drift for
 * an `.nvmrc`-vs-`engines` drift, which is the same bug one layer down and
 * harder to see, because BOTH halves live in the repo and both look
 * authoritative.
 *
 * WHY THE MAJOR COMPARISON IS NOT ENOUGH — found by an adversarial cross-model
 * pass, after the first version of this file shipped with only the major check.
 * Real floors live INSIDE the major: `@babel/core@8.0.1` declares
 * `^22.18.0 || >=24.11.0` and `jsdom@30.0.1` declares
 * `^22.22.2 || ^24.15.0 || >=26.0.0`. `24.16` clears both, but a major-only
 * guard stays green at `.nvmrc` `24.0.0`, where `pnpm install` warns and the
 * jsdom-backed component tests are running on a runtime their own package
 * refuses. So the lockfile's own declarations are the fourth check.
 *
 * Same class as `lint-gate.test.ts`, `ci-build-gate.test.ts` and
 * `pnpm-overrides.test.ts`: root config the tooling cannot check itself. It
 * hand-rolls its version parsing for the same reason `pnpm-overrides.test.ts`
 * does — `semver` is not a top-level dependency and is not worth adding for one
 * guard test.
 *
 * DELIBERATELY NOT ASSERTED: the exact major. Pinning `24` here would mean a
 * Node upgrade has to edit this file to describe itself, which is a tautology,
 * not a check. What matters is that the declarations AGREE and clear the tree's
 * floor — the upgrade is then a two-file change this test verifies, rather than
 * a one-file change it blesses.
 *
 * KNOWN LIMIT of the floor scan: it only reads clauses naming `.nvmrc`'s OWN
 * major. A package requiring `>=26` with no 24-compatible clause is
 * unsatisfiable on Node 24 and this test will not say so — `pnpm install`'s
 * engine warning is what surfaces that.
 *
 * If you are here because this test went red on a Node upgrade: that is
 * correct. Update `.nvmrc` and `engines.node` together, and confirm the new
 * major is one Vercel actually offers
 * (https://vercel.com/docs/functions/runtimes/node-js/node-js-versions) —
 * `engines` naming a major Vercel does not support fails the BUILD, which this
 * test cannot see.
 */

const repoRoot = path.resolve(__dirname, '..');

const pkg = JSON.parse(
	readFileSync(path.join(repoRoot, 'package.json'), 'utf8'),
) as { engines?: { node?: string } };

const nvmrc = readFileSync(path.join(repoRoot, '.nvmrc'), 'utf8').trim();

const lockfile = readFileSync(path.join(repoRoot, 'pnpm-lock.yaml'), 'utf8');

/**
 * `ci.yml` with `#` comments stripped.
 *
 * Scanning raw YAML is brittle in BOTH directions and this repo has already
 * learned it twice (`lint-gate.test.ts`, `e2e-ci-gate.test.ts`): a commented-out
 * `# node-version: 22` would trip the hardcode check as a false failure, and a
 * commented `# node-version-file: ".nvmrc"` would pad the count and mask a real
 * one. Only whole-line comments are stripped — a `#` inside a quoted YAML
 * scalar is not a comment, and none of the patterns below live in one.
 */
const workflow = readFileSync(
	path.join(repoRoot, '.github', 'workflows', 'ci.yml'),
	'utf8',
)
	.split('\n')
	.filter((line) => !/^\s*#/.test(line))
	.join('\n');

/** Leading numeric major of a version-ish string, or NaN. */
function major(version: string): number {
	const m = /^v?(\d+)\b/.exec(version.trim());
	return m ? Number.parseInt(m[1], 10) : Number.NaN;
}

/** `[major, minor, patch]`, missing segments as 0. NaN major if unparseable. */
function parts(version: string): [number, number, number] {
	const m = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(version.trim());
	if (!m) return [Number.NaN, 0, 0];
	return [
		Number.parseInt(m[1], 10),
		m[2] ? Number.parseInt(m[2], 10) : 0,
		m[3] ? Number.parseInt(m[3], 10) : 0,
	];
}

/** -1 / 0 / 1 over `[major, minor, patch]`. */
function compare(a: [number, number, number], b: [number, number, number]) {
	for (let i = 0; i < 3; i++) {
		if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
	}
	return 0;
}

/**
 * The highest Node version any package in the lockfile requires, considering
 * only clauses that name `targetMajor`.
 *
 * A range like `^22.18.0 || >=24.11.0` contributes `24.11.0` when targeting 24
 * and nothing when targeting 22... which is wrong for 22 in the abstract, but
 * this only ever runs against `.nvmrc`'s own major, so the `^22` clause is not
 * ours to evaluate. Returns null when nothing in the tree names the major.
 */
function highestFloorForMajor(
	source: string,
	targetMajor: number,
): { version: [number, number, number]; range: string } | null {
	let best: { version: [number, number, number]; range: string } | null = null;

	for (const m of source.matchAll(/engines:\s*\{[^}]*node:\s*([^,}]+)/g)) {
		const range = m[1].trim().replace(/^['"]|['"]$/g, '');
		for (const rawClause of range.split('||')) {
			const clause = rawClause.trim();
			const parsed = /^(\^|>=|~)?\s*(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(
				clause,
			);
			if (!parsed) continue;
			if (Number.parseInt(parsed[2], 10) !== targetMajor) continue;
			const version: [number, number, number] = [
				targetMajor,
				parsed[3] ? Number.parseInt(parsed[3], 10) : 0,
				parsed[4] ? Number.parseInt(parsed[4], 10) : 0,
			];
			if (!best || compare(version, best.version) > 0) {
				best = { version, range };
			}
		}
	}
	return best;
}

describe('Node version declarations agree', () => {
	it('package.json declares engines.node', () => {
		// Without this, Vercel silently follows its own moving "latest LTS"
		// default and production can land on a major CI never exercised.
		expect(pkg.engines?.node).toBeTruthy();
	});

	it('engines.node is the `<major>.x` form', () => {
		// NOT because other spellings are invalid — `24` and `^24.0.0` are both
		// legal semver and Vercel resolves all of them to the newest 24.x. It is
		// house style with a mechanical reason: `major()` below parses a leading
		// digit, so `^24.0.0` would read as NaN and fail with a confusing message
		// rather than an honest one. One spelling, and it is the one Vercel's own
		// docs table uses.
		expect(pkg.engines?.node).toMatch(/^\d+\.x$/);
	});

	it('.nvmrc and engines.node name the same major', () => {
		const nvmrcMajor = major(nvmrc);
		const enginesMajor = major(pkg.engines?.node ?? '');

		expect(Number.isNaN(nvmrcMajor), `.nvmrc unparseable: "${nvmrc}"`).toBe(
			false,
		);
		expect(
			enginesMajor,
			`.nvmrc says Node ${nvmrcMajor} but package.json engines.node says ` +
				`"${pkg.engines?.node}". Local/CI and production would run different ` +
				'Node majors. Update both together.',
		).toBe(nvmrcMajor);
	});

	it('.nvmrc clears the highest Node floor the lockfile declares', () => {
		// The major check above cannot see this: `jsdom@30.0.1` wants
		// `^24.15.0`, so `.nvmrc` of `24.0.0` agrees with `engines: 24.x`
		// perfectly and still runs the component suite on a refused runtime.
		const nvmrcMajor = major(nvmrc);
		const floor = highestFloorForMajor(lockfile, nvmrcMajor);

		expect(
			floor,
			`No package in pnpm-lock.yaml declares a Node ${nvmrcMajor} floor. ` +
				'Either the lockfile format changed or the scan broke — this ' +
				'assertion is worthless if it matches nothing.',
		).not.toBeNull();

		if (!floor) return;
		expect(
			compare(parts(nvmrc), floor.version) >= 0,
			`.nvmrc is ${nvmrc} but the tree requires at least ` +
				`${floor.version.join('.')} (from "${floor.range}"). Raise .nvmrc.`,
		).toBe(true);
	});

	it('every CI job resolves Node from .nvmrc, never a hardcoded version', () => {
		// A hardcoded `node-version:` in one job is invisible in CI's own exit
		// code — that job just quietly tests a different runtime than the other
		// four and than production. Quotes around `.nvmrc` are optional: YAML
		// accepts a bare scalar and requiring quotes would be a false failure.
		const setupNodeCount = workflow.match(/actions\/setup-node/g)?.length ?? 0;
		const fromFileCount =
			workflow.match(/node-version-file:\s*['"]?\.nvmrc['"]?/g)?.length ?? 0;

		expect(
			setupNodeCount,
			'no setup-node steps found in ci.yml',
		).toBeGreaterThan(0);
		expect(
			fromFileCount,
			`${setupNodeCount} setup-node steps but only ${fromFileCount} read .nvmrc`,
		).toBe(setupNodeCount);
		expect(
			/^\s*node-version:/m.test(workflow),
			'ci.yml hardcodes a node-version instead of reading .nvmrc',
		).toBe(false);
	});

	// -------------------------------------------------------------------------
	// Self-checks. Every assertion above is a positive match against real files,
	// so a parsing bug that made these functions return a constant would turn
	// the comparisons green regardless of what the files say. The floor scan in
	// particular is fed a SYNTHETIC lockfile, which is the only oracle the real
	// files cannot supply — against the real lockfile, any hardcoded answer is
	// by construction a version the lockfile contains.
	// -------------------------------------------------------------------------
	describe('major() self-check', () => {
		it.each([
			['24.16', 24],
			['24.x', 24],
			['v24.16.0', 24],
			['26', 26],
			['', Number.NaN],
			['lts/*', Number.NaN],
			['^24.0.0', Number.NaN],
		])('%s -> %s', (input, expected) => {
			const result = major(input);
			if (Number.isNaN(expected)) {
				expect(Number.isNaN(result)).toBe(true);
			} else {
				expect(result).toBe(expected);
			}
		});

		it('distinguishes two different majors', () => {
			expect(major('24.16')).not.toBe(major('26.0'));
		});
	});

	describe('compare() self-check', () => {
		it.each([
			[[24, 16, 0], [24, 15, 0], 1],
			[[24, 15, 0], [24, 16, 0], -1],
			[[24, 16, 0], [24, 16, 0], 0],
			[[24, 2, 0], [24, 10, 0], -1], // numeric, not lexicographic
			[[24, 0, 0], [24, 0, 1], -1],
		])('%s vs %s -> %s', (a, b, expected) => {
			expect(
				compare(a as [number, number, number], b as [number, number, number]),
			).toBe(expected);
		});
	});

	describe('highestFloorForMajor() self-check', () => {
		const fixture = [
			'  a@1.0.0:',
			"    engines: {node: '>=6.9.0'}",
			'  b@2.0.0:',
			'    engines: {node: ^22.18.0 || >=24.11.0}',
			'  c@3.0.0:',
			'    engines: {node: ^22.22.2 || ^24.15.0 || >=26.0.0}',
			'  d@4.0.0:',
			'    engines: {node: >=26.0.0}',
		].join('\n');

		it('takes the highest clause naming the target major', () => {
			expect(highestFloorForMajor(fixture, 24)?.version).toEqual([24, 15, 0]);
		});

		it('reads the OTHER major independently', () => {
			// Proves it filters by major rather than returning one cached answer.
			expect(highestFloorForMajor(fixture, 22)?.version).toEqual([22, 22, 2]);
		});

		it('returns null when no clause names the major', () => {
			expect(highestFloorForMajor(fixture, 18)).toBeNull();
		});

		it('parses the version out of the TEXT, not from anywhere else', () => {
			// A degenerate implementation returning [24,15,0] for everything would
			// satisfy the first case; this one it cannot.
			const bumped = fixture.replace('^24.15.0', '^24.99.1');
			expect(highestFloorForMajor(bumped, 24)?.version).toEqual([24, 99, 1]);
		});
	});
});
