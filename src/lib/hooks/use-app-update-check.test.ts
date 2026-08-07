// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BUILD_ID } from '@/lib/app-version';
import {
	CHECK_FLOOR_MS,
	FAILURE_BREADCRUMB_THRESHOLD,
	markReloadingFor,
	RELOADED_FOR_KEY,
	shouldCheckForUpdate,
	useAppUpdateCheck,
} from './use-app-update-check';

/**
 * `shouldCheckForUpdate` is pure, so its branches are a table. The hook's own
 * tests concentrate on the failure branches, because every one of them must
 * collapse to "unknown" and NONE of them may read as "changed" — a false
 * positive here tells someone to discard unsaved work for nothing.
 */

describe('shouldCheckForUpdate', () => {
	const FLOOR = 1000;

	it('never checks while the tab is hidden', () => {
		expect(shouldCheckForUpdate(null, 10_000, FLOOR, 'hidden')).toBe(false);
		expect(shouldCheckForUpdate(0, 10_000, FLOOR, 'hidden')).toBe(false);
	});

	it('checks on the first opportunity', () => {
		expect(shouldCheckForUpdate(null, 0, FLOOR, 'visible')).toBe(true);
	});

	it('refuses within the floor', () => {
		expect(shouldCheckForUpdate(5_000, 5_999, FLOOR, 'visible')).toBe(false);
	});

	it('allows exactly at the floor', () => {
		// The boundary. `>` instead of `>=` silently doubles the effective
		// interval for a tab that is focused on a timer.
		expect(shouldCheckForUpdate(5_000, 6_000, FLOOR, 'visible')).toBe(true);
	});

	it('allows past the floor', () => {
		expect(shouldCheckForUpdate(5_000, 60_000, FLOOR, 'visible')).toBe(true);
	});

	it('uses a five-minute floor in production', () => {
		expect(CHECK_FLOOR_MS).toBe(5 * 60 * 1000);
	});
});

function respondWith(body: unknown, init?: { ok?: boolean; text?: string }) {
	return vi.fn().mockResolvedValue({
		ok: init?.ok ?? true,
		status: init?.ok === false ? 500 : 200,
		json: async () => {
			if (init?.text !== undefined) throw new SyntaxError('Unexpected token <');
			return body;
		},
	});
}

