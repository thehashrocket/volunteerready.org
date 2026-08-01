'use client';

import { Toaster } from 'sonner';

/**
 * Left bare on purpose.
 *
 * `docs/TODOS.md` recorded the toaster as a second, smaller horizontal-overflow
 * offender alongside the app-shell top bar — "an `ol` at width 375 with a 16px
 * inset → 391". A `--width: min(356px, calc(100vw - 2rem))` override was written
 * to cap it, then removed, because measuring it showed it changed nothing: the
 * toast `<li>` renders at 288px inside a 320px viewport with the override and at
 * 288px without it. Sonner already clamps a toast to the viewport.
 *
 * The 391 figure is real but harmless — it describes the `<ol>`, a
 * `position: fixed`, zero-height container that paints nothing and, being fixed,
 * does not extend `documentElement.scrollWidth` either. Do not re-add a cap on
 * the strength of that number alone; measure the `<li>` first.
 */
export function AppToaster() {
	return <Toaster richColors position="top-right" />;
}
