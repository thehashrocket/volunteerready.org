'use client';

import { Button } from '@/components/ui/button';

/**
 * Remove a volunteer from the roster.
 *
 * A component rather than two copies because it renders in two places that must
 * not drift — the desktop table row and the detail dialog's footer — and the
 * accessible name is the half most easily updated in one and forgotten in the
 * other.
 *
 * Lives in its own file rather than inside `page.tsx`, where it started: the
 * detail dialog needs it, and `page.tsx` imports the dialog, so keeping it
 * there would be a circular import.
 *
 * `variant` is fixed at `outline`, per the approved mockup — "a quiet outline
 * button, never red, no trash icon". It briefly took a `ghost` variant for the
 * mobile card, where an outlined button was the heaviest thing in a two-line
 * row and made the destructive action outrank the person's name; T27 moved that
 * control into the dialog, so the case for `ghost` went with it. No trash icon
 * in either place, because that rule is about not dressing removal up as
 * something quicker than it is.
 */
export function RemoveVolunteerButton({
	displayName,
	disabled,
	onRemove,
}: {
	displayName: string;
	disabled: boolean;
	/**
	 * Receives the event so a caller inside a clickable row can stop it
	 * propagating. Taking the event here rather than wrapping each call site in
	 * an arrow keeps the two consumers' signatures identical — the dialog footer
	 * has no ancestor click handler to suppress and simply ignores it.
	 */
	onRemove: (e: React.MouseEvent) => void;
}) {
	return (
		<Button
			variant="outline"
			size="sm"
			// 44px, the repo's tap-target convention.
			className="h-11"
			// The visible label stays "Remove" per the approved mockup; the
			// accessible name carries the target. Without it a rotor lists N
			// identical "Remove" buttons with nothing to choose between them.
			aria-label={`Remove ${displayName} from your roster`}
			disabled={disabled}
			onClick={onRemove}
		>
			Remove
		</Button>
	);
}
