// ---------------------------------------------------------------------------
// Marketing screenshot capture runner (issue #139).
//
// Not a test suite — a deterministic capture pipeline that regenerates the
// assets in public/marketing/ from the scenario manifest. It only runs under
// the `capture` Playwright project, which playwright.config.ts registers when
// CAPTURE=1 (so `pnpm e2e` never runs it). Don't run it concurrently with
// `pnpm e2e`: both share the dev server, and captures rewrite the very PNGs
// the public-pages spec asserts on.
//
//   pnpm screenshots                          # all scenarios
//   CAPTURE_ONLY=credentials,impactReport pnpm screenshots
//
// Requires seeded dev data: `pnpm seed:dev`. Sessions are minted directly in
// the local database via e2e/utils/db.ts, which refuses non-local
// DATABASE_URL — the safety rail against ever running this at production.
// ---------------------------------------------------------------------------

import { renameSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { COOKIE_CONSENT_STORAGE_KEY } from '../src/lib/cookie-consent';
import {
	CAPTURE_FRAME,
	MARKETING_SCREENSHOTS,
} from '../src/lib/marketing-screenshots';
import { CAPTURE_SCENARIOS } from './capture-scenarios';
import {
	createSession,
	deleteSession,
	disconnectPrisma,
	getPrisma,
	sessionCookie,
} from './utils/db';

const VIEWPORT = CAPTURE_FRAME;

const only = process.env.CAPTURE_ONLY?.split(',')
	.map((k) => k.trim())
	.filter(Boolean);
const scenarios = CAPTURE_SCENARIOS.filter(
	(s) => !only || only.includes(s.key),
);

test.use({ viewport: VIEWPORT, colorScheme: 'light' });

test.describe('marketing screenshot capture', () => {
	test.afterAll(async () => {
		await disconnectPrisma();
	});

	for (const scenario of scenarios) {
		test(`capture ${scenario.key}`, async ({ page, context, baseURL }) => {
			if (!baseURL) {
				throw new Error('baseURL missing from Playwright config');
			}

			const prisma = getPrisma();
			const user = await prisma.user.findUnique({
				where: { email: scenario.actor },
			});
			if (!user) {
				throw new Error(
					`Seed account ${scenario.actor} not found — run \`pnpm seed:dev\` first`,
				);
			}

			// Pin org/company context on the session — without it, multi-org
			// actors render the header org switcher in its "Select org"
			// placeholder state in every capture.
			const orgMembership = await prisma.organizationMember.findFirst({
				where: { userId: user.id },
				orderBy: { createdAt: 'asc' },
			});
			const companyMembership = await prisma.companyMember.findFirst({
				where: { userId: user.id },
				orderBy: { createdAt: 'asc' }, // deterministic tenant across reruns
			});

			const sessionToken = await createSession({
				userId: user.id,
				currentOrgId: orgMembership?.organizationId,
				currentCompanyId: companyMembership?.companyId,
			});

			try {
				// Pre-consent so the cookie banner never covers the frame.
				// Analytics stays declined — captures must not fire real events.
				await context.addInitScript(
					([key]) => {
						window.localStorage.setItem(
							key,
							JSON.stringify({ essential: true, analytics: false }),
						);
					},
					[COOKIE_CONSENT_STORAGE_KEY],
				);
				await context.addCookies([sessionCookie(sessionToken, baseURL)]);

				let route = scenario.path;
				if (route.includes(':companyId')) {
					if (!companyMembership) {
						throw new Error(
							`${scenario.actor} has no CompanyMember row — cannot resolve :companyId`,
						);
					}
					route = route.replace(':companyId', companyMembership.companyId);
				}

				await page.goto(route, { waitUntil: 'domcontentloaded' });

				for (const tab of scenario.clickTabs ?? []) {
					await page.getByRole('tab', { name: tab }).click();
				}

				// Proof the page settled with real data — skeletons and empty
				// states must not contain this text.
				const settled = page.getByText(scenario.waitForText).first();
				await expect(settled).toBeVisible({ timeout: 15_000 });
				// Let every query resolve BEFORE scrolling — late content above
				// the target would otherwise shift it out of frame after the
				// scroll (the credentials share-card races the credential list).
				await page.waitForLoadState('networkidle');
				// Center the proven content in the frame (tab panels and long
				// pages can leave it hugging the fold).
				await settled.evaluate((el) =>
					el.scrollIntoView({ block: 'center', behavior: 'instant' }),
				);
				// Hide dev-session artifacts that aren't product UI: the Next.js
				// dev-tools indicator and the service-worker update toast.
				await page.addStyleTag({
					content:
						'nextjs-portal{display:none!important}[data-sw-update-banner]{display:none!important}',
				});
				await page.waitForTimeout(400);

				const file = MARKETING_SCREENSHOTS[scenario.key];
				const finalPath = path.join('public', file.src);
				const tmpPath = `${finalPath}.tmp`;
				await page.screenshot({
					path: tmpPath,
					type: 'png', // .tmp extension defeats Playwright's type inference
					clip: { x: 0, y: 0, ...VIEWPORT },
				});
				// Atomic swap — a concurrent reader (dev server serving the old
				// asset) never sees a half-written PNG.
				renameSync(tmpPath, finalPath);
			} finally {
				await deleteSession(sessionToken);
			}
		});
	}
});
