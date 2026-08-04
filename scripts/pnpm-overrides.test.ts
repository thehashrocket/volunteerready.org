import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guards `pnpm.overrides` in package.json against the two ways it rots.
 *
 * An override is a standing instruction to resolve some transitive package at a
 * version other than the one its parent asked for. Nothing in the toolchain
 * checks that the instruction still refers to anything, or that it is doing
 * what its author intended — `pnpm install` is equally happy either way, and
 * both failure modes below were live in this repo when this file was written.
 *
 * 1. DEAD OVERRIDES. `hono` and `@hono/node-server` were overridden because
 *    `@prisma/dev` depended on them. Prisma 7.9.1 swapped that library out for
 *    `find-my-way`, so both packages left the tree and the two overrides became
 *    instructions about nothing — still read as active policy, still surviving
 *    every review, and quietly misleading anyone auditing which packages the
 *    project constrains.
 *
 * 2. OVERRIDES THAT CAP BELOW THE FIX — the one that did real harm.
 *    `@hono/node-server` was pinned `^1.19.13`. Its advisory's first patched
 *    version was **2.0.5**, which a `^1` range can never reach. So an override
 *    written to keep a package safe was the exact reason it could not be
 *    patched, and nothing about reading `"^1.19.13"` suggests that. This test
 *    cannot know advisory data, but it CAN prove each override actually binds
 *    the installed version — which is what makes the range visible as policy
 *    rather than decoration, so a human reviewing it is reviewing the truth.
 *
 * Deliberately NOT asserted: that an override is still *necessary*. A package
 * can legitimately be overridden to a version its parent would have chosen
 * anyway, as belt-and-braces against a future parent bump. Requiring divergence
 * would fail on correct configuration.
 *
 * Sits in `scripts/` beside `lint-gate.test.ts` and `docs-nav-links.test.ts` —
 * the established home for guarding root config the tooling cannot check
 * itself.
 *
 * This file checks that the overrides are COHERENT, not that they are
 * justified. The missing half — a written rationale per override, without which
 * none of them can be safely changed or safely deleted — is the P2 in
 * `docs/TODOS.md` under the Dependabot security review heading.
 */

const repoRoot = path.resolve(__dirname, '..');

const pkg = JSON.parse(
	readFileSync(path.join(repoRoot, 'package.json'), 'utf8'),
) as { pnpm?: { overrides?: Record<string, string> } };

const overrides = pkg.pnpm?.overrides ?? {};

const lockfile = readFileSync(path.join(repoRoot, 'pnpm-lock.yaml'), 'utf8');

/**
 * Every version of `name` present in the lockfile's `packages:` section.
 *
 * Entries look like `  '@scope/name@1.2.3':` or `  name@1.2.3:`, and a version
 * may carry a peer-resolution suffix in parentheses, which is stripped. Parsing
 * by hand because neither `yaml` nor `semver` is a top-level dependency and
 * neither is worth adding for one guard test.
 */
function installedVersions(name: string): string[] {
	const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const re = new RegExp(`^ {2}'?${escaped}@([^'():\\s]+)`, 'gm');
	const found = new Set<string>();
	for (const m of lockfile.matchAll(re)) found.add(m[1]);
	return [...found];
}

/** -1 / 0 / 1, comparing dotted numeric versions left to right. */
function compareVersions(a: string, b: string): number {
	const pa = parseVersion(a);
	const pb = parseVersion(b);
	for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
		const x = pa[i] ?? 0;
		const y = pb[i] ?? 0;
		if (Number.isNaN(x) || Number.isNaN(y)) return Number.NaN;
		if (x !== y) return x < y ? -1 : 1;
	}
	return 0;
}

/**
 * Strictly numeric `major.minor.patch`. A segment that is not all digits yields
 * NaN rather than a lenient prefix — `Number.parseInt('0-alpha', 10)` returns
 * 0, which would silently read the pre-release `8.0.0-alpha.1` as the stable
 * `8.0.0` and let it pass a range it does not really satisfy. Every caller
 * treats NaN as "does not satisfy", so an unparseable version SURFACES as
 * escaping rather than being quietly accepted.
 */
function parseVersion(v: string): number[] {
	return v
		.split('.')
		.map((n) => (/^\d+$/.test(n) ? Number.parseInt(n, 10) : Number.NaN));
}

/**
 * Minimal `^`/`~`/exact check. Ranges in this file are simple by convention.
 *
 * CARET IS NOT "SAME MAJOR". For a 0.x major, npm bounds `^` by MINOR
 * (`^0.28.1` is `>=0.28.1 <0.29.0`) and for 0.0.x by PATCH (`^0.0.3` is exactly
 * 0.0.3), because a 0.x minor bump is allowed to break. Treating `^0.28.1` as
 * "any 0.x" was the first version of this function and it mattered: `esbuild`
 * is overridden `^0.28.1` and is the only 0.x entry in the map, so a second
 * peer-duplicated resolution at 0.30.0 would have been waved through as
 * in-range instead of surfacing as a new escape — the exact silent regression
 * this file exists to catch.
 */
