import { expect, test } from '@playwright/test';
import {
	createSession,
	deleteSession,
	disconnectPrisma,
	getPrisma,
	sessionCookie,
} from './utils/db';
import { expectNoHorizontalOverflow } from './utils/layout';

/**
 * The update strip, rendered by a real browser.
 *
 * MOCKED, AND THE NAME SAYS SO. `playwright.config.ts` boots one long-lived
 * `pnpm dev` server, so "old client bundle, new deployed server" cannot be
 * produced locally at all. Intercepting `/api/version` proves the render path
 * — the gates, the layout, the copy — and nothing about whether a real deploy
 * would be detected or whether `Reload` lands on the new build. Those belong
 * to a post-deploy canary (decision 18).
 *
 * The honest, non-mocked counterpart is the first-visit regression in
 * `public-pages.spec.ts`, which needs no interception because a fresh browser
 * context IS the reproduction.
 */

let sessionToken: string | null = null;

test.afterAll(async () => {
	if (sessionToken) await deleteSession(sessionToken);
	await disconnectPrisma();
});

test('strip renders for staff on a notice release (mocked /api/version)', async ({
	page,
	context,
	baseURL,
}) => {
	const prisma = getPrisma();
	const staff = await prisma.user.findFirst({
		where: { email: 'orgadmin@volunteermatch.local' },
		include: { memberships: true },
	});
	if (!staff) throw new Error('seed data missing — run pnpm seed:dev');

	sessionToken = await createSession({
		userId: staff.id,
		currentOrgId: staff.memberships[0]?.organizationId,
	});
	await context.addCookies([
		sessionCookie(sessionToken, baseURL ?? 'http://localhost:3005'),
	]);

	await page.route('**/api/version', (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				buildId: 'DIFFERENT',
				version: '9.9.9.9',
				severity: 'notice',
			}),
		}),
	);

	await page.goto('/app');
	const strip = page.getByTestId('app-update-prompt');
	await expect(strip).toBeVisible();
	await expect(strip).toContainText('VolunteerReady has been updated');

	// Below the header, never over it — the toaster lane was rejected because
	// below 600px it covers the mobile nav toggle, which is the only route to
	// the sidebar.
	const headerBox = await page.locator('header').first().boundingBox();
	const stripBox = await strip.boundingBox();
	expect(stripBox?.y).toBeGreaterThanOrEqual(
		(headerBox?.y ?? 0) + (headerBox?.height ?? 0) - 1,
	);

	for (const width of [375, 800]) {
		await page.setViewportSize({ width, height: 900 });
		await expect(strip).toBeVisible();
		await expectNoHorizontalOverflow(page, width);

		// The readable width is pinned SEPARATELY, because the overflow check
		// above passes even when the copy is crushed. That is not theoretical:
		// with `min-w-0` on the paragraph, `flex-wrap` never fired, the
		// shrink-0 buttons kept their row, and the sentence wrapped over eight
		// lines in a ~120px column at 375px — with every overflow assertion
		// green. A document-level check is necessary and not sufficient.
		const copyBox = await strip.locator('p').boundingBox();
		expect(copyBox?.width, `copy width at ${width}px`).toBeGreaterThan(200);
	}
});
