'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Remembered "don't show me this again", with the three properties every
 * hand-rolled copy in this repo was missing at least one of.
 *
 * There were four independent implementations before this hook, and they
 * disagreed: `cookie-consent-banner.tsx` and `ios-install-prompt.tsx` wrapped
 * their storage access in try/catch, `referral-prompt.tsx` and
 * `install-prompt.tsx` did not — and `ios-install-prompt.tsx` even documented
 * why the guard was needed while two files written later went without it. The
 * pattern had already rotted by copy-paste, so a fifth copy would have been a
 * coin flip.
 *
 * The three properties:
 *
 * 1. GUARDED. Touching `localStorage` throws `SecurityError` outright when
 *    storage is disabled by policy or privacy mode — not on write, on ACCESS.
 *    These reads run inside `useEffect`, so an unguarded throw surfaces as an
 *    error boundary, i.e. a blank region of the app rather than a missing
 *    banner. Every read and write here is wrapped, and a failure degrades to
 *    "not dismissed, and dismissal lasts this session only", which keeps the
 *    prompt usable instead of breaking the page around it.
 *
 * 2. SCOPED. Passing a `scope` (a version string, say) makes the dismissal
 *    apply to that value only, so it re-arms on the next release. Without it
 *    the choice is between nagging every navigation and silencing the prompt
 *    forever, and no existing copy supported anything in between.
 *
 * 3. CROSS-TAB. A coordinator with two tabs open dismisses in one; the other
 *    has already read its state and would otherwise keep showing the prompt.
 *    The `storage` event syncs them.
 *
 * Starts DISMISSED and flips after the effect reads storage. That ordering is
 * deliberate: the opposite default paints the prompt on first render and pulls
 * it away once storage says it was already dismissed, which is a flash of
 * something the user explicitly dismissed.
 */
export type Dismissible = {
	/** True until the effect has read storage — see the note above. */
	isDismissed: boolean;
	dismiss: () => void;
};

function read(key: string): string | null {
	try {
		return window.localStorage.getItem(key);
	} catch {
		// Storage blocked by policy or privacy mode. "Not dismissed" is the
		// safe answer: the prompt shows, and dismissing it works for this
		// session even though nothing is persisted.
		return null;
	}
}

function write(key: string, value: string): void {
	try {
		window.localStorage.setItem(key, value);
	} catch {
		// Same as above. The in-memory state below still updates, so the user's
		// click is honoured for as long as the page is open.
	}
}

/**
 * Whether a stored value counts as dismissed.
 *
 * UNSCOPED reads accept ANY non-empty value, which is a compatibility
 * requirement rather than laziness: the copies this hook replaced disagreed on
 * the sentinel. `referral-prompt` wrote `'true'`, `install-prompt` wrote `'1'`
 * and tested it with a bare truthiness check. An exact match on a single
 * sentinel would have re-shown the install prompt to every user who had
 * already dismissed it — a silent regression carried by real users' storage,
 * invisible to every test that starts from an empty store.
 *
 * SCOPED reads require an exact match, because that is the entire point: a
 * dismissal recorded for one release must not satisfy the next.
 */
function matches(stored: string | null, scope: string | undefined): boolean {
	if (stored === null || stored === '') return false;
	return scope === undefined ? true : stored === scope;
}

/**
 * `scope` absent means "dismissed forever" and stores a sentinel; `scope`
 * present means "dismissed for this value" and stores the value itself.
 */
export function useDismissible(key: string, scope?: string): Dismissible {
	const target = scope ?? 'true';
	const [isDismissed, setIsDismissed] = useState(true);

	useEffect(() => {
		setIsDismissed(matches(read(key), scope));

		const handleStorage = (event: StorageEvent) => {
			// `storageArea` matters: `sessionStorage` writes fire this event too,
			// and a same-tab iframe can raise one for a different area entirely.
			// Without the check, an unrelated sessionStorage key of the same name
			// would flip the prompt.
			if (event.storageArea !== window.localStorage) return;
			// A null key means the whole store was cleared; re-read rather than
			// guess, since that un-dismisses everything.
			if (event.key !== null && event.key !== key) return;
			setIsDismissed(matches(read(key), scope));
		};

		window.addEventListener('storage', handleStorage);
		return () => window.removeEventListener('storage', handleStorage);
	}, [key, scope]);

	const dismiss = useCallback(() => {
		write(key, target);
		// Set state regardless of whether the write landed — a user whose
		// browser refuses storage still gets the prompt out of the way now.
		setIsDismissed(true);
	}, [key, target]);

	return { isDismissed, dismiss };
}
