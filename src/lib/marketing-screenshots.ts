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

/**
 * The homepage walkthrough video (71s, captioned, no audio) and its poster.
 * Kept out of MARKETING_SCREENSHOTS on purpose: it is not produced by the
 * capture pipeline and is not pinned to CAPTURE_FRAME. The YouTube copy
 * (https://youtu.be/AHcNT5faLl0) is for email; the site self-hosts this file so
 * nothing third-party loads before cookie consent and the player never ends on
 * someone else's suggested videos.
 *
 * When the UI it shows changes, re-record it and replace both files together.
 */
export const WALKTHROUGH_VIDEO = {
	src: '/marketing/walkthrough.mp4',
	poster: '/marketing/walkthrough-poster.jpg',
	durationLabel: '1-minute',
	/** Burned-in captions, in order — also rendered as a text transcript. */
	transcript: [
		'When a funder asks how many hours volunteers gave you last year, this is the page you want to open. Here’s how the number gets there.',
		'It starts with a link on your website. Volunteers apply with your screening questions.',
		'When they submit, nothing lands in a shared inbox. It lands here: every applicant, their answers, and their screening result in one queue.',
		'Open one, read the answers, and approve. The volunteer gets an email automatically.',
		'Post your shifts. Approved volunteers claim the open slots, so you’re not chasing anyone by text.',
		'Volunteers see their upcoming shifts, and check in at the door with a QR code. That check-in is the record: attendance and hours.',
		'Every check-in adds to this report: hours served, applications, background checks, shifts. It’s on every plan, including the free one.',
		'VolunteerReady is new. I’ll set it up with you myself.',
	],
} as const;
