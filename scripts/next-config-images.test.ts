import { describe, expect, it } from 'vitest';
import nextConfig from '../next.config';

/**
 * Guards the reasoning behind two dismissed advisories, neither of which is
 * visible from the code they protect.
 *
 * 1. sharp (alert #99, high) is dismissed as not-reachable. sharp is only
 *    invoked by the Image Optimization API, and that API only fetches bytes we
 *    did not author when `images.remotePatterns` or `images.domains` grants it
 *    a remote origin. Every image in this repo is a local file under
 *    `public/`, so there is no attacker-supplied input to reach sharp with.
 *
 * 2. GHSA-q8wf-6r8g-63ch (Next.js image-optimization DoS via SVG) is patched
 *    in 16.2.11, and additionally requires `dangerouslyAllowSVG`.
 *
 * Both dismissals are statements about CONFIGURATION, and configuration drifts
 * silently — adding a CDN origin to serve one blog image would re-open both
 * without touching a single line of application code and without any reviewer
 * connecting it to a dismissed alert. This test is the connection.
 *
 * It asserts against the RESOLVED config (post-`withSentryConfig`), which is
 * what Next actually consumes, so a wrapper injecting an images block is caught
 * too.
 *
 * If you are here because this test went red: that is correct and expected.
 * Adding remote image origins is a legitimate thing to do. Re-open the sharp
 * alert, upgrade sharp to >= 0.35.0, then update this test to allow the
 * specific origins you added.
 *
 * Lives in `scripts/` rather than beside application code because it guards a
 * ROOT CONFIG FILE, which is the shape `lint-gate.test.ts` (biome.json) and
 * `docs-nav-links.test.ts` (the VitePress config) already established — config
 * the tool cannot check itself. That is a different shape from the
 * `*.guard.test.ts` files under `src/server/domain/`, which scan the whole
 * source tree for a banned pattern; this one imports a single object and
 * asserts its shape, so it takes the `scripts/` naming too (no `guard` infix).
 */

const config = nextConfig as Record<string, unknown>;
const images = config.images as Record<string, unknown> | undefined;

describe('next.config.ts image configuration', () => {
	it('declares no images block at all', () => {
		// The strongest form of the guarantee, and the one true today. The
		// per-key assertions below are deliberately kept as well, so that
		// introducing an images block for an unrelated reason (formats, sizes,
		// minimumCacheTTL) does not silently retire the checks that matter.
		expect(images).toBeUndefined();
	});

	it('grants no remote origins via images.remotePatterns', () => {
		expect(images?.remotePatterns ?? []).toEqual([]);
	});

	it('grants no remote origins via the legacy images.domains', () => {
		expect(images?.domains ?? []).toEqual([]);
	});

	it('does not enable dangerouslyAllowSVG', () => {
		expect(images?.dangerouslyAllowSVG ?? false).toBe(false);
	});

	it('does not disable image optimization in a way that hides the above', () => {
		// `unoptimized: true` bypasses sharp entirely, which would make the sharp
		// dismissal true for a different reason. Pinned so the rationale recorded
		// on the alert stays the rationale that is actually load-bearing.
		expect(images?.unoptimized ?? false).toBe(false);
	});
});
