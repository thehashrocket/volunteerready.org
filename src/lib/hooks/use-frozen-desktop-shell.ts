'use client';

import { useEffect, useState } from 'react';
import { useMediaQuery } from './use-media-query';

/**
 * `lg`. The one breakpoint the roster page switches on, so the list behind a
 * modal and the modal itself can never be in different shapes at the same
 * width. Centralised here rather than repeated as a string literal per modal —
 * `useMediaQuery` takes a query, so two consumers can silently disagree.
 */
export const DESKTOP_QUERY = '(min-width: 1024px)';

/**
 * Resolves Dialog-vs-Drawer for a controlled modal, FROZEN while it is open.
 *
 * `useMediaQuery` is safe to read inside a modal — nothing renders until the
 * trigger is pressed, by which point its effect has run — but it is NOT safe to
 * keep re-reading. `Dialog` and `Drawer` are different root elements, so a live
 * value crossing `lg` unmounts one subtree and mounts the other, taking
 * whatever the person was doing inside it. That is an ordinary gesture: an iPad
 * rotating portrait to landscape crosses 1024 (834 → 1194), as does snapping a
 * desktop window, and `useMediaQuery` subscribes to `change` so it fires every
 * time. Where the modal's `open` state lives on the page, the replacement shell
 * then opens IMMEDIATELY, blank.
 *
 * Freezing rather than hoisting the state: the shells genuinely are different
 * components, and a modal that changes shape underneath someone mid-sentence is
 * wrong even if its contents survived. Re-reading while closed keeps an idle
 * tab correct.
 *
 * Extracted from `AddVolunteerDialog` when the roster's detail dialog became
 * the second consumer. It is exactly the kind of subtle effect-timing logic
 * that gets miscopied — and it was previously held by a comment admitting it
 * was untestable in jsdom, which is no longer true of the hook itself: see
 * `use-frozen-desktop-shell.test.ts`, which toggles the query across the freeze
 * boundary directly. (What remains untestable is the *visual* consequence, not
 * the resolution rule.)
 */
export function useFrozenDesktopShell(
	open: boolean,
	/**
	 * Defaults to `lg`, which every roster modal uses. Parameterised because the
	 * app's other two modals (`feedback-widget`, `org-profile-form`) switch at
	 * `md` — without this the rule "never call `useMediaQuery` directly in a
	 * modal" would be unsatisfiable for them, which is a rule that gets ignored
	 * rather than followed.
	 */
	query: string = DESKTOP_QUERY,
): boolean {
	const liveIsDesktop = useMediaQuery(query);

	const [shellIsDesktop, setShellIsDesktop] = useState(liveIsDesktop);
	useEffect(() => {
		if (!open) setShellIsDesktop(liveIsDesktop);
	}, [open, liveIsDesktop]);

	return open ? shellIsDesktop : liveIsDesktop;
}
