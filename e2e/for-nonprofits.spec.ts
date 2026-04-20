import { expect, test } from '@playwright/test';

test.describe('/for/nonprofits V2 editorial', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/for/nonprofits', { waitUntil: 'domcontentloaded' });
	});

	test('renders hero heading with italic emphasis', async ({ page }) => {
		const h1 = page.locator('h1').first();
		await expect(h1).toBeVisible();
		await expect(h1).toContainText('Your mission is too important to manage');
		await expect(h1).toContainText('from a spreadsheet.');
	});

	test('hero has both primary and secondary CTAs', async ({ page }) => {
		const primary = page
			.getByRole('link', { name: /See It In Action — Free Setup/i })
			.first();
		await expect(primary).toBeVisible();

		const secondary = page
			.getByRole('link', { name: /See how it works/i })
			.first();
		await expect(secondary).toBeVisible();
		await expect(secondary).toHaveAttribute('href', '/how-it-works');
	});

	test('hero side-note label is present', async ({ page }) => {
		await expect(page.getByText('Audit-ready by default')).toBeVisible();
	});

	test('bottom CTA links to /pricing', async ({ page }) => {
		const pricingLink = page.getByRole('link', { name: /See pricing/i }).last();
		await expect(pricingLink).toBeVisible();
		await expect(pricingLink).toHaveAttribute('href', '/pricing');
	});
});
