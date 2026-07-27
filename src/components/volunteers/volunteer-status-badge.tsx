import { CheckCircle2, Clock } from 'lucide-react';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AccountState } from '@/prisma/generated/client';

/**
 * Account-claim state for a volunteer on an org roster.
 *
 * Rendered in THREE places across two worktree lanes — the roster table (T11),
 * the assign picker and ShiftDetailDialog's signups table (T23/T24) — which is
 * why this is a component and not an inline variant map. The two inline maps in
 * shifts/page.tsx are what happens otherwise: they render raw enum strings, so
 * a coordinator is shown the literal word WAITLISTED.
 *
 * WORDING IS DELIBERATE. The plan originally said "Not activated". Three
 * independent mockup generations, given no guidance, all reached for
 * "Active / Inactive" — which reads as *volunteer engagement* ("this person
 * stopped showing up") rather than *account state* ("this person has never
 * logged in"). "Not activated" fails the same way and worse: with the invite
 * flow deferred to v1b there is no invite button, so it would label every row
 * with a deficiency the coordinator cannot act on, on the primary screen of a
 * feature whose own scope note says it "succeeds even at 0% activation".
 *
 * `neutral`, not `warning`: neutral is this app's inert not-yet state (DRAFT,
 * EXPIRED); warning means "needs your attention" (REVIEW, WAITLISTED). Having
 * no account yet is a fact, not a problem.
 *
 * Tokens only, never hex — every semantic variant already carries a .dark value
 * (globals.css:116-127, :166-177), so dark mode is free through variants and
 * broken by literals. The marketing pipeline captures dark screenshots, so a
 * hardcoded colour would eventually surface in one.
 */
const statusConfig: Record<
	AccountState,
	{ label: string; icon: typeof Clock; variant: BadgeProps['variant'] }
> = {
	UNCLAIMED: {
		label: 'No account yet',
		icon: Clock,
		variant: 'neutral',
	},
	ACTIVE: {
		label: 'Has account',
		icon: CheckCircle2,
		variant: 'success',
	},
};

export function VolunteerStatusBadge({
	state,
	className,
}: {
	state: AccountState;
	className?: string;
}) {
	const config = statusConfig[state];
	const Icon = config.icon;

	// lucide-react applies aria-hidden="true" automatically when an icon has no
	// children and no a11y prop, so the label alone carries the meaning.
	return (
		<Badge variant={config.variant} className={cn(className)}>
			<Icon className="h-3.5 w-3.5" />
			{config.label}
		</Badge>
	);
}
