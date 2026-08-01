// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { usePendingIds } from './use-pending-ids';

/**
 * The property that matters is CONCURRENCY. The shape this hook replaced —
 * `mutation.isPending ? mutation.variables?.id : undefined` — cannot hold more
 * than one row, because query-core's `mutate()` detaches the observer from the
 * previous call. Every test below that involves two ids is a test the old shape
 * would fail.
 */
describe('usePendingIds', () => {
	it('reports nothing pending initially', () => {
		const { result } = renderHook(() => usePendingIds());

		expect(result.current.has('a')).toBe(false);
	});

	it('marks a row pending and releases it on settle', () => {
		const { result } = renderHook(() => usePendingIds());

		act(() => result.current.start('a'));
		expect(result.current.has('a')).toBe(true);

		act(() => result.current.finish('a'));
		expect(result.current.has('a')).toBe(false);
	});

	it('holds MULTIPLE rows at once — the whole point', () => {
		// The regression: acting on row B while A was in flight silently
		// re-enabled A, so a second write for A could be issued against an
		// unsettled first one.
		const { result } = renderHook(() => usePendingIds());

		act(() => result.current.start('a'));
		act(() => result.current.start('b'));

		expect(result.current.has('a')).toBe(true);
		expect(result.current.has('b')).toBe(true);
	});

	it('releases only the row that settled, leaving the other in flight', () => {
		const { result } = renderHook(() => usePendingIds());

		act(() => {
			result.current.start('a');
			result.current.start('b');
		});
		act(() => result.current.finish('a'));

		expect(result.current.has('a')).toBe(false);
		expect(result.current.has('b')).toBe(true);
	});

	it('is keyed by ROW, so several mutations on one row settle as one', () => {
		// Shifts drives complete/cancel/delete through one instance. The question
		// the list asks is "is this shift busy", not "which mutation is running".
		const { result } = renderHook(() => usePendingIds());

		act(() => result.current.start('shift-1'));
		act(() => result.current.start('shift-1'));
		act(() => result.current.finish('shift-1'));

		expect(result.current.has('shift-1')).toBe(false);
	});

	it('ignores a settle for a row that was never started', () => {
		// `onSettled` can fire for a mutation whose `onMutate` never ran (an
		// input-validation rejection before the request). It must not throw or
		// corrupt the set.
		const { result } = renderHook(() => usePendingIds());

		act(() => result.current.start('a'));
		act(() => result.current.finish('never-started'));

		expect(result.current.has('a')).toBe(true);
	});

	it('keeps a stable identity when nothing changed, so rows do not re-render', () => {
		const { result } = renderHook(() => usePendingIds());

		act(() => result.current.start('a'));
		const after = result.current.has;
		act(() => result.current.finish('never-started'));

		// A no-op settle returns the SAME set instance, so `has` is unchanged and
		// React skips the re-render — this is why `start`/`finish` bail out early
		// rather than always cloning.
		expect(result.current.has).toBe(after);
	});
});
