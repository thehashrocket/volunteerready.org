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

/**
 * Every token this file minted, not just the most recent.
 *
 * It was a single `let` while this spec had one test. A second test overwrote
 * it and the first test's Session row leaked on every run — the shape
 * `fullyParallel` makes worse, since each worker cleans up only what it
 * created and an unscoped sweep could delete a sibling's live row.
 */
const sessionTokens: string[] = [];

test.afterAll(async () => {
	await Promise.all(sessionTokens.map(deleteSession));
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

	const sessionToken = await createSession({
		userId: staff.id,
		currentOrgId: staff.memberships[0]?.organizationId,
	});
	sessionTokens.push(sessionToken);
	await context.addCookies([
		sessionCookie(sessionToken, baseURL ?? 'http://localhost:3005'),
	]);

	await page.route('**/api/version*', (route) =>
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

test('strip leads with what changed when the release has notes (mocked /api/version)', async ({
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

	const sessionToken = await createSession({
		userId: staff.id,
		currentOrgId: staff.memberships[0]?.organizationId,
	});
	sessionTokens.push(sessionToken);
	await context.addCookies([
		sessionCookie(sessionToken, baseURL ?? 'http://localhost:3005'),
	]);

	await page.route('**/api/version*', (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				buildId: 'DIFFERENT',
				version: '9.9.9.9',
				severity: 'notice',
				notes: [
					{ version: '9.9.9.9', summary: 'You can now export your roster.' },
					{ version: '9.9.8.0', summary: 'Shift reminders send a day earlier.' },
				],
				olderCount: 2,
			}),
		}),
	);

	await page.goto('/app');
	const strip = page.getByTestId('app-update-prompt');
	await expect(strip).toBeVisible();

	// The reason to act leads, and the generic sentence is gone — the entire
	// point of the notes work. Both directions, so a component that appended
	// the summary to the old copy instead of replacing it fails here.
	await expect(strip).toContainText('You can now export your roster.');
	await expect(strip).not.toContainText('VolunteerReady has been updated');

	// Counted, not listed: DESIGN.md's strip is one line with no title, and the
	// count includes what the server's wire cap dropped (1 unshown + 2 older).
	await expect(strip).toContainText('Plus 3 more updates.');
	await expect(strip).not.toContainText('Shift reminders send a day earlier.');

	// The unsaved-work warning survives the rewrite. It is the only thing
	// between the primary action and someone's half-typed form.
	await expect(strip).toContainText('anything unsaved will be lost');

	// Re-run the crushed-column check against the LONGER copy this release
	// introduces. The `min-w-56` failure scales with sentence length, and every
	// horizontal-overflow assertion stays green while it happens.
	for (const width of [375, 800]) {
		await page.setViewportSize({ width, height: 900 });
		await expect(strip).toBeVisible();
		await expectNoHorizontalOverflow(page, width);
		const copyBox = await strip.locator('p').boundingBox();
		expect(copyBox?.width, `copy width at ${width}px`).toBeGreaterThan(200);
	}
});
