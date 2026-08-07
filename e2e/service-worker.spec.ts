// ---------------------------------------------------------------------------
// What `public/sw.js` actually does in a browser.
//
// This file exists because the service worker's three bugs were all invisible
// to every other kind of test. The cache name was a literal nobody bumped, the
// install handler pre-cached two AUTHENTICATED routes, and the only evidence
// either way lives in the Cache Storage of a real browser — not in the source,
// not in jsdom, and not in a rendered page. A guard test reading `sw.js` would
// have passed on all three, because each one was written on purpose.
//
// It is also the only place the cross-user half is checkable at all: one cache
// per device, shared by every user who signs in on it, keyed by URL alone.
// ---------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import {
	createSession,
	deleteSession,
	disconnectPrisma,
	getPrisma,
	SESSION_COOKIE_NAME,
} from './utils/db';

const sessionTokens: string[] = [];

/**
 * What the worker is allowed to cache. Two properties, deliberately separated,
 * because either one alone can pass while the guarantee is gone.
 *
 * `DECLARED_PREFIXES` is READ OUT OF `public/sw.js` rather than retyped, so the
 * "only build output is cached" test below cannot drift from the worker it is
 * describing. But a list read from the source blesses whatever the source says
 * — widen `STATIC_PREFIXES` to `/` and that test would still pass. So
 * `EXPECTED_PREFIXES` pins the value too: widening the allowlist is a
 * deliberate, visible edit to this file, not a silent change to a config array.
 */
const EXPECTED_PREFIXES = [
	'/_next/static/',
	'/icons/',
	'/fonts/',
	'/images/',
] as const;

function readDeclaredPrefixes(): string[] {
	const source = readFileSync(
		path.join(process.cwd(), 'public', 'sw.js'),
		'utf8',
	);
	const match = source.match(/const STATIC_PREFIXES = \[([^\]]*)\]/);
	if (!match) throw new Error('STATIC_PREFIXES not found in public/sw.js');
	return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

const STATIC_PREFIXES = readDeclaredPrefixes();

test.afterAll(async () => {
	await Promise.all(sessionTokens.map(deleteSession));
	await disconnectPrisma();
});

/** Every path the cache is forbidden to hold, for any user, ever. */
function privateEntries(paths: string[]): string[] {
	return paths.filter(
		(p) =>
			p === '/app' ||
			p.startsWith('/app/') ||
			p.startsWith('/api/') ||
			p.startsWith('/login'),
	);
}

async function readCaches(page: import('@playwright/test').Page) {
	return page.evaluate(async () => {
		const keys = await caches.keys();
		return {
			keys,
			paths: (
				await Promise.all(
					keys.map(async (key) =>
						(await (await caches.open(key)).keys()).map(
							(request) => new URL(request.url).pathname,
						),
					),
				)
			).flat(),
		};
	});
}

/**
 * Waits for the worker to control the page. Nothing is cached before this: a
 * first-visit worker activates AFTER the document and its assets have already
 * been fetched, so the caching paths are only reachable on the navigation
 * after `clients.claim()`.
 */
async function waitForController(page: import('@playwright/test').Page) {
	await page.waitForFunction(() => navigator.serviceWorker.controller !== null, {
		timeout: 15_000,
	});
}

