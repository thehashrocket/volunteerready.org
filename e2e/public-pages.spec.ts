import { expect, test } from '@playwright/test';

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
