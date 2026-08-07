// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BUILD_ID } from '@/lib/app-version';
import { SwRegister } from './sw-register';

/**
 * Isolates the half `e2e/service-worker.spec.ts` cannot separate.
 *
 * That spec reads the CACHE NAME out of a real browser, which is the product of
 * two things at once: the query this component sends, and `sw.js` reading it
 * back. Either could be wrong while the pair happens to agree. This pins the
 * sending half on its own, in the fast suite.
 *
 * Why it matters more than it looks: `sw.js` is a static file no build step
 * rewrites, so this query string is the ONLY thing that differs between one
 * deploy's worker and the next. Without it the browser byte-compares an
 * identical script, installs nothing, and `activate` never runs again — which
 * is the frozen-cache bug that shipped for the life of the file.
 */

function mockServiceWorker() {
	const register = vi.fn().mockResolvedValue({});
	Object.defineProperty(navigator, 'serviceWorker', {
		value: { register },
		configurable: true,
		writable: true,
	});
	return register;
}

afterEach(() => {
	vi.restoreAllMocks();
	// Restores the jsdom default, which is the "unsupported browser" shape the
	// second test below depends on.
	Reflect.deleteProperty(navigator, 'serviceWorker');
});

describe('SwRegister', () => {
	it('stamps the build id onto the script URL', () => {
		const register = mockServiceWorker();

		render(<SwRegister />);

		expect(register).toHaveBeenCalledTimes(1);
		const url = register.mock.calls[0]?.[0] as string;

		// Asserted separately from the exact value below: `BUILD_ID` is empty in
		// this environment (neither `NEXT_PUBLIC_*` var is set outside a Next
		// build), so an equality check alone would still pass against a bare
		// `/sw.js` if the template literal were removed.
		expect(url).toContain('?v=');
		expect(url).toBe(`/sw.js?v=${encodeURIComponent(BUILD_ID)}`);
	});

	it('does nothing where service workers are unavailable', () => {
		// jsdom has no `navigator.serviceWorker` by default, so this is the real
		// shape of an unsupported browser rather than a simulated one.
		expect(() => render(<SwRegister />)).not.toThrow();
	});

	it('survives a registration that rejects', async () => {
		const register = vi.fn().mockRejectedValue(new Error('blocked'));
		Object.defineProperty(navigator, 'serviceWorker', {
			value: { register },
			configurable: true,
			writable: true,
		});

		render(<SwRegister />);
		// An unhandled rejection here fails the run; the `.catch` is what stops
		// a browser that blocks service workers from surfacing an error to a user
		// who cannot act on it.
		await expect(register.mock.results[0]?.value).rejects.toThrow('blocked');
	});
});
