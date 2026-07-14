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
}

/** Fixed capture viewport — annotation marker coordinates assume this frame. */
export const CAPTURE_FRAME = { width: 1280, height: 720 } as const;

export const MARKETING_SCREENSHOTS = {
	dashboard: { src: '/marketing/dashboard.png' },
	applicationsQueue: { src: '/marketing/applications-queue.png' },
	screener: { src: '/marketing/screener.png' },
	profile: { src: '/marketing/profile.png' },
	esg: { src: '/marketing/esg.png' },
	credentials: { src: '/marketing/credentials.png' },
	impactReport: { src: '/marketing/impact-report.png' },
} as const satisfies Record<string, MarketingScreenshot>;

export type MarketingScreenshotKey = keyof typeof MARKETING_SCREENSHOTS;
