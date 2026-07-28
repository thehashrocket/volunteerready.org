import { Ban, CheckCircle2, CircleCheck, Users } from 'lucide-react';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
	SHIFT_STATUS_LABELS,
	type ShiftStatus,
	SIGNUP_STATUS_LABELS,
	type SignupStatus,
} from '@/server/domain/shift';

/**
 * Shift and signup status badges.
 *
 * These replace two inline `Record<string, BadgeProps['variant']>` maps in
 * `shifts/page.tsx` that used the enum value itself as the label, so a
 * coordinator read `WAITLISTED`, `NO_SHOW` and `COMPLETED` in screaming snake
 * case. Every other status in the product goes through a `*StatusBadge` with a
 * `{label, icon, variant}` record — `ApplicationStatusBadge` ("In review",
 * "Withdrawn"), `ScreeningStatusBadge` ("Needs review"),
 * `OpportunityStatusBadge`, `VolunteerStatusBadge`.
 *
 * The human copy already existed: `SHIFT_STATUS_LABELS` and
 * `SIGNUP_STATUS_LABELS` have been in `domain/shift.ts` since that module was
 * written and were imported nowhere. Reusing them rather than retyping the
 * strings means the labels cannot drift from the domain's own vocabulary.
 *
 * Both maps are total `Record`s over their enum, so a new status is a type
 * error here rather than a silent fallthrough to `neutral` with a raw enum
 * label — which is exactly how the previous `?? 'neutral'` shape hid this.
 *
 * Tokens only, never hex: every semantic variant carries a `.dark` value, so
 * dark mode is free through variants and broken by literals.
 */
const shiftConfig: Record<
	ShiftStatus,
	{ icon: typeof Users; variant: BadgeProps['variant'] }
> = {
	OPEN: { icon: CircleCheck, variant: 'success' },
	FULL: { icon: Users, variant: 'warning' },
	CANCELLED: { icon: Ban, variant: 'destructive' },
	COMPLETED: { icon: CheckCircle2, variant: 'info' },
};

export function ShiftStatusBadge({
	status,
	className,
}: {
	status: ShiftStatus;
	className?: string;
}) {
	const config = shiftConfig[status];
	const Icon = config.icon;

	// lucide-react applies aria-hidden="true" automatically when an icon has no
	// children and no a11y prop, so the label alone carries the meaning.
	return (
		<Badge variant={config.variant} className={cn(className)}>
			<Icon className="h-3.5 w-3.5" />
			{SHIFT_STATUS_LABELS[status]}
		</Badge>
	);
}

/**
 * `WAITLISTED` is `warning` and not `neutral`, unlike `VolunteerStatusBadge`'s
 * UNCLAIMED: a waitlisted volunteer is something the coordinator may need to act
 * on, which is this app's distinction between the two variants.
 */
const signupConfig: Record<SignupStatus, BadgeProps['variant']> = {
	CONFIRMED: 'info',
	WAITLISTED: 'warning',
	ATTENDED: 'success',
	NO_SHOW: 'destructive',
	CANCELLED: 'neutral',
};

export function SignupStatusBadge({
	status,
	className,
}: {
	status: SignupStatus;
	className?: string;
}) {
	return (
		<Badge variant={signupConfig[status]} className={cn(className)}>
			{SIGNUP_STATUS_LABELS[status]}
		</Badge>
	);
}
