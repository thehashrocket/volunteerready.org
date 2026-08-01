// ---------------------------------------------------------------------------
// Playwright globalSetup — compile the dev server's routes before the workers
// stampede it.
//
// THE BUG THIS FIXES. `webServer.url` in `playwright.config.ts` waits for `/`
// to answer and then declares the server ready. In `next dev` that is only true
// for `/`: every other route is still uncompiled, so the moment Playwright
// releases N workers they demand ~20 uncompiled routes at once. Next then reads
// a `.next` manifest that another concurrent compile is midway through writing,
// and the truncated read surfaces as a 500:
//
//     ⨯ SyntaxError: Unexpected end of JSON input
//         at JSON.parse (<anonymous>) { page: '/locations/modesto' }
//
// It landed on `/locations/*` far more often than anywhere else because those
// six slugs share ONE `generateStaticParams` with `dynamicParams = false`, so
// every request to them consults the prerender manifest — six routes racing one
// file. Which slug lost was luck, which is why it looked like a different test
// each run (`fresno`, `san-joaquin-county`, `modesto`, `stanislaus-county`,
// `sacramento` across five runs) and why re-running one spec alone always
// passed.
//
// NOT a production defect, and that was verified rather than assumed: all six
// slugs prerender at build time (`● /locations/[slug]`), and 18 concurrent
// requests against `pnpm build && pnpm start` returned 200 with no manifest
// error in the log. Manifests are written once at build time and are immutable
// at serve time; only `next dev` writes them while serving.
//
// WHY WARM RATHER THAN RETRY. Retrying would have hidden it — and a retry that
// swallows a 500 on a public smoke test swallows the next REAL 500 too. Warming
// sequentially means only one route compiles at a time, so there is no
// concurrent write to race, and "the server is ready" becomes true in the sense
// `webServer.url` already implies.
// ---------------------------------------------------------------------------

import { LOCATIONS } from '../src/lib/locations';

/**
 * Every public route the suite navigates to. Kept in sync with
 * `PUBLIC_PAGES` in `public-pages.spec.ts` — the geo slugs come from the same
 * `LOCATIONS` array, so a seventh location warms itself.
 *
 * Authenticated routes are deliberately absent: they need a seeded session, and
 * the specs that use them are far fewer and have never produced this failure.
 * Add one here if that changes.
 */
const ROUTES_TO_WARM = [
	'/',
	'/about',
	'/how-it-works',
	'/for',
	'/for/volunteers',
	'/for/nonprofits',
	'/for/employers',
	'/for/animal-shelters',
	'/pricing',
	'/screening',
	'/security',
	'/privacy',
	'/terms',
	'/opportunities',
	'/organizations',
	'/stories',
	'/locations',
	...LOCATIONS.map((location) => `/locations/${location.slug}`),
];

export default async function globalSetup() {
	const baseURL =
		process.env.PLAYWRIGHT_BASE_URL ??
		`http://localhost:${process.env.PORT ?? 3005}`;

	// A remote or already-built target serves precompiled routes, so there is
	// nothing to warm and no manifest being written while it answers.
	if (process.env.PLAYWRIGHT_BASE_URL) return;

	const started = Date.now();
	const failed: string[] = [];

	// SEQUENTIAL on purpose. Warming these in parallel would reproduce the exact
	// stampede this exists to prevent.
	for (const route of ROUTES_TO_WARM) {
		try {
			const res = await fetch(`${baseURL}${route}`, {
				// Long: a cold Turbopack compile of a heavy marketing page can take
				// several seconds, and giving up early would put that route back into
				// the parallel phase — the one case this must not do.
				signal: AbortSignal.timeout(60_000),
			});
			if (!res.ok) failed.push(`${route} → ${res.status}`);
			// Drain the body so the connection is released rather than left for the
			// GC to reap mid-run.
			await res.arrayBuffer();
		} catch (err) {
			failed.push(`${route} → ${(err as Error).message}`);
		}
	}

	const seconds = Math.round((Date.now() - started) / 1000);
	if (failed.length > 0) {
		// Warn, never throw. A route that fails to warm is a real signal, but the
		// spec that covers it should be what reports it — failing here would take
		// the whole suite down with one unrelated page and hide every other result.
		console.warn(
			`[global-setup] warmed ${ROUTES_TO_WARM.length} routes in ${seconds}s; ${failed.length} did not answer cleanly:\n  ${failed.join('\n  ')}`,
		);
	} else {
		console.log(
			`[global-setup] warmed ${ROUTES_TO_WARM.length} routes in ${seconds}s`,
		);
	}
}
