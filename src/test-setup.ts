import '@testing-library/jest-dom/vitest';

// Polyfill APIs missing in jsdom
if (typeof globalThis.ResizeObserver === 'undefined') {
	globalThis.ResizeObserver = class {
		observe() {}
		unobserve() {}
		disconnect() {}
	} as unknown as typeof ResizeObserver;
}

if (
	typeof globalThis.window !== 'undefined' &&
	typeof globalThis.window.matchMedia !== 'function'
) {
	globalThis.window.matchMedia = ((query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: () => {},
		removeListener: () => {},
		addEventListener: () => {},
		removeEventListener: () => {},
		dispatchEvent: () => false,
	})) as unknown as typeof window.matchMedia;
}

// jsdom implements no layout, so it ships no scrollIntoView at all. cmdk calls
// it on every selection change to keep the highlighted item visible, which
// makes any Command-based picker unrenderable under jsdom without this.
if (
	typeof globalThis.Element !== 'undefined' &&
	typeof globalThis.Element.prototype.scrollIntoView !== 'function'
) {
	globalThis.Element.prototype.scrollIntoView = () => {};
}

if (typeof globalThis.IntersectionObserver === 'undefined') {
	globalThis.IntersectionObserver = class {
		root = null;
		rootMargin = '';
		thresholds = [];
		observe() {}
		unobserve() {}
		disconnect() {}
		takeRecords() {
			return [];
		}
	} as unknown as typeof IntersectionObserver;
}
