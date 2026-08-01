import type * as React from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * `Card` is `flex flex-col gap-6 … py-6`, which fights `divide-y`: the rule
 * draws a hairline on each row's top edge while the gap holds the rows 24px
 * apart, so the line floats in open space instead of separating anything.
 * Zeroing both gives a flush divided list, with Card still supplying the
 * surface, border and radius.
 */
export const CARD_LIST = 'gap-0 divide-y py-0';

/**
 * A `Card` shaped as a flush divided list of rows — the below-`lg` counterpart
 * of a data table on the staff surfaces (T28 built it for the roster, T36
 * carried it to applications, opportunities and team).
 *
 * **Four consumers, not five.** `ShiftsClient` deliberately uses neither this
 * component nor the constant: its list already sits inside the page's
 * "Shift Schedule" `Card`, so a second one is double chrome, and it renders a
 * plain `divide-y` wrapper instead. Cancelling the inherited `px-6` with
 * `-mx-6` to reuse this was tried and reverted — it makes the list wider than
 * the wrapper the e2e measures and fails as internal sideways scroll, the exact
 * failure these lists exist to remove. See the card-tree comment in
 * `ShiftsClient.tsx`.
 *
 * Extracted at the fourth CONSUMER (applications, opportunities, team, and
 * the roster it was lifted from). The class string is not self-explanatory and the
 * reason for it lives two components away, which is exactly the shape that gets
 * "simplified" back to a bare `<Card className="divide-y">` by someone who
 * cannot see why the dividers look wrong afterwards.
 *
 * **Do not pass visibility utilities (`hidden`, `lg:hidden`) to this.** They are
 * display utilities, as is Card's own `flex`, so tailwind-merge keeps one and
 * drops the other — and which survives is a detail of the merge rather than of
 * the call site, so a `lg:block` that appeared to work would have silently
 * disabled Card's flex column. The breakpoint switch belongs on a wrapper
 * `div`, which is also where the `data-testid` that scopes tests should sit.
 */
export function CardList({
	className,
	...props
}: React.ComponentProps<typeof Card>) {
	return <Card className={cn(CARD_LIST, className)} {...props} />;
}
