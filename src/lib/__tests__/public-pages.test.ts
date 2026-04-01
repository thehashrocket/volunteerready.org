import { describe, expect, it } from 'vitest';
import {
	getFooterPages,
	getNavPages,
	getOgPageMeta,
	getSitemapPages,
	PUBLIC_PAGES,
} from '../public-pages';

describe('PUBLIC_PAGES registry', () => {
	it('has unique slugs and hrefs', () => {
		const slugs = PUBLIC_PAGES.map((p) => p.slug);
		const hrefs = PUBLIC_PAGES.map((p) => p.href);
		expect(new Set(slugs).size).toBe(slugs.length);
		expect(new Set(hrefs).size).toBe(hrefs.length);
	});

	it('every nav page has label and href', () => {
		for (const page of PUBLIC_PAGES.filter((p) => p.nav)) {
			expect(page.label).toBeTruthy();
			expect(page.href).toMatch(/^\//);
		}
	});

	it('every page with og has heading and subheading', () => {
		for (const page of PUBLIC_PAGES.filter((p) => p.og)) {
			expect(page.og?.heading).toBeTruthy();
			expect(page.og?.subheading).toBeTruthy();
		}
	});

	it('every page with sitemap has valid changeFrequency and priority', () => {
		const validFrequencies = ['daily', 'weekly', 'monthly', 'yearly'];
		for (const page of PUBLIC_PAGES.filter((p) => p.sitemap)) {
			expect(validFrequencies).toContain(page.sitemap?.changeFrequency);
			expect(page.sitemap?.priority).toBeGreaterThanOrEqual(0);
			expect(page.sitemap?.priority).toBeLessThanOrEqual(1);
		}
	});
});

describe('getNavPages()', () => {
	it('returns only pages with nav: true', () => {
		const navPages = getNavPages();
		expect(navPages.length).toBeGreaterThan(0);
		for (const page of navPages) {
			expect(page).toHaveProperty('label');
			expect(page).toHaveProperty('href');
		}
	});

	it('includes search', () => {
		const navPages = getNavPages();
		expect(navPages.some((p) => p.href === '/search')).toBe(true);
	});
});

describe('getFooterPages()', () => {
	it('returns Platform pages', () => {
		const pages = getFooterPages('Platform');
		expect(pages.length).toBeGreaterThan(0);
	});

	it('returns Legal pages', () => {
		const pages = getFooterPages('Legal');
		expect(pages.length).toBeGreaterThan(0);
	});

	it('returns empty for unknown section', () => {
		expect(getFooterPages('Unknown')).toEqual([]);
	});
});

describe('getSitemapPages()', () => {
	it('returns pages with sitemap config', () => {
		const pages = getSitemapPages();
		expect(pages.length).toBeGreaterThan(0);
		for (const page of pages) {
			expect(page).toHaveProperty('href');
			expect(page).toHaveProperty('changeFrequency');
			expect(page).toHaveProperty('priority');
		}
	});
});

describe('getOgPageMeta()', () => {
	it('returns a record of slug to heading/subheading', () => {
		const meta = getOgPageMeta();
		expect(Object.keys(meta).length).toBeGreaterThan(0);
		for (const [slug, data] of Object.entries(meta)) {
			expect(slug).toBeTruthy();
			expect(data.heading).toBeTruthy();
			expect(data.subheading).toBeTruthy();
		}
	});

	it('includes search', () => {
		const meta = getOgPageMeta();
		expect(meta.search).toBeDefined();
	});
});
