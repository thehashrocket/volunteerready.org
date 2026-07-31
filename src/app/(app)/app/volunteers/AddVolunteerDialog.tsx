'use client';

import { Plus } from 'lucide-react';
import type * as React from 'react';
import { useState } from 'react';
import { toast } from 'sonner';
import { safeErrorMessage } from '@/components/app/query-error-card';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog';
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMediaQuery } from '@/lib/hooks/use-media-query';
import { trpc } from '@/lib/trpc/client';
import { DISPLAY_NAME_MAX } from '@/server/domain/org-volunteer';

const TITLE = 'Add a volunteer';
const DESCRIPTION =
	"They don't need to sign up first. You can schedule them and track their hours right away.";

/**
 * The roster page switches its LIST between a table and a card list with pure
 * CSS, deliberately — `useMediaQuery` initialises to `false` and only resolves
 * in an effect, so gating layout on it paints the mobile shape to every desktop
 * user and swaps after hydration.
 *
 * A modal is the one case where the hook IS safe: nothing renders until the
 * coordinator presses the trigger, by which point the effect has long run. Same
 * reasoning as `feedback-widget.tsx` and `org-profile-form.tsx`.
 *
 * `lg` rather than the `md` those two use, so this page has ONE breakpoint. A
 * 768-1023px band where the roster behind the modal is already a card list but
 * the form is still a centred dialog is a worse inconsistency than differing
 * from a sibling component.
 */
const DESKTOP_QUERY = '(min-width: 1024px)';

/**
 * 44px, the repo's tap-target convention. Applied unconditionally rather than
 * only below `lg`: the roster page behind this form already uses `h-11` on its
 * search field, Export CSV and every Remove at BOTH widths, so a 36px form
 * would be the odd one out on desktop too. shadcn's defaults are `h-9`.
 */
const FIELD_HEIGHT = 'h-11';

/**
 * Add a volunteer to the roster.
 *
 * The three add branches produce only TWO distinct messages. Minting a shadow
 * user and linking an UNCLAIMED user another org already created must read
 * IDENTICALLY — a different message for the latter would tell the coordinator
 * that some other organisation already has this person on their roster, which
 * is cross-org membership disclosure. Security §7 accepted account enumeration
 * between "unknown" and "existing"; it never accepted this.
 *
 * The service enforces the same rule (see INDISTINGUISHABLE_OUTCOMES); this is
 * the second half of it, at the surface the coordinator actually reads.
 */
export function AddVolunteerDialog({ onAdded }: { onAdded: () => void }) {
	const [open, setOpen] = useState(false);
	const isDesktop = useMediaQuery(DESKTOP_QUERY);

	const trigger = (
		<Button>
			<Plus className="mr-2 h-4 w-4" />
			Add volunteer
		</Button>
	);

	// Only one branch ever mounts, so the form's state and mutation exist once.
	// Both shells unmount their content when closed, so a half-typed entry and a
	// stale inline error both clear on close without an explicit reset.
	const form = (
		<AddVolunteerForm
			onAdded={onAdded}
			onClose={() => setOpen(false)}
			Footer={isDesktop ? DialogFooter : DrawerFooter}
			// One document order (Cancel, then submit) has to work in two very
			// different footers. The Dialog branch only mounts at >=1024px, where
			// DialogFooter is already `sm:flex-row sm:justify-end` — a row with the
			// primary action on the right; its `flex-col-reverse` half is
			// unreachable here. DrawerFooter is a plain `flex-col`, so the same
			// order would stack Cancel ABOVE submit. Reversing the drawer's column
			// puts the primary action first, which is what `org-profile-form.tsx`
			// achieves at :409-431 by hand-writing the buttons in two orders.
			// `px-0 pb-0` because DrawerFooter carries its own `p-4` on top of the
			// body wrapper's `px-4`, which would inset the buttons 32px against
			// 16px inputs.
			footerClassName={isDesktop ? undefined : 'flex-col-reverse px-0 pb-0'}
		/>
	);

	if (isDesktop) {
		return (
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogTrigger asChild>{trigger}</DialogTrigger>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{TITLE}</DialogTitle>
						<DialogDescription>{DESCRIPTION}</DialogDescription>
					</DialogHeader>
					{form}
				</DialogContent>
			</Dialog>
		);
	}

	return (
		<Drawer open={open} onOpenChange={setOpen}>
			<DrawerTrigger asChild>{trigger}</DrawerTrigger>
			<DrawerContent>
				<DrawerHeader>
					<DrawerTitle>{TITLE}</DrawerTitle>
					<DrawerDescription>{DESCRIPTION}</DrawerDescription>
				</DrawerHeader>
				{/* DrawerContent supplies no padding for its body — only
				    DrawerHeader/DrawerFooter carry `p-4`, so an unwrapped form
				    sits flush against the sheet's rounded edge. DialogContent's
				    own `p-6` covers the desktop branch. */}
				<div className="px-4 pb-6">{form}</div>
			</DrawerContent>
		</Drawer>
	);
}

