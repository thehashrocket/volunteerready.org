// ---------------------------------------------------------------------------
// Marketing screenshot capture scenarios (issue #139).
//
// Data-only module — no Playwright imports — so the vitest suite can import
// it (src/lib/marketing-screenshots.test.ts) and assert manifest integrity.
// The runner lives in e2e/capture.spec.ts (`pnpm screenshots`).
//
// Each scenario describes how to reproduce one asset in
// src/lib/marketing-screenshots.ts against the seeded dev database
// (`pnpm seed:dev`): who is logged in, which page, what to click, and what
// text proves the data settled (not a skeleton, not an empty state).
//
// Captures run at a fixed 1280×720 viewport. Annotation marker coordinates in
// page files assume this framing — recapture with the same scenario before
// adjusting any coordinates.
//
// Each scenario declares which color-scheme variants to capture (default
// light-only). A scenario declaring ['light', 'dark'] runs twice — once per
// variant — writing to the manifest entry's `src` and `darkSrc` respectively
// (src/lib/marketing-screenshots.ts). `dashboard` stays light-only: it's the
// one `priority`-loaded hero image (2026-07-14 eng review, Tension 1).
// ---------------------------------------------------------------------------

import type { MarketingScreenshotKey } from '../src/lib/marketing-screenshots';

/** Seeded dev accounts (see prisma/seed-dev.ts + CLAUDE.md test accounts). */
export const CAPTURE_ACTORS = {
	orgAdmin: 'orgadmin@volunteermatch.local',
	companyAdmin: 'companyadmin@volunteermatch.local',
	volunteer: 'volunteer@volunteermatch.local',
} as const;

export type CaptureActor = (typeof CAPTURE_ACTORS)[keyof typeof CAPTURE_ACTORS];

export type CaptureVariant = 'light' | 'dark';

export interface CaptureScenario {
	key: MarketingScreenshotKey;
	actor: CaptureActor;
	/**
	 * Route to capture. `:companyId` is resolved at runtime from the actor's
	 * CompanyMember row.
	 */
	path: string;
	/** Tabs (role="tab" accessible names) to click, in order, after load. */
	clickTabs?: string[];
	/**
	 * Text that must be visible before the screenshot is taken — chosen to
	 * prove real data rendered (skeletons and empty states must not contain it).
	 */
	waitForText: string;
	/**
	 * Color schemes to capture this scenario under. Defaults to light-only.
	 * A scenario declaring both writes to the manifest entry's `src` (light)
	 * and `darkSrc` (dark).
	 */
	variants?: CaptureVariant[];
}

export const CAPTURE_SCENARIOS: CaptureScenario[] = [
	{
		key: 'dashboard',
		actor: CAPTURE_ACTORS.orgAdmin,
		path: '/app',
		waitForText: 'Total applications',
	},
	{
		key: 'applicationsQueue',
		actor: CAPTURE_ACTORS.orgAdmin,
		path: '/app/applications',
		waitForText: '@example.com',
		variants: ['light', 'dark'],
	},
	{
		key: 'screener',
		actor: CAPTURE_ACTORS.orgAdmin,
		path: '/app/screener',
		// Helping Hands' seeded wording (prisma/seed-dev.ts), NOT the default
		// question's "of age" phrasing — a fresh `pnpm seed:dev` DB only has
		// this variant, so the default wording would time out.
		waitForText: 'Are you 18 years or older?',
		variants: ['light', 'dark'],
	},
	{
		key: 'profile',
		actor: CAPTURE_ACTORS.volunteer,
		path: '/app/profile',
		waitForText: 'Shifts',
		variants: ['light', 'dark'],
	},
	{
		key: 'esg',
		actor: CAPTURE_ACTORS.companyAdmin,
		path: '/app/company/:companyId/esg',
		waitForText: 'ESG Volunteer Impact',
		variants: ['light', 'dark'],
	},
	{
		key: 'credentials',
		actor: CAPTURE_ACTORS.volunteer,
		path: '/app/profile',
		clickTabs: ['Credentials'],
		// Must match the credential CARD, not the "3 Verified" stat above the
		// tabs — getByText is case-insensitive substring matching, so a bare
		// "VERIFIED" would settle-check (and center) the wrong element.
		waitForText: 'Training Complete',
		variants: ['light', 'dark'],
	},
	{
		key: 'impactReport',
		actor: CAPTURE_ACTORS.orgAdmin,
		path: '/app/impact-report',
		waitForText: 'days on VolunteerReady',
		variants: ['light', 'dark'],
	},
];
