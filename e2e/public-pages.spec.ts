import { expect, type Page, test } from '@playwright/test';
import { LOCATIONS } from '../src/lib/locations';

const PUBLIC_PAGES = [
	'/',
	'/about',
	'/how-it-works',
	'/for/volunteers',
	'/for/nonprofits',
	'/for/employers',
	'/for/animal-shelters',
	'/pricing',
	'/screening',
	'/security',
	'/privacy',
	'/terms',
	'/locations',
	...LOCATIONS.map((location) => `/locations/${location.slug}`),
] as const;

test.describe('Public pages smoke', () => {
	for (const path of PUBLIC_PAGES) {
		test(`loads ${path} with 200 + visible h1`, async ({ page }) => {
			const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
			expect(response?.status(), `Status for ${path}`).toBeLessThan(400);

			const h1 = page.locator('h1').first();
			await expect(h1).toBeVisible();
			await expect(h1).not.toBeEmpty();
		});
	}
});

test.describe('/for index navigation', () => {
	const AUDIENCE_LINKS = [
		{ label: 'Nonprofits', href: '/for/nonprofits' },
		{ label: 'Volunteers', href: '/for/volunteers' },
		{ label: 'Employers', href: '/for/employers' },
		{ label: 'Animal Shelters', href: '/for/animal-shelters' },
	] as const;

	// Match on the row's heading (exact), not the whole link's accessible
	// name (heading + description) — the Animal Shelters row's description
	// contains the word "volunteers", which would collide with the
	// Volunteers row under substring matching.
	function audienceRow(page: Page, label: string) {
		return page
			.locator('main')
			.getByRole('link')
			.filter({ has: page.getByRole('heading', { name: label, exact: true }) });
	}

	test('renders all 4 audience rows with correct hrefs', async ({ page }) => {
		await page.goto('/for', { waitUntil: 'domcontentloaded' });

		for (const { label, href } of AUDIENCE_LINKS) {
			const link = audienceRow(page, label);
			await expect(link).toBeVisible();
			await expect(link).toHaveAttribute('href', href);
		}
	});

	test('clicking an audience row navigates to its destination page', async ({
		page,
	}) => {
		await page.goto('/for', { waitUntil: 'domcontentloaded' });

		await audienceRow(page, 'Nonprofits').click();

		await expect(page).toHaveURL(/\/for\/nonprofits$/);
		const h1 = page.locator('h1').first();
		await expect(h1).toBeVisible();
	});
});

test.describe('/locations index navigation', () => {
	function locationRow(page: Page, name: string) {
		return page
			.locator('main')
			.getByRole('link')
			.filter({ has: page.getByRole('heading', { name, exact: true }) });
	}

	test('renders all location rows with correct hrefs', async ({ page }) => {
		await page.goto('/locations', { waitUntil: 'domcontentloaded' });

		for (const location of LOCATIONS) {
			const link = locationRow(page, location.name);
			await expect(link).toBeVisible();
			await expect(link).toHaveAttribute('href', `/locations/${location.slug}`);
		}
	});

	test('clicking a location row navigates to its destination page', async ({
		page,
	}) => {
		await page.goto('/locations', { waitUntil: 'domcontentloaded' });

		const first = LOCATIONS[0];
		await locationRow(page, first.name).click();

		await expect(page).toHaveURL(new RegExp(`/locations/${first.slug}$`));
		const h1 = page.locator('h1').first();
		await expect(h1).toBeVisible();
	});
});

test.describe('Homepage editorial sections', () => {
	test('renders pillar and differentiator content, not the old card grid', async ({
		page,
	}) => {
		await page.goto('/', { waitUntil: 'domcontentloaded' });

		// A prop-shape regression (e.g. swapping `items={pillars}` for the
		// wrong array) would still pass the generic h1 smoke test — assert
		// the actual content renders.
		await expect(
			page.getByRole('heading', { name: 'Background checks, built in' }),
		).toBeVisible();
		await expect(
			page.getByRole('heading', { name: 'Portable credentials' }),
		).toBeVisible();
		await expect(
			page.getByRole('heading', { name: 'Founder-led setup' }),
		).toBeVisible();
		await expect(
			page.getByRole('heading', { name: 'Real-time platform data' }),
		).toBeVisible();
	});
});

// ---------------------------------------------------------------------------
// Marketing screenshot regression guards (issue #139).
//
// ScreenshotSection/AnnotatedScreenshot hide themselves when an image 404s,
// so a broken asset silently deletes the section — no console error, no
// failed h1 check. These tests prove the images actually LOADED. Below-fold
// images are lazy (`loading="lazy"`), so each one must be scrolled into view
// first — a bare goto() + naturalWidth check would pass without ever
// requesting them.
// ---------------------------------------------------------------------------

// Dark-variant images/legends exist in the DOM at all times (issue #139
// follow-up: dark-mode screenshot variants) but are `display:none` in the
// "wrong" theme via `dark:hidden` / `hidden dark:block` — Playwright's
// `:visible` pseudo-class filters to whatever the CURRENT colorScheme
// actually shows, matching what a real user sees.
const MARKETING_IMG_SELECTOR =
	'img[src*="marketing"]:visible, img[srcset*="marketing"]:visible';

