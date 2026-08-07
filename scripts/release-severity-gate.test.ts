import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	RELEASE_SEVERITY,
	RELEASE_SEVERITY_DECIDED_FOR,
	RELEASE_SEVERITY_VALUES,
} from '../src/server/domain/release';

/**
 * Guards the one property of `RELEASE_SEVERITY` a machine can actually check.
 *
 * WHAT THIS DOES NOT DO, stated first because the plan originally promised it
 * (decision 47) and it is not buildable: this does NOT make "an unpromoted
 * release visible rather than silent." No test can. A test can assert a field
 * holds one of two literals, or that a human touched it. It cannot assert that
 * a release was worth interrupting a coordinator over — that is a judgement
 * about the release's content, and a guard claiming otherwise would be a check
 * that fires on nothing while looking like enforcement.
 *
 * The promotion decision is therefore split (decision 51):
 *   - HUMAN: `/ship` asks at bump time, defaulted from the commit type, and the
 *     answer lands in the diff.
 *   - MACHINE: this file, which catches STALE CARRYOVER — the failure that is
 *     genuinely checkable. A `notice` set three releases ago keeps firing for
 *     every release after the one it announced, and a `silent` nobody has
 *     revisited since the feature shipped is indistinguishable from a decision.
 *     Pinning the severity to the version it was decided for makes both red.
 *
 * A per-release stamp was chosen over "assert the constant changed whenever
 * VERSION's minor changes" (decision 47's suggestion) because that suggestion
 * IS the version-derivation decision 34 explicitly rejected, wearing a test's
 * clothes. This asserts only that the answer belongs to this version, never
 * what the answer should be.
 *
 * Same class as `scripts/lint-gate.test.ts` and `scripts/ci-build-gate.test.ts`:
 * a guard for a property the tooling around it cannot see. `pnpm build`,
 * `pnpm lint` and the whole test suite are green with a two-release-old
 * severity in place.
 *
 * IF YOU ARE HERE BECAUSE THIS WENT RED after bumping VERSION: that is the
 * design. Open `src/server/domain/release.ts`, decide whether this release is
 * worth a coordinator's attention, and set both constants. Answering `silent`
 * is a perfectly good answer and will be the usual one — the point is that it
 * is answered rather than defaulted.
 */

const REPO_ROOT = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'..',
);

/**
 * Returns '' rather than throwing when the target is missing.
 *
 * `ci-build-gate.test.ts` learned this the hard way: a `throw` at module scope
 * runs at COLLECTION time, which takes the entire test file out of the run —
 * so the case where the guarded thing has been deleted, the single most
 * important case, reported zero failures instead of many.
 */
function readRepoText(relPath: string): string {
	try {
		return readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
	} catch {
		return '';
	}
}

const releaseSource = readRepoText('src/server/domain/release.ts');
const versionFile = readRepoText('VERSION').trim();

describe('release severity module', () => {
	it('is readable at the path the rest of the guard assumes', () => {
		// Self-check. Every assertion below is vacuous if this file moved and
		// `readRepoText` quietly returned '' — which is precisely the failure the
		// try/catch above introduces in exchange for surviving collection.
		expect(releaseSource).not.toBe('');
		expect(releaseSource).toContain('RELEASE_SEVERITY_DECIDED_FOR');
	});

	it('reads a non-empty VERSION file', () => {
		// Same reasoning: a missing VERSION would make the equality assertion
		// below compare '' to '', which passes while checking nothing.
		expect(versionFile).not.toBe('');
		expect(versionFile).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
	});

	it('holds one of exactly two severity literals', () => {
		expect(RELEASE_SEVERITY_VALUES).toEqual(['silent', 'notice']);
		expect(RELEASE_SEVERITY_VALUES).toContain(RELEASE_SEVERITY);
	});
});

describe('release severity is decided per release, not carried over', () => {
	it('is stamped for the version currently in VERSION', () => {
		// THE assertion this file exists for. Everything else is a self-check.
		expect(RELEASE_SEVERITY_DECIDED_FOR).toBe(versionFile);
	});

	it('stamps a full four-part version, not a prefix', () => {
		// `'0.41'` would satisfy a `startsWith` comparison against any release in
		// that minor, which is the stale carryover this file exists to prevent,
		// re-introduced through the stamp itself.
		expect(RELEASE_SEVERITY_DECIDED_FOR).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
	});
});

/**
 * Decision 45 says a client import of this module should be impossible rather
 * than merely discouraged. It justified that by placing the file under
 * `server/domain/**` — but with no `server-only` package in this repo, that
 * placement is a naming convention and nothing more. This is the enforcement
 * that makes the claim true.
 */
// `src/lib` is included because that is where the client HOOKS live —
// `use-app-update-check.ts` is a `'use client'` module and is exactly the kind
// of file that would reach for `RELEASE_SEVERITY`. Without it this guard had a
// hole in the one directory the feature's client code occupies, and a guard
// that cannot see the likeliest offender is not a guard.
const CLIENT_DIRECTORIES = ['src/components', 'src/app', 'src/lib'];
const RELEASE_IMPORT = /from\s+['"][^'"]*server\/domain\/release['"]/;

function importsReleaseModule(source: string): boolean {
	return RELEASE_IMPORT.test(source);
}

function isClientComponent(source: string): boolean {
	return /^\s*(['"])use client\1/m.test(source);
}

function walk(dir: string): string[] {
	const absolute = path.join(REPO_ROOT, dir);
	let entries: string[];
	try {
		entries = readdirSync(absolute);
	} catch {
		return [];
	}

	return entries.flatMap((entry) => {
		const relative = path.join(dir, entry);
		if (statSync(path.join(REPO_ROOT, relative)).isDirectory()) {
			return walk(relative);
		}
		return /\.tsx?$/.test(entry) ? [relative] : [];
	});
}

describe('release severity stays server-side', () => {
	const clientFiles = CLIENT_DIRECTORIES.flatMap(walk).filter((file) =>
		isClientComponent(readRepoText(file)),
	);

	it('actually found client components to check', () => {
		// Without this the suite below passes on an empty list forever — the
		// vacuous-guard trap `error-disclosure.guard.test.ts` records. If this
		// number ever drops to zero, the walk broke, not the codebase.
		expect(clientFiles.length).toBeGreaterThan(20);
	});

	it('detects the import shapes it claims to detect', () => {
		// The matcher's own self-check. A regex that silently stops matching is
		// indistinguishable from a codebase with no violations.
		expect(
			importsReleaseModule(
				`import { RELEASE_SEVERITY } from '@/server/domain/release';`,
			),
		).toBe(true);
		expect(
			importsReleaseModule(
				`import { RELEASE_SEVERITY } from '../../server/domain/release';`,
			),
		).toBe(true);
		expect(
			importsReleaseModule(`import type { X } from '@/server/domain/billing';`),
		).toBe(false);
	});

	it('is imported by no client component', () => {
		const offenders = clientFiles.filter((file) =>
			importsReleaseModule(readRepoText(file)),
		);
		expect(offenders).toEqual([]);
	});
});
