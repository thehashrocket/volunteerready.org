import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * THE REGRESSION FOR THE BUG THIS WHOLE FEATURE STARTED FROM.
 *
 * `SwUpdateBanner` shipped in v0.28.0.0, was mounted globally in the root
 * layout, and got the question backwards in both directions:
 *
 *   FIRST VISIT (no controller yet)         DEPLOY N+1 (sw.js unchanged)
 *     register('/sw.js')                      browser byte-compares /sw.js
 *     install  -> skipWaiting()               -> IDENTICAL -> no new worker
 *     activate -> clients.claim()             -> no install, no activate
 *     controller: null ---------> SW
 *     => 'controllerchange' FIRES             => never fires
 *     => BANNER SHOWS (false positive)        => BANNER NEVER SHOWS
 *
 * So every first-time visitor to the marketing site was told to reload the
 * page they had just opened, and nobody was ever told about an actual deploy.
 * It survived eight releases partly because `e2e/capture.spec.ts` CSS-hid it
 * on every screenshot run under a comment calling it a dev-session artifact —
 * a fresh Playwright context IS the first-visit path.
 *
 * WHY A STATIC GUARD RATHER THAN A RENDER TEST. The plan (decision 11) asked
 * for the regression as jsdom + e2e, where the jsdom half asserts the update
 * hook returns no-update on a same-version response. That hook does not exist
 * yet (T4), and more importantly a render test of a DELETED component can only
 * assert that nothing renders — which is vacuously true of any file that was
 * removed, and stays true if someone adds the listener back somewhere else
 * tomorrow. The failure being guarded is not "this component renders", it is
 * "`controllerchange` is used as an update signal anywhere in this app." That
 * is a property of the source tree, so it is checked against the source tree.
 *
 * BOTH ASSERTIONS BELOW MATCH LOCKED PLAN DECISIONS, so this cannot fight the
 * rebuild:
 *   - decision 1: detection polls a version endpoint; the `controllerchange`
 *     listener is deleted and `public/sw.js` is not modified.
 *   - decision 5: the replacement prompt mounts in the SIGNED-IN app layout,
 *     never the root layout, so it can never reach a public marketing page.
 *
 * If you are here because this went red: you are re-adding the v0.28.0.0 bug.
 * `controllerchange` fires on the uncontrolled -> controlled transition, which
 * is a FIRST VISIT, not an update.
 */

const REPO_ROOT = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'..',
	'..',
);

function readRepoText(relPath: string): string {
	try {
		return readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
	} catch {
		// Never throw at module scope: a throw here runs at COLLECTION time and
		// takes the whole file out of the run, so the case where the guarded
		// thing was deleted reports zero failures instead of many.
		return '';
	}
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

/**
 * Matches the listener registration, not the bare word, so the explanatory
 * prose in this file's own docstring is not a hit. `service-worker.ts` style
 * wrappers are covered too — the argument is what matters, not the receiver.
 */
const CONTROLLER_CHANGE_LISTENER =
	/addEventListener\(\s*['"`]controllerchange['"`]/;

/**
 * This file is excluded from its own scan. The matcher self-check below needs
 * real `addEventListener('controllerchange', …)` fixture strings, so the guard
 * flags itself on the first run — the same self-collision `billing.ts`'s
 * docstring caused for `plan-features.guard.test.ts`.
 *
 * Excluded by exact path rather than by skipping `*.guard.test.ts` as a class,
 * so a second guard file cannot quietly become an unscanned hiding place.
 */
const SELF = 'src/components/sw-update-banner.guard.test.ts';

const sourceFiles = walk('src').filter((file) => file !== SELF);

describe('the controllerchange update signal stays deleted', () => {
	it('scanned a source tree that actually exists', () => {
		// Self-check. Every assertion below passes on an empty list, which is
		// exactly how a guard silently stops guarding.
		expect(sourceFiles.length).toBeGreaterThan(100);
	});

	it('detects the listener shapes it claims to detect', () => {
		// The matcher's own fixtures. A regex that quietly stops matching is
		// indistinguishable from a clean codebase.
		expect(
			CONTROLLER_CHANGE_LISTENER.test(
				`navigator.serviceWorker.addEventListener('controllerchange', fn);`,
			),
		).toBe(true);
		expect(
			CONTROLLER_CHANGE_LISTENER.test(
				`sw.addEventListener(\n\t"controllerchange",\n\thandler,\n)`,
			),
		).toBe(true);
		// Prose mentioning the event is not a registration — this file is full
		// of it, and a looser regex would flag itself.
		expect(
			CONTROLLER_CHANGE_LISTENER.test(`// controllerchange fires on claim`),
		).toBe(false);
	});

	it('is registered nowhere under src/', () => {
		const offenders = sourceFiles.filter((file) =>
			CONTROLLER_CHANGE_LISTENER.test(readRepoText(file)),
		);
		expect(offenders).toEqual([]);
	});

	it('leaves no importable SwUpdateBanner behind', () => {
		expect(readRepoText('src/components/sw-update-banner.tsx')).toBe('');
	});
});

describe('no update prompt is mounted in the root layout', () => {
	const rootLayout = readRepoText('src/app/layout.tsx');

	it('read the root layout', () => {
		expect(rootLayout).not.toBe('');
		// Proves we are reading the right file: SwRegister deliberately STAYS
		// here (decision 5 — PWA install/offline is still wanted publicly), so
		// its presence distinguishes "read the layout" from "read nothing".
		expect(rootLayout).toContain('<SwRegister />');
	});

	it('mounts nothing that can prompt a public visitor to reload', () => {
		// The root layout wraps the marketing site. The replacement prompt
		// belongs to the signed-in app layout (decision 5); anything named like
		// an update prompt appearing HERE is the v0.28.0.0 blast radius again.
		expect(rootLayout).not.toMatch(/<(Sw)?(App)?Update(Banner|Prompt)\s*\/?>/);
	});
});