/**
 * The form body, shared by both shells.
 *
 * Extracted as a component rather than a JSX const because it owns state (four
 * fields plus a mutation) — the `feedback-widget.tsx` shape. `org-profile-form`'s
 * `confirmBody` const works there because that body is static.
 */
function AddVolunteerForm({
	onAdded,
	onClose,
	Footer,
	footerClassName,
}: {
	onAdded: () => void;
	onClose: () => void;
	Footer: React.ComponentType<React.ComponentProps<'div'>>;
	footerClassName?: string;
}) {
	const [displayName, setDisplayName] = useState('');
	const [email, setEmail] = useState('');
	const [phone, setPhone] = useState('');
	const [fieldError, setFieldError] = useState<string | null>(null);

	const addVolunteer = trpc.volunteers.add.useMutation({
		onSuccess: (result) => {
			// `notified` is the ONLY thing the server tells us about which branch
			// ran. The three internal outcomes are deliberately collapsed to two
			// server-side (see toClientResult) so the response body cannot leak
			// that another org already had this person.
			toast.success(
				result.notified
					? `${result.displayName} added to your roster. We let them know by email.`
					: `${result.displayName} added to your roster.`,
			);
			setDisplayName('');
			setEmail('');
			setPhone('');
			setFieldError(null);
			onAdded();
			onClose();
		},
		onError: (error) => {
			// "Already on your roster" is a no-op, not a failure — rendered inline
			// rather than as an error toast, which would train coordinators to
			// dismiss real errors.
			//
			// safeErrorMessage allowlists client-safe tRPC codes (CONFLICT included)
			// and swallows internal ones, so an unexpected Prisma message can't be
			// rendered verbatim to the user. Matches volunteers/page.tsx.
			setFieldError(safeErrorMessage(error) ?? 'Could not add that volunteer.');
		},
	});

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setFieldError(null);
		addVolunteer.mutate({
			displayName,
			email,
			phone: phone.trim() ? phone : null,
		});
	}

	return (
		<form className="space-y-4" onSubmit={handleSubmit}>
			<div className="space-y-2">
				<Label htmlFor="volunteer-name">Name</Label>
				<Input
					id="volunteer-name"
					className={FIELD_HEIGHT}
					value={displayName}
					maxLength={DISPLAY_NAME_MAX}
					onChange={(e) => setDisplayName(e.target.value)}
					required
				/>
			</div>

			<div className="space-y-2">
				<Label htmlFor="volunteer-email">Email</Label>
				<Input
					id="volunteer-email"
					className={FIELD_HEIGHT}
					type="email"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					aria-invalid={fieldError ? true : undefined}
					aria-describedby={fieldError ? 'volunteer-add-error' : undefined}
					required
				/>
				{/* The coordinator is about to cause mail to be sent to a third
				    party on their org's behalf. They should know before they
				    submit, not after the reply arrives. */}
				<p className="text-xs text-muted-foreground">
					If they already use VolunteerReady, we&apos;ll let them know you added
					them.
				</p>
			</div>

			<div className="space-y-2">
				<Label htmlFor="volunteer-phone">Phone (optional)</Label>
				<Input
					id="volunteer-phone"
					className={FIELD_HEIGHT}
					value={phone}
					onChange={(e) => setPhone(e.target.value)}
				/>
			</div>

			{fieldError ? (
				// `role="alert"` is an implicit assertive live region, so the
				// message is announced when it mounts. Without it the only signal
				// that a submit did nothing is a line of red text a screen-reader
				// user never hears — and the commonest message here is the benign
				// "Already on your roster", which is precisely the one that makes
				// a silent form look broken.
				<p
					id="volunteer-add-error"
					role="alert"
					className="text-sm text-destructive"
				>
					{fieldError}
				</p>
			) : null}

			<Footer className={footerClassName}>
				<Button
					type="button"
					variant="outline"
					className={FIELD_HEIGHT}
					onClick={onClose}
				>
					Cancel
				</Button>
				<Button
					type="submit"
					className={FIELD_HEIGHT}
					disabled={addVolunteer.isPending}
				>
					{addVolunteer.isPending ? 'Adding…' : 'Add volunteer'}
				</Button>
			</Footer>
		</form>
	);
}
