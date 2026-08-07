'use client';

import { RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { AppUpdateState } from '@/lib/hooks/use-app-update-check';
import { markReloadingFor } from '@/lib/hooks/use-app-update-check';
import { useDismissible } from '@/lib/hooks/use-dismissible';

const DISMISSED_KEY = 'vr_app_update_dismissed';

export type AppUpdatePromptProps = {
	update: AppUpdateState;
	/** True while any Dialog or Drawer is open — see the latch note below. */
	isModalOpen: boolean;
	/** False on surfaces that cannot take an interruption (e.g. /app/scan). */
	isAllowedHere: boolean;
};

/**
 * The in-flow update strip.
 *
 * IN FLOW, NOT FIXED, and not a toast. It sits directly below the sticky
 * header and scrolls away with the page, which is only safe because the
 * account menu keeps an `Update available` item for as long as the update is
 * pending — scrolling past this is not losing it.
 *
 * The toaster was tried and rejected against the installed `sonner` stylesheet
 * rather than in the abstract: below 600px it becomes `position: fixed; width:
 * 100%` at a 16px inset, covering the whole 56px header — including the mobile
 * nav toggle, which below `lg` is the only route to the sidebar.
 *
 * =========================== THE LATCH (decision 44) =========================
 * `isModalOpen` gates the transition INTO visible, never the render. Once the
 * strip is up it stays up.
 *
 * Unmounting it when a dialog opens looks reasonable and is worse than the
 * interruption it prevents: a coordinator clicking "Add volunteer" — the exact
 * surface the suppression was written for — would watch every row behind the
 * translucent overlay jump up 48px, then back down on close.
 *
 * The latch also disposes of a timing problem. Radix keeps dialog content
 * mounted through its ~200ms exit animation, so a `childList` observer reports
 * the close slightly late; with the latch, "late" costs nothing, because a
 * closing modal never needs to reveal anything.
 * =============================================================================
 */
export function AppUpdatePrompt({
	update,
	isModalOpen,
	isAllowedHere,
}: AppUpdatePromptProps) {
	const {
		isUpdateAvailable,
		deployedVersion,
		deployedBuildId,
		severity,
		notes,
		olderNoteCount,
	} = update;

	/**
	 * The reason to act, which is the entire point of this strip.
	 *
	 * "VolunteerReady has been updated" tells a coordinator nothing they can
	 * weigh — it was the standing complaint against this prompt, and it stays
	 * only as the fallback for a release nobody wrote a note for (most of them)
	 * and for a rollback, which has no "what's new" by definition.
	 */
	const [firstNote] = notes;
	const headline = firstNote?.summary ?? 'VolunteerReady has been updated.';

	/**
	 * Everything beyond the one summary shown, counted rather than listed.
	 *
	 * DESIGN.md's ambient notice strip is ONE line with no title — a stacked
	 * list turns a 48px band into the squashed card that rule exists to
	 * prevent. Counting keeps the promise honest without breaking the pattern:
	 * `olderNoteCount` is what the server's wire cap dropped, so a coordinator
	 * ten releases behind is never told there was one change.
	 */
	const extraNoteCount =
		notes.length > 0 ? notes.length - 1 + olderNoteCount : 0;

	// Scoped to the deployed version, so "Not now" means "stop interrupting me
	// about THIS release" and the prompt re-arms on the next one.
	const { isDismissed, dismiss } = useDismissible(
		DISMISSED_KEY,
		deployedVersion || undefined,
	);

	const [isReloading, setIsReloading] = useState(false);
	const [hasLatched, setHasLatched] = useState(false);

	const wantsToShow =
		isUpdateAvailable && severity === 'notice' && isAllowedHere && !isDismissed;

	// The latch. Rendering is `hasLatched`, not `wantsToShow`, so an open modal
	// can only delay the first appearance.
	useEffect(() => {
		if (wantsToShow && !isModalOpen) setHasLatched(true);
		if (!wantsToShow) setHasLatched(false);
	}, [wantsToShow, isModalOpen]);

	/**
	 * Mounted EMPTY and given text later, and the row keeps its height either
	 * way. A live region inserted into the DOM in the same commit as its first
	 * text is unreliably announced — so the first update, the one that proves
	 * the feature works at all, is the one most likely to be silent. This is
	 * the repo's own rule, learned from `AddVolunteerDialog`'s count region;
	 * `hidden` or `empty:hidden` would reintroduce the bug, since `display:
	 * none` takes the node back out of the accessibility tree.
	 */
	const liveRegion = (
		<output aria-live="polite" className="sr-only">
			{hasLatched
				? // The summary is announced too. A screen-reader user otherwise
					// gets the interruption without the reason for it, which is the
					// exact gap this release closes for everyone else.
					firstNote
					? `A new version of VolunteerReady is available. ${headline}`
					: 'A new version of VolunteerReady is available.'
				: ''}
		</output>
	);

	if (!hasLatched) return liveRegion;

	function handleReload() {
		setIsReloading(true);
		// Recorded BEFORE the reload, in sessionStorage, so that if this lands
		// on a stale cached shell we do not prompt for the same build forever.
		if (deployedBuildId) markReloadingFor(deployedBuildId);
		window.location.reload();
	}

	return (
		<>
			{liveRegion}
			<div
				data-testid="app-update-prompt"
				className="flex flex-wrap items-center gap-3 border-b border-border/60 bg-accent/10 px-4 py-3"
			>
				<RefreshCw className="h-5 w-5 shrink-0 text-primary" aria-hidden />
				{/* One line, no title. A bold title stacked over a body sentence
				    inside a 48px band reads as a squashed card rather than a
				    strip. */}
				{/* `min-w-56`, NOT `min-w-0`. With `min-w-0` the paragraph's
				    min-content contribution is zero, so `flex-wrap` never fires:
				    the shrink-0 button group keeps its row and the copy is
				    squeezed into a ~120px column that wraps over eight lines at
				    375px. Every horizontal-overflow assertion passes throughout,
				    because nothing leaves the viewport — the document-level check
				    is necessary and not sufficient. A real minimum width is what
				    makes the buttons wrap to their own row instead. */}
				<p className="min-w-56 flex-1 text-base text-foreground">
					{headline}
					{extraNoteCount > 0 ? (
						<span className="text-muted-foreground">
							{' '}
							Plus {extraNoteCount} more{' '}
							{extraNoteCount === 1 ? 'update' : 'updates'}.
						</span>
					) : null}{' '}
					Reload when you're ready — anything unsaved will be lost.
				</p>
				<div className="flex shrink-0 items-center gap-2">
					{/* "Not now" rather than "Dismiss": accurate, since the notice
					    returns on the next release, and it keeps the safe action
					    from reading as the weaker one. */}
					<Button variant="ghost" className="h-11" onClick={dismiss}>
						Not now
					</Button>
					<Button
						className="h-11"
						onClick={handleReload}
						disabled={isReloading}
					>
						{isReloading ? 'Reloading…' : 'Reload'}
					</Button>
				</div>
			</div>
		</>
	);
}
