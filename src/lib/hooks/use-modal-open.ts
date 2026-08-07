'use client';

import { useEffect, useState } from 'react';

/**
 * Whether a modal surface is currently open anywhere in the app.
 *
 * Used to hold back the update strip: appearing above the page while someone
 * is mid-way through a dialog is the interruption the strip is meant to avoid.
 *
 * ===================== WHY NOT `data-scroll-locked` ==========================
 * Because it is a VERIFIED trap, not merely a less tidy option.
 * `react-remove-scroll-bar` (a Radix transitive dependency) sets
 * `data-scroll-locked` on `<body>` — and Radix `DropdownMenu` sets it too.
 * `app-shell.tsx` uses `DropdownMenu` for the ACCOUNT MENU, which is exactly
 * where the "Update available" item lives. So the cheap selector makes the
 * strip vanish the moment a user opens the menu the strip is telling them
 * about. `use-modal-open.test.tsx` pins `DropdownMenu -> false` for this
 * reason; it is a regression test written before the regression.
 * =============================================================================
 *
 * The `data-slot` attributes below are stamped unconditionally by
 * `ui/dialog.tsx` and `ui/drawer.tsx` with no opt-in, so a dialog added in a
 * year is covered without anyone remembering this file exists. The coupling to
 * those attribute names is what the test pins, so a shadcn rename fails in CI
 * rather than in production.
 */
const OPEN_MODAL_SELECTOR =
	'[data-slot="dialog-content"][data-state="open"], [data-slot="drawer-content"][data-state="open"]';

function anyModalOpen(): boolean {
	return document.querySelector(OPEN_MODAL_SELECTOR) !== null;
}

export function useModalOpen(): boolean {
	const [isOpen, setIsOpen] = useState(false);

	useEffect(() => {
		const sync = () => setIsOpen(anyModalOpen());
		sync();

		const observer = new MutationObserver(sync);
		// `{ childList: true }` with NO `subtree`. Radix `Portal` appends to
		// `document.body`, so a dialog mounting is an immediate-child mutation
		// and this sees it.
		//
		// `subtree: true` would fire on every table row render, every search
		// keystroke and every "Load more" on /app/volunteers — which renders
		// BOTH the table and the card list at once under the pure-CSS
		// responsive switch. Correct and cheaper at the same time.
		//
		// This breaks only if a dialog is given a custom `container` outside
		// body, which the test's real-component mounts would catch.
		observer.observe(document.body, { childList: true });

		// NOT also listening for focus/close events, deliberately. In a real
		// browser Radix keeps the content mounted through its ~200ms exit
		// animation with `data-state="closed"`, so this observer reports the
		// close a fraction late. A `focusin` listener was written to close that
		// gap and then removed: jsdom unmounts immediately, so nothing could
		// test it, and decision 44 already makes the lateness irrelevant — the
		// strip LATCHES, so a modal closing does not need to be observed
		// promptly, only eventually. Untested code guarding a case the design
		// removed is worse than the 200ms.
		return () => observer.disconnect();
	}, []);

	return isOpen;
}