function satisfies(version: string, range: string): boolean {
	const [vMaj, vMin, vPat] = parseVersion(version);
	if ([vMaj, vMin, vPat].some(Number.isNaN)) return false;

	const operator = range.startsWith('^')
		? '^'
		: range.startsWith('~')
			? '~'
			: '';
	const [rMaj, rMin, rPat] = parseVersion(range.slice(operator.length));
	if ([rMaj, rMin, rPat].some(Number.isNaN)) return false;

	const atLeastFloor =
		vMaj > rMaj ||
		(vMaj === rMaj && vMin > rMin) ||
		(vMaj === rMaj && vMin === rMin && vPat >= rPat);
	if (!atLeastFloor) return false;

	if (operator === '^') {
		if (rMaj > 0) return vMaj === rMaj;
		if (rMin > 0) return vMaj === 0 && vMin === rMin;
		return vMaj === 0 && vMin === 0 && vPat === rPat;
	}
	if (operator === '~') return vMaj === rMaj && vMin === rMin;
	return vMaj === rMaj && vMin === rMin && vPat === rPat;
}

describe('pnpm.overrides', () => {
	it('declares at least one override (the guard is not scanning an empty set)', () => {
		// Without this, deleting the whole block turns every test below green.
		expect(Object.keys(overrides).length).toBeGreaterThan(0);
	});

	it.each(
		Object.keys(overrides),
	)('%s is still present in the dependency tree', (name) => {
		// A dead override reads as active policy while constraining nothing.
		expect(installedVersions(name)).not.toHaveLength(0);
	});

	/**
	 * Overrides that are KNOWN not to fully bind, with the extra versions each
	 * one currently lets through.
	 *
	 * This is a budget, not a mute: the exact set of escaping versions is
	 * listed, so a NEW escape under the same package still fails. Same shape as
	 * the per-file counts in `error-disclosure.guard.test.ts`, and for the same
	 * reason — a blanket exemption would hide the next instance.
	 *
	 * Both entries are PRE-EXISTING and were surfaced by writing this test, not
	 * caused by v0.41.5.0. Verified physically present under
	 * `node_modules/.pnpm/` with real contents, so this is not a stale lockfile
	 * record — the override genuinely does not cover them. Both arrive as peer
	 * dependency resolutions (`next@16.2.12(@babel/core@8.0.1)`,
	 * `@storybook/react-vite@...(vite@8.1.0...)`) rather than as ordinary
	 * dependency edges; `@storybook/react-vite` accepts `^5 || ^6 || ^7 || ^8`
	 * and pnpm took 8.
	 *
	 * Neither package has an open advisory, so this is a correctness problem
	 * rather than a security one: two overrides read as constraining something
	 * they do not fully constrain. Tracked as a P2 TODO. Do NOT "fix" this by
	 * widening the ranges to `^8` — that would make the file agree with reality
	 * while abandoning whatever the original pin was defending against, which
	 * nobody ever recorded.
	 */
	const PARTIALLY_BOUND: Record<string, string[]> = {
		'@babel/core': ['8.0.1'],
		vite: ['8.1.0'],
	};

	it.each(
		Object.entries(overrides),
	)('%s resolves to a version satisfying its own range (%s)', (name, range) => {
		// Proves the override actually binds, so the range a reviewer reads is
		// the range in force — the property that would have made the
		// `@hono/node-server` cap visible for what it was.
		const tolerated = PARTIALLY_BOUND[name] ?? [];
		const escaping = installedVersions(name).filter(
			(v) => !satisfies(v, range),
		);

		expect(
			escaping.sort(),
			`${name} override "${range}" does not cover: ${escaping.join(', ')}`,
		).toEqual([...tolerated].sort());
	});

	it('every PARTIALLY_BOUND entry is still overridden and still escaping', () => {
		// Keeps the budget honest in both directions: an entry whose override was
		// deleted, or which now binds cleanly, must be removed from the list
		// rather than left as permanent noise.
		for (const [name, versions] of Object.entries(PARTIALLY_BOUND)) {
			expect(
				overrides,
				`${name} is listed but no longer overridden`,
			).toHaveProperty(name);
			const escaping = installedVersions(name).filter(
				(v) => !satisfies(v, overrides[name]),
			);
			expect(
				escaping.sort(),
				`${name} now binds cleanly — delete it from PARTIALLY_BOUND`,
			).toEqual([...versions].sort());
		}
	});

	/**
	 * Overrides that exist SPECIFICALLY to close a Dependabot advisory, with the
	 * advisory's own first-patched version and alert number.
	 *
	 * The range check above cannot see this class of regression: lowering
	 * `fast-uri` from `^3.1.5` back to `^3.0.1` leaves 3.1.5 installed and
	 * satisfying its range, so every other assertion in this file stays green
	 * while the floor that guarantees the fix is gone — verified by mutation.
	 * The next lockfile churn is then free to resolve back to a vulnerable
	 * version with nothing objecting.
	 *
	 * This is deliberately a small hand-maintained list, not a live advisory
	 * feed: it records the reason these three overrides were written, which is
	 * the thing that was missing when `@hono/node-server` was capped below its
	 * own fix. A real API-backed gate is a separate, larger piece of work.
	 */
	const SECURITY_FLOORS: Record<string, { minimum: string; alerts: string }> = {
		'fast-uri': { minimum: '3.1.5', alerts: '#97, #98, #118' },
		postcss: { minimum: '8.5.23', alerts: '#113, #117' },
		'brace-expansion': { minimum: '5.0.9', alerts: '#115, #116' },
	};

	it.each(
		Object.entries(SECURITY_FLOORS),
	)('%s stays at or above its advisory floor', (name, { minimum, alerts }) => {
		expect(overrides, `${name} override was removed`).toHaveProperty(name);

		for (const version of installedVersions(name)) {
			expect(
				satisfies(version, minimum) || compareVersions(version, minimum) >= 0,
				`${name}@${version} is below the fix for ${alerts} (needs >= ${minimum})`,
			).toBe(true);
		}
	});

	it('no longer overrides the packages Prisma 7.9.1 removed', () => {
		// Explicit regression pin for the two deleted in v0.41.5.0. Re-adding
		// either without a dependent puts back an instruction about nothing —
		// and, in @hono/node-server's case, one that capped below its own fix.
		expect(overrides).not.toHaveProperty('hono');
		expect(overrides).not.toHaveProperty('@hono/node-server');
	});

	// -------------------------------------------------------------------------
	// Self-check: the version matcher is hand-rolled, so a bug in it would make
	// every assertion above pass vacuously.
	// -------------------------------------------------------------------------
	describe('satisfies() self-check', () => {
		it.each([
			['8.5.25', '^8.5.23', true],
			['8.5.22', '^8.5.23', false],
			['9.0.0', '^8.5.23', false],
			['16.2.12', '~16.2.12', true],
			['16.2.13', '~16.2.12', true],
			['16.3.0', '~16.2.12', false],
			['3.1.5', '^3.1.5', true],
			['3.1.4', '^3.1.5', false],
			['8.11.11', '8.11.11', true],
			['8.11.12', '8.11.11', false],

			// 0.x caret — npm bounds by MINOR, not major. `esbuild` is `^0.28.1`.
			['0.28.1', '^0.28.1', true],
			['0.28.9', '^0.28.1', true],
			['0.29.0', '^0.28.1', false], // "same major" would wrongly allow this
			['0.30.0', '^0.28.1', false],
			['0.28.0', '^0.28.1', false],
			// 0.0.x caret — bounded by PATCH.
			['0.0.3', '^0.0.3', true],
			['0.0.4', '^0.0.3', false],

			// Pre-release must not be read as its stable prefix.
			['8.0.0-alpha.1', '^8.0.0', false],
			['0.29.0-rc.1', '^0.28.1', false],
		])('%s vs %s → %s', (version, range, expected) => {
			expect(satisfies(version, range)).toBe(expected);
		});
	});

	describe('compareVersions() self-check', () => {
		it.each([
			['3.1.5', '3.1.5', 0],
			['3.1.6', '3.1.5', 1],
			['3.1.4', '3.1.5', -1],
			['3.2.0', '3.10.0', -1], // numeric, not lexicographic
			['4.0.0', '3.99.99', 1],
			['8.5.25', '8.5.23', 1],
		])('%s vs %s → %s', (a, b, expected) => {
			expect(compareVersions(a, b)).toBe(expected);
		});
	});

	describe('installedVersions() self-check', () => {
		it('finds a package known to be in the lockfile', () => {
			expect(installedVersions('next')).toContain('16.2.12');
		});

		it('does not match a package that only appears as a name prefix', () => {
			// `next` must not match `next-auth@...`. Without the `@` boundary the
			// dead-override check would pass for almost any string.
			expect(installedVersions('next')).not.toContain('4.24.15');
		});

		it('returns nothing for a package that is not installed', () => {
			expect(installedVersions('hono')).toHaveLength(0);
		});
	});
});
