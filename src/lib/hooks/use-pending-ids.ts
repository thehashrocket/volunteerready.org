'use client';

import { useCallback, useState } from 'react';

/**
 * Track which ROWS have a mutation in flight, so a list can disable exactly
 * those and leave every other row live.
 *
 * ## Why not `mutation.variables`
 *
 * The obvious version of this is `mutation.isPending ? mutation.variables?.id
 * : undefined`, and it is wrong in a way that only shows up under concurrency.
 * `MutationObserver.mutate()` in query-core detaches the observer from the
 * previous call before starting the next one:
 *
 * ```js
 * mutate(variables, options) {
 *   this.#mutateOptions = options;
 *   this.#currentMutation?.removeObserver(this);   // <- here
 *   this.#currentMutation = this.#client.getMutationCache().build(...);
 * ```
 *
 * So `variables` and `isPending` describe only the MOST RECENT call. Act on row
 * B while row A is still in flight and A's controls silently re-enable, which
 * means at most one row is ever disabled no matter how many requests are open.
 *
 * That matters because the thing it replaced was a bare `mutation.isPending`
 * gating every row — ugly (the whole list greys out on one click) but sound: it
 * made concurrent submits impossible. Swapping it for `variables` alone traded a
 * real safety property for the cosmetics. On `/app/settings/team` the concrete
 * failure is two `members.updateRole` writes for the same member in flight on
 * separate requests with no ordering guarantee, so the member can land on the
 * role from the FIRST click while the coordinator watched the second succeed.
 *
 * A `Set` keeps both properties: only the acting rows disable, and they all stay
 * disabled until their own request settles.
 *
 * ## Usage
 *
 * ```ts
 * const pending = usePendingIds();
 * const updateRole = trpc.members.updateRole.useMutation({
 *   onMutate: (vars) => pending.start(vars.memberId),
 *   onSettled: (_data, _err, vars) => pending.finish(vars.memberId),
 *   onSuccess: () => { … },
 * });
 * // …
 * disabled={pending.has(member.id)}
 * ```
 *
 * `onSettled` rather than `onSuccess`/`onError` so a row is released on BOTH
 * outcomes — releasing only on success leaves a failed row disabled forever,
 * which is the opposite failure and a worse one.
 *
 * Several mutations can share one instance (shifts has three); the set is keyed
 * by row id, not by mutation, so "is this row busy" stays one question.
 */
export function usePendingIds() {
	const [ids, setIds] = useState<ReadonlySet<string>>(() => new Set());

	const start = useCallback((id: string) => {
		setIds((prev) => {
			if (prev.has(id)) return prev;
			const next = new Set(prev);
			next.add(id);
			return next;
		});
	}, []);

	const finish = useCallback((id: string) => {
		setIds((prev) => {
			if (!prev.has(id)) return prev;
			const next = new Set(prev);
			next.delete(id);
			return next;
		});
	}, []);

	const has = useCallback((id: string) => ids.has(id), [ids]);

	return { has, start, finish };
}
