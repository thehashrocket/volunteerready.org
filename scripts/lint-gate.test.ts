import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * `biome check` exits 0 on warn/info diagnostics. Only error-severity fails it.
 *
 * That is not a hypothetical: verified at 162fa5c, `pnpm lint` on `main` printed
 * `Found 3 warnings. Found 2 infos.` and exited 0, and the CI run for v0.41.0.0
 * printed `Found 3 warnings` and went green. Four real diagnostics sat on main
 * for months behind a lint step that looked like it was enforcing something —
 * including a `!` non-null assertion in `marketplace.ts` whose only automated
 * fix (`?.`) turns `string` into `string | undefined` and breaks `pnpm
 * typecheck`, so `--write --unsafe` would have reddened CI rather than helped.
 *
 * `--error-on-warnings` is the whole gate. Delete it and lint silently stops
 * failing on anything short of a syntax error — and nothing else in the suite
 * notices, because every other test asserts on application behavior rather than
 * on how the linter was invoked. Same class as `scripts/docs-nav-links.test.ts`:
 * a guard for config that the tool it configures cannot check itself.
 *
 * `check` carries the flag too, and the pairing with `--write` is deliberate
 * rather than redundant: `--write` applies every SAFE fix first, so the
 * pre-commit hook only ever blocks on diagnostics needing a human call — which
 * is precisely the class that accumulated, since all four had unsafe-only fixes.
 *
 * SCOPE is a SECOND, independent property, asserted below because the gate's
 * severity says nothing about its reach. `biome check .` is bounded by
 * `biome.json`'s `files.includes`, which omitted `scripts/**` from launch until
 * v0.41.1.0 — so the concierge importer, the admin-grant script and the token
 * re-encryption script were never linted at all. Verified by planting
 * `1 + "x"` in `scripts/import-roster.ts` and watching `pnpm lint` exit 0 while
 * reporting success. A rule that fires on nothing and a rule that fires loudly
 * over the wrong half of the repo look identical from CI's exit code, which is
 * why both halves are pinned here rather than trusted to the command string.
 */

const REPO_ROOT = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'..',
);

function readRepoJson<T>(relPath: string): T {
	return JSON.parse(readFileSync(path.join(REPO_ROOT, relPath), 'utf8')) as T;
}

function readRepoText(relPath: string): string {
	return readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
}

describe('Biome lint gate', () => {
	const { scripts } = readRepoJson<{ scripts: Record<string, string> }>(
		'package.json',
	);

	it('`lint` fails the build on warnings, not just errors', () => {
		expect(scripts.lint).toContain('--error-on-warnings');
	});

	it('`lint` still passes `.`, the widest path the config allows', () => {
		// `check` scopes to `src docs prisma/schema.prisma`; CI deliberately gates
		// on `biome check .`. Narrowing this to match `check` would drop the root
		// config files (biome.json, package.json, next.config.ts) out of CI's
		// scope — package.json formatting has already reddened CI once (#183).
		expect(scripts.lint).toMatch(/biome check\s+\./);
	});

	it('`check` fails the pre-commit hook on warnings', () => {
		expect(scripts.check).toContain('--error-on-warnings');
	});

	it('`check` keeps --write, so safe fixes never reach the human', () => {
		expect(scripts.check).toContain('--write');
	});

	it('CI actually runs the gated script', () => {
		// The flag is worthless if the workflow stops invoking `pnpm lint`, or
		// swaps it for a bare `biome check` that bypasses package.json entirely.
		expect(readRepoText('.github/workflows/ci.yml')).toMatch(
			/^\s*-\s*run:\s*pnpm lint\s*$/m,
		);
	});

	it('the pre-commit hook actually runs the gated script', () => {
		expect(readRepoText('.githooks/pre-commit')).toMatch(/^\s*pnpm check\s*$/m);
	});
});

describe('Biome lint scope', () => {
	const includes = readRepoJson<{ files: { includes: string[] } }>('biome.json')
		.files.includes;

	it('covers scripts/**, where the production-touching maintenance code lives', () => {
		// `scripts/` holds import-roster.ts (writes shadow users into a tenant and
		// emails them), admin-grant.ts (grants platform admin) and
		// reencrypt-tokens.ts (rewrites stored ciphertext). Dropping this entry
		// exempts all of them while `pnpm lint` still prints success.
		expect(includes).toContain('scripts/**');
	});

	it('still covers src/** and prisma/**, the paths CI relies on', () => {
		expect(includes).toContain('src/**');
		expect(includes).toContain('prisma/**/*.ts');
	});
});

describe('biome.json schema pin', () => {
	it('matches the INSTALLED Biome version', () => {
		// A stale `$schema` is itself a `deserialize` diagnostic, so under
		// --error-on-warnings a forgotten `biome migrate` after a version bump
		// now reddens CI (2.4.7 vs 2.4.12 is how this surfaced).
		//
		// Read the INSTALLED version, not package.json's range. Biome compares
		// the schema against the running CLI, and `pnpm update` inside `^2.4.12`
		// moves the lockfile without touching the range — so asserting the range
		// would demand 2.4.12 while lint demanded 2.4.15, a contradiction no edit
		// to biome.json could satisfy. node_modules is what actually runs, in CI
		// (`--frozen-lockfile`) and locally, so test and lint cannot disagree.
		const { $schema } = readRepoJson<{ $schema: string }>('biome.json');
		const { version } = readRepoJson<{ version: string }>(
			'node_modules/@biomejs/biome/package.json',
		);

		expect($schema).toBe(`https://biomejs.dev/schemas/${version}/schema.json`);
	});
});
