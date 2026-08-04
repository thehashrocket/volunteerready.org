import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import config from '../docs/.vitepress/config.mts';

/**
 * `pnpm docs:build` does NOT validate `themeConfig.nav` / `themeConfig.sidebar`.
 *
 * This was verified empirically, not assumed: inserting a `link:
 * "/THIS_PAGE_DOES_NOT_EXIST"` into either the nav or the sidebar and running
 * `vitepress build` reports `build complete` and exits 0. VitePress only
 * accumulates dead-link failures while transforming `.md` files, so a link that
 * lives in the CONFIG rather than in markdown is never checked.
 *
 * That is exactly the regression that went unnoticed for ~5 months: commit
 * 3109623 (2026-03-09, "cleaned up docs/guide") deleted all six `docs/guide/*`
 * stubs, and the nav kept pointing at them. Every nav link 404'd. The build
 * stayed green the whole time.
 *
 * So the docs:build CI step catches Vue parse errors and dead links *in
 * markdown*, and this test catches dead links *in the config*. Both are needed;
 * neither substitutes for the other.
 */

const DOCS_ROOT = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'..',
	'docs',
);

/** Mirrors VitePress's clean-URL resolution: `/FOO` → `docs/FOO.md` or `docs/FOO/index.md`. */
function resolvesToPage(link: string): boolean {
	const clean = link.replace(/[#?].*$/, '').replace(/\/$/, '');
	const rel = clean === '' ? 'index' : clean.replace(/^\//, '');
	return (
		existsSync(path.join(DOCS_ROOT, `${rel}.md`)) ||
		existsSync(path.join(DOCS_ROOT, rel, 'index.md'))
	);
}

type NavLike = { text?: string; link?: string; items?: NavLike[] };

/** Flattens nav/sidebar into `{label, link}` pairs. Sidebar may be an array or a path-keyed record. */
function collectLinks(
	node: unknown,
	out: { label: string; link: string }[] = [],
) {
	if (Array.isArray(node)) {
		for (const child of node) collectLinks(child, out);
		return out;
	}
	if (node && typeof node === 'object') {
		const entry = node as NavLike;
		// A sidebar keyed by path (`{"/guide/": [...]}`) has no `text`/`link` of its own.
		if (!('text' in entry) && !('link' in entry) && !('items' in entry)) {
			for (const value of Object.values(node)) collectLinks(value, out);
			return out;
		}
		if (typeof entry.link === 'string')
			out.push({ label: entry.text ?? entry.link, link: entry.link });
		if (entry.items) collectLinks(entry.items, out);
	}
	return out;
}

const themeConfig = (config.themeConfig ?? {}) as {
	nav?: unknown;
	sidebar?: unknown;
};
const navLinks = collectLinks(themeConfig.nav);
const sidebarLinks = collectLinks(themeConfig.sidebar);

describe('VitePress nav and sidebar links', () => {
	// Guards the collector itself: if `collectLinks` silently returned [] (a shape
	// change in the config, a refactor to a record-keyed sidebar), every
	// it.each below would vacuously pass and this test would protect nothing.
	it('finds links to check in both nav and sidebar', () => {
		expect(navLinks.length).toBeGreaterThan(0);
		expect(sidebarLinks.length).toBeGreaterThan(0);
	});

	it.each(navLinks)(
		'nav "$label" → $link resolves to a docs page',
		({ link }) => {
			if (/^https?:\/\//.test(link)) return;
			expect(
				resolvesToPage(link),
				`nav link ${link} has no corresponding file under docs/`,
			).toBe(true);
		},
	);

	it.each(sidebarLinks)(
		'sidebar "$label" → $link resolves to a docs page',
		({ link }) => {
			if (/^https?:\/\//.test(link)) return;
			expect(
				resolvesToPage(link),
				`sidebar link ${link} has no corresponding file under docs/`,
			).toBe(true);
		},
	);
});
