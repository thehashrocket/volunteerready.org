// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The freeze rule used to live inline in `AddVolunteerDialog` behind a comment
 * saying it was "not reachable in jsdom (no layout) or the e2e (fixed
 * viewport), so it is held by this comment rather than a test".
 *
 * That was true of the visible consequence — which shell paints — and it is
 * still true. It was never true of the RESOLUTION, which is a pure function of
 * `open` and the live query and is exactly what these tests drive. Extracting
 * the hook is what made the distinction available.
 */
const mocks = vi.hoisted(() => ({
	isDesktop: true,
	queries: [] as string[],
}));

vi.mock('./use-media-query', () => ({
	useMediaQuery: (query: string) => {
		mocks.queries.push(query);
		return mocks.isDesktop;
	},
}));

import {
	DESKTOP_QUERY,
	useFrozenDesktopShell,
} from './use-frozen-desktop-shell';

beforeEach(() => {
	mocks.isDesktop = true;
	mocks.queries = [];
});

describe('useFrozenDesktopShell', () => {
	it('reads the lg breakpoint', () => {
		// Pinned as a STRING, not just as a branch outcome: the roster page
		// switches its list on Tailwind's `lg`, and nothing else enforces that the
		// two agree.
		renderHook(() => useFrozenDesktopShell(false));
		expect(mocks.queries).toContain('(min-width: 1024px)');
		expect(DESKTOP_QUERY).toBe('(min-width: 1024px)');
	});

	it('follows the viewport while CLOSED', () => {
		const { result, rerender } = renderHook(
			({ open }) => useFrozenDesktopShell(open),
			{ initialProps: { open: false } },
		);
		expect(result.current).toBe(true);

		act(() => {
			mocks.isDesktop = false;
		});
		rerender({ open: false });

		expect(result.current).toBe(false);
	});

	it('does NOT change shape while open, even as the viewport crosses lg', () => {
		// The iPad rotation case. Without the freeze this flips to false, React
		// unmounts the Dialog subtree and mounts a Drawer, and everything the
		// person had typed goes with it.
		const { result, rerender } = renderHook(
			({ open }) => useFrozenDesktopShell(open),
			{ initialProps: { open: true } },
		);
		expect(result.current).toBe(true);

		act(() => {
			mocks.isDesktop = false;
		});
		rerender({ open: true });

		expect(result.current).toBe(true);
	});

	it('picks up a viewport change that happened while open, once closed', () => {
		// The freeze must not outlive the modal — an idle tab left at a new size
		// has to open in the right shell next time.
		const { result, rerender } = renderHook(
			({ open }) => useFrozenDesktopShell(open),
			{ initialProps: { open: true } },
		);

		act(() => {
			mocks.isDesktop = false;
		});
		rerender({ open: true });
		expect(result.current).toBe(true);

		rerender({ open: false });
		expect(result.current).toBe(false);

		rerender({ open: true });
		expect(result.current).toBe(false);
	});
});
