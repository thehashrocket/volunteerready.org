import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * `/api/version` has three properties that are invisible to every other check
 * in this repo, and each one fails SILENTLY.
 *
 * 1. CACHEABILITY (decision 8). A CDN-cached version endpoint returns a stale
 *    build id forever. The comparison then always matches, the prompt never
 *    fires, and nothing errors — which is exactly how `SwUpdateBanner` stayed
 *    dead for eight releases. `pnpm build`, `pnpm lint` and the whole test
 *    suite are green with the caching headers removed.
 *
 * 2. IMPORT WEIGHT (decision 15). This is the most-invoked route in the app.
 *    One `import { getServerSession }` added to log who's checking pulls
 *    next-auth and Prisma into a function that does no I/O, and nothing
 *    anywhere objects.
 *
 * 3. PROVENANCE OF THE BUILD ID (decision 50). If this handler reads
 *    `process.env` instead of importing `BUILD_ID`, a prebuilt deploy makes
 *    the client's baked fallback and the server's runtime value disagree
 *    permanently — prompting every user forever. That is the single worst
 *    outcome available to this feature, and the code that causes it looks
 *    completely reasonable.
 *
 * Asserted against the SOURCE rather than by importing the module: the point
 * is what the file is allowed to contain, and an import-time assertion cannot
 * see an import that was added but tree-shaken, nor a `process.env` read
 * sitting on a branch this test does not execute.
 *
 * Same class as `scripts/lint-gate.test.ts` and `scripts/ci-build-gate.test.ts`.
 */

const REPO_ROOT = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'..',
);

function readRepoText(relPath: string): string {
	try {
		return readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
	} catch {
		// Never throw at module scope — a collection-time throw takes the whole
		// file out of the run, so a DELETED route would report zero failures.
		return '';
	}
}

const ROUTE_PATH = 'src/app/api/version/route.ts';
const source = readRepoText(ROUTE_PATH);

/** Strips comments so this file's own prose cannot satisfy an assertion. */
function stripComments(text: string): string {
	// Line comments FIRST: a `//` comment containing `/*` (a glob, a URL) would
	// otherwise open a block the second pass never closes, swallowing real code
	// and producing a false pass. `error-disclosure.guard.test.ts` had to learn
	// this ordering the hard way.
	return text.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

const code = stripComments(source);

const IMPORT_LINE = /^\s*import\s[\s\S]*?from\s+['"]([^'"]+)['"]/gm;

/**
 * The only modules this route may reach. Both are leaf constant modules.
 * Adding to this list is a deliberate act with a review attached — which is
 * the whole point.
 */
const ALLOWED_IMPORTS = new Set([
	'@/lib/app-version',
	'@/server/domain/release',
]);

describe('/api/version source', () => {
	it('exists at the path the rest of this file assumes', () => {
		// Self-check: `readRepoText` returns '' on a missing file, which would
		// make every assertion below vacuous.
		expect(source).not.toBe('');
		expect(source).toContain('export function GET');
	});
});

describe('/api/version cannot be cached', () => {
	it('declares force-dynamic', () => {
		expect(code).toMatch(
			/export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/,
		);
	});

	it('sends Cache-Control: no-store', () => {
		expect(code).toMatch(/['"]Cache-Control['"]\s*:\s*['"]no-store['"]/);
	});

	it('is not exempted in development', () => {
		// `pnpm e2e` boots `pnpm dev`, so a dev exemption would make this
		// control inert in the only automated environment that drives real
		// HTTP against it — the same reasoning as T37's errorFormatter.
		expect(code).not.toMatch(/NODE_ENV|process\.env\.VERCEL_ENV/);
	});
});

describe('/api/version stays import-light', () => {
	const imported = [...code.matchAll(IMPORT_LINE)].map((match) => match[1]);

	it('found the imports it means to check', () => {
		// Without this, deleting every import (or breaking the regex) reads as
		// "no forbidden imports" and passes.
		expect(imported.length).toBeGreaterThan(0);
	});

	it('imports only the allowed constant modules', () => {
		const disallowed = imported.filter((name) => !ALLOWED_IMPORTS.has(name));
		expect(disallowed).toEqual([]);
	});

	it('reaches no server infrastructure', () => {
		// Belt and braces against a require(), a dynamic import(), or an alias
		// that resolves somewhere heavy without matching the import regex.
		expect(code).not.toMatch(/next-auth|getServerSession|prisma|Repo\b/i);
	});
});

describe('/api/version derives the build id from the shared constant', () => {
	it('imports BUILD_ID', () => {
		expect(code).toMatch(/import\s*\{[^}]*\bBUILD_ID\b[^}]*\}/);
	});

	it('does not read process.env itself', () => {
		// Decision 50. A runtime read here disagrees with the client's
		// build-time fallback on a prebuilt deploy and prompts everyone forever.
		expect(code).not.toMatch(/process\.env/);
	});
});
