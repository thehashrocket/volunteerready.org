// ---------------------------------------------------------------------------
// e2e layout helper — document-level horizontal overflow.
//
// Every narrow-viewport assertion in this suite used to be scoped to a region
// (`[data-testid="roster-card-list"]`, the open drawer) rather than to the
// document, because the app shell's own top bar overflowed on EVERY
// authenticated page: ~22px at 375px and ~126px in the 768-1023px band, where
// the wordmark and both switchers render beside a toggle that is still
// `lg:hidden`. A page-level assertion failed on that pre-existing bug and said
// nothing about the page under test, so it would have been deleted or padded
// with a tolerance the first time anyone hit it.
//
// The shell was fixed (`min-w-0` on the left cluster, `shrink-0` on the right,
// the wordmark hidden below `sm`), so the assertions are document-level now —
// which is the only form that catches a NEW offender in shared chrome instead
// of only in the region someone remembered to scope to.
// ---------------------------------------------------------------------------

import { expect, type Page } from '@playwright/test';

/**
 * Assert nothing on the page extends past `width`.
 *
 * Measures `documentElement.scrollWidth` for the verdict, and separately walks
 * the DOM for the widest node so a failure names the element responsible rather
 * than only the number — the difference between a five-minute fix and a
 * bisect.
 *
 * Deliberately NOT a check for `overflow-x: hidden` anywhere: that hides the
 * scrollbar while leaving the content unreachable, which is the same bug with
 * the evidence removed.
 *
 * TWO things it cannot see, both of which need their own assertion:
 *
 * 1. **`position: fixed` chrome.** Fixed elements are laid out against the
 *    viewport and do not extend the document's scrollable overflow, so the
 *    sonner toaster or the feedback pill can be wider than the screen while
 *    this stays green. The node walk below is only building the failure
 *    MESSAGE; the verdict is `scrollWidth`. Measure such an element directly
 *    (`locator.boundingBox()`) if you need to hold its width. There is no such
 *    assertion in the suite today — one was written for the toaster and removed
 *    along with the cap it guarded, once measurement showed sonner already
 *    clamps a toast to the viewport (see `src/components/sonner.tsx`).
 * 2. **Content that breaks its container but lands inside the viewport.** An
 *    element can escape its column's padding and still stop at or before the
 *    viewport edge. That happened on `/app/opportunities`: the header actions
 *    ran 32px past the page padding and ended at exactly 375, so this passed
 *    while the button sat flush against the screen edge. Where a container's
 *    bounds are the actual requirement, assert against the container.
 */
export async function expectNoHorizontalOverflow(page: Page, width: number) {
	const measured = await page.evaluate(() => {
		let worst = 0;
		let offender = '';
		for (const el of Array.from(document.body.querySelectorAll('*'))) {
			const r = el.getBoundingClientRect();
			if (r.width > 0 && r.right > worst) {
				worst = r.right;
				// `className` on an SVG is an SVGAnimatedString, which stringifies to
				// "[object SVGAnimatedString]" and names nothing — lucide icons are
				// SVGs and are plausible offenders. `getAttribute` returns the real
				// value for both HTML and SVG.
				offender = `${el.tagName.toLowerCase()}.${el.getAttribute('class') ?? ''}`;
			}
		}
		return {
			scrollWidth: document.documentElement.scrollWidth,
			worst: Math.round(worst),
			offender,
		};
	});

	expect(
		measured.scrollWidth,
		`document scrolls sideways; widest node is ${measured.offender} ending at ${measured.worst}px`,
	).toBeLessThanOrEqual(width);
}

/**
 * Assert an element does not carry its OWN sideways scroll.
 *
 * A distinct property from the one above: `Table` wraps itself in
 * `overflow-auto`, so a too-wide table scrolls internally and the document
 * stays exactly `width`. That is the failure mode the card lists replace, and
 * it is invisible to `expectNoHorizontalOverflow`.
 */
export async function expectNoInternalScroll(page: Page, selector: string) {
	const measured = await page.evaluate((sel) => {
		const el = document.querySelector(sel);
		if (!el) return null;
		return { scroll: el.scrollWidth, client: el.clientWidth };
	}, selector);

	expect(measured, `no element matched ${selector}`).not.toBeNull();
	expect(
		measured?.scroll,
		`${selector} scrolls sideways inside itself`,
	).toBeLessThanOrEqual(measured?.client ?? -1);
}

/**
 * Assert an element is actually being ELLIPSIZED — that `truncate` is doing
 * work, not merely that the layout happens to fit.
 *
 * The distinction matters because `min-w-0` and `truncate` fail differently.
 * Deleting `min-w-0` widens the card and trips `expectNoHorizontalOverflow`;
 * deleting `truncate` just wraps the text, grows the card taller, and overflows
 * nothing — so the likelier "simplify" edit of the two is the one the overflow
 * assertions cannot see. An ellipsized element is one whose content is wider
 * than its box.
 *
 * Requires a fixture string with no line-break opportunities (underscores and
 * letters — NOT spaces or hyphens, which are UAX #14 break opportunities), or
 * the text wraps instead of overflowing and this passes vacuously.
 */
export async function expectEllipsized(page: Page, selector: string) {
	const measured = await page.evaluate((sel) => {
		const el = document.querySelector(sel);
		if (!el) return null;
		return { scroll: el.scrollWidth, client: el.clientWidth };
	}, selector);

	expect(measured, `no element matched ${selector}`).not.toBeNull();
	expect(
		measured?.scroll ?? 0,
		`${selector} is not being ellipsized — is \`truncate\` still on it?`,
	).toBeGreaterThan(measured?.client ?? Number.MAX_SAFE_INTEGER);
}
