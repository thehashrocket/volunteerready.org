import { expect, type Page, test } from '@playwright/test';

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
	'/locations/stockton',
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