describe('useAppUpdateCheck', () => {
	beforeEach(() => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		window.sessionStorage.clear();
	});

	afterEach(() => {
		vi.restoreAllMocks();
		window.sessionStorage.clear();
	});

	it('stays idle when the deployed build matches', async () => {
		vi.stubGlobal('fetch', respondWith({ buildId: BUILD_ID, version: '1.0' }));
		const { result } = renderHook(() => useAppUpdateCheck());
		await waitFor(() => expect(fetch).toHaveBeenCalled());
		expect(result.current.isUpdateAvailable).toBe(false);
	});

	it('reports an update when the build differs', async () => {
		vi.stubGlobal(
			'fetch',
			respondWith({ buildId: 'other', version: '9.9.9.9', severity: 'notice' }),
		);
		const { result } = renderHook(() => useAppUpdateCheck());
		await waitFor(() => expect(result.current.isUpdateAvailable).toBe(true));
		expect(result.current.deployedVersion).toBe('9.9.9.9');
		expect(result.current.severity).toBe('notice');
	});

	it('defaults severity to silent when the field is missing or unknown', async () => {
		vi.stubGlobal('fetch', respondWith({ buildId: 'other', severity: 'LOUD' }));
		const { result } = renderHook(() => useAppUpdateCheck());
		await waitFor(() => expect(result.current.isUpdateAvailable).toBe(true));
		// An unrecognised severity must not be treated as permission to
		// interrupt. Failing closed here is the whole point of the default.
		expect(result.current.severity).toBe('silent');
	});

	describe('failure branches all read as UNKNOWN, never as changed', () => {
		it('an empty buildId does not count as a new version', async () => {
			// '' never equals ours, so a naive comparison prompts everyone
			// forever — the exact failure the build wiring is guarded against.
			vi.stubGlobal('fetch', respondWith({ buildId: '' }));
			const { result } = renderHook(() => useAppUpdateCheck());
			await waitFor(() => expect(fetch).toHaveBeenCalled());
			expect(result.current.isUpdateAvailable).toBe(false);
		});

		it('a missing buildId does not count as a new version', async () => {
			vi.stubGlobal('fetch', respondWith({ version: '9.9.9.9' }));
			const { result } = renderHook(() => useAppUpdateCheck());
			await waitFor(() => expect(fetch).toHaveBeenCalled());
			expect(result.current.isUpdateAvailable).toBe(false);
		});

		it('a non-2xx response does not count as a new version', async () => {
			vi.stubGlobal('fetch', respondWith({ buildId: 'other' }, { ok: false }));
			const { result } = renderHook(() => useAppUpdateCheck());
			await waitFor(() => expect(fetch).toHaveBeenCalled());
			expect(result.current.isUpdateAvailable).toBe(false);
		});

		it('an HTML error page does not count as a new version', async () => {
			vi.stubGlobal('fetch', respondWith(null, { text: '<!DOCTYPE html>' }));
			const { result } = renderHook(() => useAppUpdateCheck());
			await waitFor(() => expect(fetch).toHaveBeenCalled());
			expect(result.current.isUpdateAvailable).toBe(false);
		});

		it('an offline rejection does not count as a new version', async () => {
			vi.stubGlobal(
				'fetch',
				vi.fn().mockRejectedValue(new TypeError('offline')),
			);
			const { result } = renderHook(() => useAppUpdateCheck());
			await waitFor(() => expect(fetch).toHaveBeenCalled());
			expect(result.current.isUpdateAvailable).toBe(false);
		});

		it('shows the user nothing on failure', async () => {
			vi.stubGlobal(
				'fetch',
				vi.fn().mockRejectedValue(new TypeError('offline')),
			);
			const { result } = renderHook(() => useAppUpdateCheck());
			await waitFor(() => expect(fetch).toHaveBeenCalled());
			expect(result.current).toEqual({
				isUpdateAvailable: false,
				deployedBuildId: '',
				deployedVersion: '',
				severity: 'silent',
			});
		});
	});

	describe('the reload loop guard', () => {
		it('suppresses a build this tab already reloaded for', async () => {
			// The inescapable-prompt case: a reload landed on a stale cached
			// shell, so our BUILD_ID is unchanged and the difference is still
			// there. Without this the strip returns on every check, forever.
			window.sessionStorage.setItem(RELOADED_FOR_KEY, 'other');
			vi.stubGlobal('fetch', respondWith({ buildId: 'other', version: '9.9' }));
			const { result } = renderHook(() => useAppUpdateCheck());
			await waitFor(() => expect(fetch).toHaveBeenCalled());
			expect(result.current.isUpdateAvailable).toBe(false);
			expect(console.error).toHaveBeenCalledWith(
				expect.stringContaining('reload did not change'),
				expect.anything(),
			);
		});

		it('still prompts for a DIFFERENT build than the one reloaded for', async () => {
			// Otherwise one bad reload silences every future release too.
			window.sessionStorage.setItem(RELOADED_FOR_KEY, 'older-build');
			vi.stubGlobal(
				'fetch',
				respondWith({ buildId: 'newest', version: '9.9' }),
			);
			const { result } = renderHook(() => useAppUpdateCheck());
			await waitFor(() => expect(result.current.isUpdateAvailable).toBe(true));
		});

		it('markReloadingFor persists across a reload, in sessionStorage', () => {
			// A ref or module variable would be destroyed by location.reload(),
			// which is the exact event this must survive.
			markReloadingFor('abc123');
			expect(window.sessionStorage.getItem(RELOADED_FOR_KEY)).toBe('abc123');
			expect(window.localStorage.getItem(RELOADED_FOR_KEY)).toBeNull();
		});

		it('markReloadingFor survives blocked storage', () => {
			vi.spyOn(window.sessionStorage, 'setItem').mockImplementation(() => {
				throw new DOMException('blocked', 'SecurityError');
			});
			expect(() => markReloadingFor('abc123')).not.toThrow();
		});
	});

	describe('failure reporting', () => {
		it('reports once at the threshold, not on every failure', async () => {
			const fetchMock = vi.fn().mockRejectedValue(new TypeError('offline'));
			vi.stubGlobal('fetch', fetchMock);
			const { result } = renderHook(() => useAppUpdateCheck());
			await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

			// Drive further checks past the floor by firing focus with time moved
			// on; the floor is what normally spaces these out.
			const realNow = Date.now;
			for (let i = 2; i <= FAILURE_BREADCRUMB_THRESHOLD + 2; i++) {
				vi.spyOn(Date, 'now').mockReturnValue(realNow() + i * CHECK_FLOOR_MS);
				window.dispatchEvent(new Event('focus'));
				await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(i));
			}

			const reports = (
				console.error as unknown as { mock: { calls: unknown[][] } }
			).mock.calls.filter((call) =>
				String(call[0]).includes('consecutive failures'),
			);
			// Exactly one, however long the outage lasts. `>=` instead of `===`
			// in the hook turns this into one report per check.
			expect(reports).toHaveLength(1);
			expect(result.current.isUpdateAvailable).toBe(false);
		});
	});

	it('removes its listeners on unmount', () => {
		vi.stubGlobal('fetch', respondWith({ buildId: BUILD_ID }));
		const removeDoc = vi.spyOn(document, 'removeEventListener');
		const removeWin = vi.spyOn(window, 'removeEventListener');
		const { unmount } = renderHook(() => useAppUpdateCheck());
		unmount();
		expect(removeDoc).toHaveBeenCalledWith(
			'visibilitychange',
			expect.any(Function),
		);
		expect(removeWin).toHaveBeenCalledWith('focus', expect.any(Function));
	});
});
