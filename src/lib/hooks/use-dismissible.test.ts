// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDismissible } from './use-dismissible';

/**
 * The cases worth pinning are the ones the four hand-rolled copies this hook
 * replaces got wrong: storage that THROWS on access (two of the four were
 * unguarded), a dismissal that must re-arm on the next scope, and the
 * cross-tab sync none of them had.
 */

const KEY = 'vr_test_dismissible';

afterEach(() => {
	vi.restoreAllMocks();
	window.localStorage.clear();
});

/** Replaces the whole storage object so ACCESS throws, not just the call. */
function blockStorage() {
	vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
		throw new DOMException('blocked', 'SecurityError');
	});
	vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
		throw new DOMException('blocked', 'SecurityError');
	});
}

describe('reading', () => {
	it('reports not-dismissed when storage is empty', () => {
		const { result } = renderHook(() => useDismissible(KEY));
		expect(result.current.isDismissed).toBe(false);
	});

	it('reports dismissed when the sentinel is stored', () => {
		window.localStorage.setItem(KEY, 'true');
		const { result } = renderHook(() => useDismissible(KEY));
		expect(result.current.isDismissed).toBe(true);
	});

	it('survives storage that throws on access', () => {
		// The failure mode this replaces: an unguarded read inside useEffect
		// surfaces as an error boundary — a blank region, not a missing banner.
		blockStorage();
		const { result } = renderHook(() => useDismissible(KEY));
		expect(result.current.isDismissed).toBe(false);
	});
});

describe('writing', () => {
	it('persists the dismissal', () => {
		const { result } = renderHook(() => useDismissible(KEY));
		act(() => result.current.dismiss());
		expect(result.current.isDismissed).toBe(true);
		expect(window.localStorage.getItem(KEY)).toBe('true');
	});

	it('still hides the prompt when the write throws', () => {
		blockStorage();
		const { result } = renderHook(() => useDismissible(KEY));
		act(() => result.current.dismiss());
		// Session-only, but the user's click is honoured. Returning false here
		// would leave a prompt that cannot be dismissed at all.
		expect(result.current.isDismissed).toBe(true);
	});
});

describe('scoping', () => {
	it('stores the scope rather than a sentinel', () => {
		const { result } = renderHook(() => useDismissible(KEY, '0.41.12.0'));
		act(() => result.current.dismiss());
		expect(window.localStorage.getItem(KEY)).toBe('0.41.12.0');
	});

	it('re-arms when the scope changes', () => {
		window.localStorage.setItem(KEY, '0.41.12.0');
		const { result, rerender } = renderHook(
			({ scope }) => useDismissible(KEY, scope),
			{ initialProps: { scope: '0.41.12.0' } },
		);
		expect(result.current.isDismissed).toBe(true);

		rerender({ scope: '0.41.13.0' });
		// The whole point of scoping: a dismissal is about one release, not
		// about the prompt forever.
		expect(result.current.isDismissed).toBe(false);
	});

	it('reads a version-shaped value as dismissed when unscoped', () => {
		// Documenting the asymmetry rather than asserting the reverse. An
		// unscoped read accepts ANY non-empty value (see the compatibility
		// block below), so a scoped write is "dismissed" to an unscoped reader.
		//
		// That is only safe because a key belongs to ONE consumer: a prompt
		// either scopes its dismissals or it does not, and no two prompts share
		// a key. If a caller ever needs both readings of one key, the answer is
		// two keys, not a stricter rule here — a stricter rule re-shows the
		// install prompt to every user who already dismissed it.
		window.localStorage.setItem(KEY, '0.41.12.0');
		const { result } = renderHook(() => useDismissible(KEY));
		expect(result.current.isDismissed).toBe(true);
	});
});

describe('cross-tab sync', () => {
	function fireStorage(init: Partial<StorageEvent>) {
		const event = new StorageEvent('storage', { key: KEY, ...init });
		// jsdom does not populate storageArea from the init dict, and the hook
		// filters on it, so it is defined explicitly here.
		Object.defineProperty(event, 'storageArea', {
			value: init.storageArea ?? window.localStorage,
		});
		act(() => {
			window.dispatchEvent(event);
		});
	}

	it('picks up a dismissal made in another tab', () => {
		const { result } = renderHook(() => useDismissible(KEY));
		expect(result.current.isDismissed).toBe(false);

		window.localStorage.setItem(KEY, 'true');
		fireStorage({ newValue: 'true' });
		expect(result.current.isDismissed).toBe(true);
	});

	it('ignores events for a different key', () => {
		window.localStorage.setItem(KEY, 'true');
		const { result } = renderHook(() => useDismissible(KEY));
		expect(result.current.isDismissed).toBe(true);

		window.localStorage.removeItem(KEY);
		fireStorage({ key: 'some_other_key' });
		// Not re-read, so the stale-but-correct value stands.
		expect(result.current.isDismissed).toBe(true);
	});

	it('ignores events from a different storage area', () => {
		// sessionStorage writes raise `storage` events too. Without the
		// storageArea filter, an unrelated sessionStorage key of the same name
		// would flip the prompt.
		window.localStorage.setItem(KEY, 'true');
		const { result } = renderHook(() => useDismissible(KEY));
		expect(result.current.isDismissed).toBe(true);

		window.localStorage.removeItem(KEY);
		fireStorage({ storageArea: window.sessionStorage });
		expect(result.current.isDismissed).toBe(true);
	});

	it('re-reads on a whole-store clear (null key)', () => {
		window.localStorage.setItem(KEY, 'true');
		const { result } = renderHook(() => useDismissible(KEY));
		expect(result.current.isDismissed).toBe(true);

		window.localStorage.clear();
		fireStorage({ key: null });
		expect(result.current.isDismissed).toBe(false);
	});

	it('removes its listener on unmount', () => {
		const remove = vi.spyOn(window, 'removeEventListener');
		const { unmount } = renderHook(() => useDismissible(KEY));
		unmount();
		expect(remove).toHaveBeenCalledWith('storage', expect.any(Function));
	});
});

describe('compatibility with the sentinels this hook replaced', () => {
	it("accepts install-prompt's legacy '1'", () => {
		// `install-prompt` wrote '1' and tested it with a bare truthiness check.
		// An exact match on 'true' would re-show the prompt to every user who
		// had already dismissed it — a regression living in real users' storage
		// that no test starting from an empty store would ever see.
		window.localStorage.setItem(KEY, '1');
		const { result } = renderHook(() => useDismissible(KEY));
		expect(result.current.isDismissed).toBe(true);
	});

	it('treats an empty stored value as not dismissed', () => {
		window.localStorage.setItem(KEY, '');
		const { result } = renderHook(() => useDismissible(KEY));
		expect(result.current.isDismissed).toBe(false);
	});

	it('still requires an exact match when scoped', () => {
		// The permissive rule above must not leak into the scoped case, or a
		// stale dismissal from any earlier release would silence every future
		// one.
		window.localStorage.setItem(KEY, '1');
		const { result } = renderHook(() => useDismissible(KEY, '0.41.12.0'));
		expect(result.current.isDismissed).toBe(false);
	});
});
