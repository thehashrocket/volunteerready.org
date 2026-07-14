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
	 * 'dark' (e2e/capture-scenarios.ts `variants` field). Optional — the
	 * `dashboard` entry deliberately has none: it's the one `priority`-loaded
	 * hero image, and rendering two eagerly-loaded variants would defeat the
	 * point of `priority` (2026-07-14 eng review, Tension 1).
	 */
	darkSrc?: string;
}

/** Fixed capture viewport — annotation marker coordinates assume this frame. */
export const CAPTURE_FRAME = { width: 1280, height: 720 } as const;

export const MARKETING_SCREENSHOTS = {
	dashboard: { src: '/marketing/dashboard.png' },
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
} as const satisfies Record<string, MarketingScreenshot>;

export type MarketingScreenshotKey = keyof typeof MARKETING_SCREENSHOTS;
