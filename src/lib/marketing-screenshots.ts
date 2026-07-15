/**
 * Single source of truth for marketing screenshot assets (issue #139).
 *
 * Pages import entries from here instead of hardcoding `/marketing/*.png`
 * strings; the capture pipeline (e2e/capture-scenarios.ts) regenerates the
 * files by key; and marketing-screenshots.test.ts asserts every entry exists
 * on disk so a renamed or missing asset fails CI instead of silently
 * vanishing from the page (ScreenshotSection hides itself on image error).
 *
 * All assets are captured at a fixed 1280×720 viewport — annotation marker
 * coordinates in page files depend on that framing staying stable.
 */

export interface MarketingScreenshot {
	src: string;
	/**
	 * Dark-mode variant, captured with the same scenario at colorScheme:
	 * 'dark' (e2e/capture-scenarios.ts `variants` field). Optional — presence
	 * here doesn't force a caller to use it. `dashboard` holds one even though
	 * its `priority` homepage hero usage never reads it (an eagerly-preloaded
	 * `dark:hidden` sibling would double that fetch, 2026-07-14 eng review,
	 * Tension 1); /how-it-works reuses the same key without `priority` and
	 * passes `darkSrc` explicitly, since the per-call-site `darkSrc` prop —
	 * not this manifest entry — decides whether a variant renders
	 * (2026-07-14, /ship adversarial review).
	 */
	darkSrc?: string;
}

/** Fixed capture viewport — annotation marker coordinates assume this frame. */
export const CAPTURE_FRAME = { width: 1280, height: 720 } as const;

export const MARKETING_SCREENSHOTS = {
	dashboard: {
		src: '/marketing/dashboard.png',
		darkSrc: '/marketing/dashboard-dark.png',
	},
	applicationsQueue: {
		src: '/marketing/applications-queue.png',
		darkSrc: '/marketing/applications-queue-dark.png',
	},
	screener: {
		src: '/marketing/screener.png',
		darkSrc: '/marketing/screener-dark.png',
	},
	profile: {
		src: '/marketing/profile.png',
		darkSrc: '/marketing/profile-dark.png',
	},
	esg: { src: '/marketing/esg.png', darkSrc: '/marketing/esg-dark.png' },
	credentials: {
		src: '/marketing/credentials.png',
		darkSrc: '/marketing/credentials-dark.png',
	},
	impactReport: {
		src: '/marketing/impact-report.png',
		darkSrc: '/marketing/impact-report-dark.png',
	},
	animalShelters: {
		src: '/marketing/animal-shelters.png',
		darkSrc: '/marketing/animal-shelters-dark.png',
	},
} as const satisfies Record<string, MarketingScreenshot>;

export type MarketingScreenshotKey = keyof typeof MARKETING_SCREENSHOTS;