const SCREENSHOT_PAGES = [
	{ path: '/', minImages: 4 }, // hero dashboard + 3 annotated pillar rows
	{ path: '/for/nonprofits', minImages: 1 },
	{ path: '/for/volunteers', minImages: 1 },
	{ path: '/for/employers', minImages: 1 },
	{ path: '/how-it-works', minImages: 1 },
	{ path: '/screening', minImages: 1 },
] as const;

test.describe('Marketing screenshots load', () => {
	for (const { path, minImages } of SCREENSHOT_PAGES) {
		test(`all marketing images on ${path} render with natural size`, async ({
			page,
		}) => {
			await page.goto(path, { waitUntil: 'domcontentloaded' });

			const images = page.locator(MARKETING_IMG_SELECTOR);
			const count = await images.count();
			expect(
				count,
				`${path} should render at least ${minImages} marketing screenshot(s) — a missing asset hides its section silently`,
			).toBeGreaterThanOrEqual(minImages);

			for (let i = 0; i < count; i++) {
				const img = images.nth(i);
				await img.scrollIntoViewIfNeeded();
				await expect(img).toBeVisible();
				await expect
					.poll(
						() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth),
						{
							// Cold dev-server image optimization can exceed the 5s
							// default — match the capture pipeline's settle budget.
							timeout: 15_000,
							message: `image ${i} on ${path} never loaded pixels`,
						},
					)
					.toBeGreaterThan(0);
			}
		});
	}
});

// Dark-mode counterpart: same pages, colorScheme: 'dark', proving the CSS
// swap actually shows the dark variant (not just that it exists on disk —
// src/lib/marketing-screenshots.test.ts already covers that).
test.describe('Marketing screenshots load (dark mode)', () => {
	test.use({ colorScheme: 'dark' });

	// dashboard.png has no dark variant (Tension 1: the one `priority`-loaded
	// hero image, excluded from dark scope) — the homepage's hero shot stays
	// light-only even in dark mode, so its minImages drops by 1 here.
	const DARK_SCREENSHOT_PAGES = SCREENSHOT_PAGES.map((p) =>
		p.path === '/' ? { ...p, minImages: p.minImages - 1 } : p,
	);

	for (const { path, minImages } of DARK_SCREENSHOT_PAGES) {
		test(`all marketing images on ${path} render with natural size`, async ({
			page,
		}) => {
			await page.goto(path, { waitUntil: 'domcontentloaded' });

			const images = page.locator(MARKETING_IMG_SELECTOR);
			const count = await images.count();
			expect(
				count,
				`${path} (dark) should render at least ${minImages} marketing screenshot(s)`,
			).toBeGreaterThanOrEqual(minImages);

			for (let i = 0; i < count; i++) {
				const img = images.nth(i);
				await img.scrollIntoViewIfNeeded();
				await expect(img).toBeVisible();
				await expect
					.poll(
						() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth),
						{ timeout: 15_000, message: `dark image ${i} on ${path} never loaded pixels` },
					)
					.toBeGreaterThan(0);
			}
		});
	}
});

test.describe('Homepage pillar annotations', () => {
	test('markers and legends render for each pillar', async ({ page }) => {
		await page.goto('/', { waitUntil: 'domcontentloaded' });

		// 3 pillars × 3 annotations: numbered markers on the image (aria-hidden)
		// and a matching HTML legend list. Dark-variant legends also exist in
		// the DOM (hidden via CSS in light mode) — scope to :visible so this
		// asserts what a light-mode user actually sees.
		const legends = page.locator('main ol:visible');
		await expect(legends).toHaveCount(3);
		for (let i = 0; i < 3; i++) {
			await expect(legends.nth(i).locator('li')).toHaveCount(3);
		}
	});

	test('mobile viewport (375px): legends stack below images, nothing clipped', async ({
		page,
	}) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/', { waitUntil: 'domcontentloaded' });

		const firstPillarImage = page.locator(MARKETING_IMG_SELECTOR).nth(1); // 0 = hero dashboard shot
		await firstPillarImage.scrollIntoViewIfNeeded();
		await expect(firstPillarImage).toBeVisible();

		// The image (and the markers positioned over it) must fit the viewport
		// width — an overflow here means the annotation frame broke the layout.
		const box = await firstPillarImage.boundingBox();
		expect(box).not.toBeNull();
		expect(box?.width ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(375);

		const firstLegend = page.locator('main ol:visible').first();
		await firstLegend.scrollIntoViewIfNeeded();
		await expect(firstLegend).toBeVisible();
		await expect(firstLegend.locator('li').first()).toBeVisible();
	});
});

test.describe('how-it-works / screening annotations', () => {
	const ANNOTATED_PAGES = ['/how-it-works', '/screening'] as const;

	for (const path of ANNOTATED_PAGES) {
		test(`markers and legend render on ${path}`, async ({ page }) => {
			await page.goto(path, { waitUntil: 'domcontentloaded' });

			// Each page has exactly one annotated ScreenshotSection, so exactly
			// one VISIBLE legend with 3 numbered callouts. /screening's
			// screener.png also has a dark variant (a second legend exists in
			// the DOM, hidden via CSS in light mode) — :visible scopes this to
			// what a light-mode user actually sees.
			const legends = page.locator('main ol:visible');
			await expect(legends).toHaveCount(1);
			await expect(legends.first().locator('li')).toHaveCount(3);
		});
	}
});
