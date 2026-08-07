// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_VERSION, BUILD_ID } from '@/lib/app-version';
import {
	CHECK_FLOOR_MS,
	FAILURE_BREADCRUMB_THRESHOLD,
	markReloadingFor,
	RELOADED_FOR_KEY,
	shouldCheckForUpdate,
	useAppUpdateCheck,
	versionCheckUrl,
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

describe('versionCheckUrl', () => {
	it('carries the client release as `since`', () => {
		expect(versionCheckUrl('0.41.15.0')).toBe('/api/version?since=0.41.15.0');
	});

	it('omits the parameter entirely when the version is unset', () => {
		// NOT `?since=`. An empty value claims the client knows its release when
		// it does not, and the server would have to guess what that means.
		expect(versionCheckUrl('')).toBe('/api/version');
	});

	it('encodes a value that would otherwise break the query string', () => {
		expect(versionCheckUrl('a b&c=d')).toBe('/api/version?since=a%20b%26c%3Dd');
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
				notes: [],
				olderNoteCount: 0,
			});
		});
	});

	describe('release notes', () => {
		it('fetches the url the pure builder produces, still with no-store', async () => {
			// Pins BOTH arguments: the query string is appended to the first, and
			// a rewrite that builds the URL correctly while dropping the second
			// would make the response cacheable — the failure that disables this
			// whole feature while looking healthy.
			vi.stubGlobal('fetch', respondWith({ buildId: 'other' }));
			renderHook(() => useAppUpdateCheck());
			await waitFor(() => expect(fetch).toHaveBeenCalled());

			expect(fetch).toHaveBeenCalledWith(versionCheckUrl(APP_VERSION), {
				cache: 'no-store',
			});
		});

		it('exposes the notes the server returned, newest first', async () => {
			vi.stubGlobal(
				'fetch',
				respondWith({
					buildId: 'other',
					severity: 'notice',
					notes: [
						{ version: '0.42.0.0', summary: 'Newest.' },
						{ version: '0.41.0.0', summary: 'Older.' },
					],
					olderCount: 3,
				}),
			);
			const { result } = renderHook(() => useAppUpdateCheck());
			await waitFor(() => expect(result.current.isUpdateAvailable).toBe(true));

			expect(result.current.notes.map((n) => n.summary)).toEqual([
				'Newest.',
				'Older.',
			]);
			expect(result.current.olderNoteCount).toBe(3);
		});

		it('defaults to no notes when the field is absent', async () => {
			// The common release. Must not throw and must not read as an error.
			vi.stubGlobal('fetch', respondWith({ buildId: 'other' }));
			const { result } = renderHook(() => useAppUpdateCheck());
			await waitFor(() => expect(result.current.isUpdateAvailable).toBe(true));
			expect(result.current.notes).toEqual([]);
			expect(result.current.olderNoteCount).toBe(0);
		});

		it.each([
			['a non-array', 'nope'],
			['null', null],
		])('ignores %s notes field', async (_label, notes) => {
			vi.stubGlobal('fetch', respondWith({ buildId: 'other', notes }));
			const { result } = renderHook(() => useAppUpdateCheck());
			await waitFor(() => expect(result.current.isUpdateAvailable).toBe(true));
			expect(result.current.notes).toEqual([]);
		});

		it('drops entries with no usable summary rather than rendering a blank', async () => {
			// A blank summary would paint an empty sentence exactly where the
			// reason to reload belongs — which reads as "nothing changed", worse
			// than the generic copy.
			vi.stubGlobal(
				'fetch',
				respondWith({
					buildId: 'other',
					notes: [
						{ version: '0.42.0.0', summary: '   ' },
						{ version: '0.41.9.0' },
						{ version: '0.41.8.0', summary: 42 },
						null,
						'garbage',
						{ version: '0.41.7.0', summary: 'Real.' },
					],
				}),
			);
			const { result } = renderHook(() => useAppUpdateCheck());
			await waitFor(() => expect(result.current.isUpdateAvailable).toBe(true));
			expect(result.current.notes).toEqual([
				{ version: '0.41.7.0', summary: 'Real.' },
			]);
		});

		it.each([
			['a negative', -5],
			['NaN', Number.NaN],
			['Infinity', Number.POSITIVE_INFINITY],
			['a string', '4'],
		])(
			'clamps %s olderCount to zero instead of rendering it',
			async (_label, olderCount) => {
				// Renders as "Plus NaN more updates." otherwise. The strip's whole
				// job this release is to be the sentence a coordinator trusts.
				vi.stubGlobal('fetch', respondWith({ buildId: 'other', olderCount }));
				const { result } = renderHook(() => useAppUpdateCheck());
				await waitFor(() =>
					expect(result.current.isUpdateAvailable).toBe(true),
				);
				expect(result.current.olderNoteCount).toBe(0);
			},
		);

		it('truncates a fractional olderCount rather than rendering a decimal', async () => {
			vi.stubGlobal(
				'fetch',
				respondWith({ buildId: 'other', olderCount: 3.7 }),
			);
			const { result } = renderHook(() => useAppUpdateCheck());
			await waitFor(() => expect(result.current.isUpdateAvailable).toBe(true));
			expect(result.current.olderNoteCount).toBe(3);
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