test.describe('service worker cache', () => {
	test('caches nothing beyond the four build-output prefixes', () => {
		// Not a tautology: this compares what `sw.js` DECLARES against what this
		// file EXPECTS. Widening the worker's allowlist turns it red, which is the
		// point — the previous denylist could be widened by adding a route
		// anywhere in the app, and nothing noticed.
		expect(STATIC_PREFIXES).toEqual([...EXPECTED_PREFIXES]);
	});

	test('is named for this build, not a frozen literal', async ({ page }) => {
		await page.goto('/');
		await waitForController(page);
		await page.goto('/pricing');

		const { keys, paths } = await readCaches(page);

		// Self-check: every assertion below is vacuously true of an empty cache,
		// which is exactly how this stops testing anything.
		expect(keys, 'no cache was created at all').not.toEqual([]);
		expect(paths.length).toBeGreaterThan(0);

		// The bug: `SW_VERSION = '1.0.0'` was a literal no build step rewrote, so
		// this name never changed and `activate` — the only thing that deletes old
		// caches — ran once per device and never again.
		expect(keys).not.toContain('vr-static-v1.0.0');
		for (const key of keys) {
			expect(key, 'cache name carries no build id').toMatch(
				/^vr-static-v.+$/,
			);
			expect(key).not.toMatch(/^vr-static-v(unversioned|)$/);
		}
	});

	test('holds nothing from the signed-out visitor journey that belongs to /app', async ({
		page,
	}) => {
		await page.goto('/');
		await waitForController(page);
		await page.goto('/pricing');
		// The sign-in page is the one public-looking route that must not be
		// cached: it carries a CSRF token, so a copy served from the fallback is
		// a form that cannot succeed. Visiting it is what keeps the `/login`
		// clause in `privateEntries` from being aspirational.
		await page.goto('/login');

		const { paths } = await readCaches(page);
		expect(paths.length).toBeGreaterThan(0);

		// The bug: install ran `cache.addAll(['/app', '/app/my-shifts'])`, and both
		// 307 to sign-in for a visitor with no session. The fetch follows the
		// redirect, so what landed under the `/app` key was the LOGIN page — which
		// the network-first fallback would later serve to someone who WAS signed
		// in, as a sign-in screen.
		expect(privateEntries(paths)).toEqual([]);
	});

	test('holds nothing from a signed-in coordinator either', async ({
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
			{
				name: SESSION_COOKIE_NAME,
				value: sessionToken,
				url: baseURL ?? 'http://localhost:3005',
			},
		]);

		await page.goto('/');
		await waitForController(page);

		// Two authenticated navigations through a worker that is already in
		// control, so any caching of the signed-in surface has every chance to
		// happen. `/app` is the PWA's own `start_url`, which is why it was
		// pre-cached in the first place.
		await page.goto('/app');
		await page.goto('/app/shifts');
		await expect(page.locator('h1').first()).toBeVisible();

		const { paths } = await readCaches(page);

		// The device is shared — a front-desk tablet at a nonprofit is a realistic
		// install target — and the cache is keyed by URL alone, so it cannot
		// express "belongs to this user". Nothing that identifies one may enter it.
		expect(privateEntries(paths)).toEqual([]);
	});

	/**
	 * THE ALLOWLIST PROPERTY, asserted as a property rather than per-route.
	 *
	 * The first fix here was a denylist of paths not to cache, and it missed four
	 * token-bearing routes across two review passes. This asserts the shape that
	 * replaced it: after a journey across public pages, a 404, and a URL carrying
	 * a one-time credential, the cache contains ONLY content-addressed build
	 * output. A new route added to this app cannot fail this test, because
	 * nothing about a new route can put an entry in the cache.
	 */
	test('caches only content-addressed build output, whatever the journey', async ({
		page,
	}) => {
		await page.goto('/');
		await waitForController(page);

		const token = `SECRET-ONE-TIME-TOKEN-${Date.now()}`;
		await page.goto('/pricing');
		await expect(page.locator('h1').first()).toBeVisible();
		await page.goto(`/apply/status?token=${token}`);
		// Proves the page really rendered, so "not cached" is not "never loaded".
		await expect(page.locator('h1').first()).toBeVisible();
		const missing = `/this-route-does-not-exist-${Date.now()}`;
		expect(
			(await page.goto(missing))?.status(),
			'404 fixture must actually fail',
		).toBe(404);

		const { paths } = await readCaches(page);

		// Self-check: every assertion below is vacuous against an empty cache.
		expect(paths.length).toBeGreaterThan(0);

		const notBuildOutput = paths.filter(
			(p) => !STATIC_PREFIXES.some((prefix) => p.startsWith(prefix)),
		);
		expect(notBuildOutput, 'non-asset entry reached the cache').toEqual([]);

		// Stated separately from the property above so a failure names the
		// specific class rather than just "something got cached".
		expect(privateEntries(paths)).toEqual([]);
		expect(paths).not.toContain(missing);
	});

	/**
	 * The regression for the finding that produced the allowlist. Kept as its own
	 * test, with its own name, because "a token never reaches the cache" is the
	 * claim someone will come here to check — and because it covers the KEY, not
	 * the response body.
	 *
	 * Four routes carry a one-time secret in the URL while serving generic HTML:
	 * `/apply/status?token=`, `/invite/<token>`, `/invite/company/<token>` and
	 * `/credentials/claim/<token>`. Three were missed by the denylist this
	 * replaced. All four are exercised here — not because the allowlist treats
	 * them specially (it does not know they exist), but so the test still names
	 * the real routes if the shape is ever reverted.
	 */
	test('never writes a one-time link token into a cache key', async ({
		page,
	}) => {
		await page.goto('/');
		await waitForController(page);

		const token = `SECRET-ONE-TIME-TOKEN-${Date.now()}`;
		const credentialUrls = [
			`/apply/status?token=${token}`,
			`/invite/${token}`,
			`/invite/company/${token}`,
			`/credentials/claim/${token}`,
		];
		for (const url of credentialUrls) {
			// Any status is fine — several of these 404 or redirect on a bogus
			// token. What matters is that the request was MADE, so the worker had
			// its chance to cache it.
			await page.goto(url);
		}

		const urls = await page.evaluate(async () => {
			const names = await caches.keys();
			return (
				await Promise.all(
					names.map(async (name) =>
						(await (await caches.open(name)).keys()).map((r) => r.url),
					),
				)
			).flat();
		});

		expect(urls.filter((url) => url.includes(token))).toEqual([]);
	});

	test('does not cache a failed static asset either', async ({ page }) => {
		await page.goto('/');
		await waitForController(page);

		// The same `response.ok` guard exists on BOTH fetch branches, and the test
		// above only covers the page one. Without this, deleting the guard from
		// the static branch survives the whole suite — and that branch is
		// cache-FIRST, so a cached 404 for a chunk is served forever after.
		const missingAsset = `/_next/static/chunks/does-not-exist-${Date.now()}.js`;
		const status = await page.evaluate(
			(path) => fetch(path).then((r) => r.status),
			missingAsset,
		);
		expect(status, 'fixture must actually fail').toBe(404);

		const { paths } = await readCaches(page);
		expect(paths).not.toContain(missingAsset);
	});

	/**
	 * The two halves of the lifecycle, asserted together because each one alone
	 * reads as the other's bug.
	 *
	 * A new build's worker must NOT take over a tab that is mid-session — it
	 * would delete the caches out from under the page the user is looking at,
	 * which is why `skipWaiting()` is gone. But a worker that waits forever is
	 * just the frozen cache again under a new name, so the rotation has to be
	 * shown actually happening once the tab using it goes away.
	 */
	test('a new build waits for the live tab, then rotates the cache when it closes', async ({
		context,
	}) => {
		const page = await context.newPage();
		await page.goto('/');
		await waitForController(page);

		// Exactly what every device installed before this fix is carrying.
		await page.evaluate(async () => {
			const stale = await caches.open('vr-static-v1.0.0');
			await stale.put('/planted', new Response('stale'));
		});
		expect(await page.evaluate(() => caches.keys())).toContain(
			'vr-static-v1.0.0',
		);

		// A deploy, as the browser sees it: same bytes, different script URL. The
		// byte-for-byte shortcut in the Update algorithm only applies when the URL
		// is unchanged, which is the whole reason `sw-register.tsx` stamps `?v=`.
		await page.evaluate(() =>
			navigator.serviceWorker
				.register('/sw.js?v=A-LATER-BUILD')
				.then(() => undefined),
		);

		// HALF ONE. It installs and stops. Restoring `skipWaiting()` turns this
		// red — the new worker activates immediately and `waiting` is null.
		await expect
			.poll(
				() =>
					page.evaluate(async () => {
						const registration =
							await navigator.serviceWorker.getRegistration();
						return registration?.waiting?.state ?? null;
					}),
				{ timeout: 15_000 },
			)
			.toBe('installed');
		expect(
			await page.evaluate(() => caches.keys()),
			'the live tab lost its cache to a worker it never asked for',
		).toContain('vr-static-v1.0.0');

		// HALF TWO. The last client using the old worker goes away, so the waiting
		// worker activates and `activate` finally gets to run.
		await page.close();
		const reopened = await context.newPage();
		await reopened.goto('/');

		await expect
			.poll(() => reopened.evaluate(() => caches.keys()), { timeout: 15_000 })
			.not.toContain('vr-static-v1.0.0');
		await reopened.close();
	});
});
