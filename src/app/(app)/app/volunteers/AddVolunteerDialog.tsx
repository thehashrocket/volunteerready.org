'use client';

import { Plus } from 'lucide-react';
import type * as React from 'react';
import { useEffect, useRef, useState } from 'react';
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
 * Both footer labels change as a batch progresses — `Add volunteer` →
 * `Adding…` → `Add another`, and `Cancel` → `Done`. Auto-width buttons in the
 * Dialog's right-justified row therefore resize on every submit, and since the
 * row is pinned at its right edge the primary's LEFT edge moves and drags the
 * secondary with it. This surface exists to have the same button pressed twenty
 * times in a row, so the target moving under the cursor each cycle is the
 * defect, not the wording. Sized to the longest label in each slot.
 *
 * Only affects the Dialog: the drawer's buttons are already full width.
 */
const SUBMIT_WIDTH = 'min-w-[8.5rem]';
const SECONDARY_WIDTH = 'min-w-20';

/**
 * The trigger's icon and label, shared by the header action and the empty
 * state's action.
 *
 * It guarantees the AFFORDANCE only — the two are not equivalent. The header's
 * is wrapped in `DialogTrigger`/`DrawerTrigger`, which Radix decorates with
 * `aria-haspopup`, `aria-expanded`, `aria-controls` and `data-state`, and
 * registers as the node focus returns to on close. The empty state's is a plain
 * button with none of that; the resulting focus-return difference is a recorded
 * P3 in docs/TODOS.md. Do not read this component as making them the same.
 *
 * The empty state cannot render its own `AddVolunteerDialog`. The form now
 * STAYS OPEN across a successful add (D12), and the empty state's instance
 * lives inside the roster page's `volunteers.length === 0` branch — so the
 * first add flips that branch and unmounts the form the coordinator is still
 * typing into. Invisible before D12, because the dialog closed on success
 * anyway. Hence one dialog, owned by the page, and a plain button here.
 */
export function AddVolunteerButton(props: React.ComponentProps<typeof Button>) {
	return (
		<Button {...props}>
			<Plus className="mr-2 h-4 w-4" />
			Add volunteer
		</Button>
	);
}

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
 *
 * `open` is owned by the page rather than by this component — see
 * `AddVolunteerButton` for why the empty state opens this instance instead of
 * mounting its own.
 */
export function AddVolunteerDialog({
	onAdded,
	open,
	onOpenChange,
}: {
	onAdded: () => void;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const liveIsDesktop = useMediaQuery(DESKTOP_QUERY);

	// The shell is FROZEN while the form is open. Dialog and Drawer are different
	// root elements, so crossing `lg` swaps them — React unmounts one subtree and
	// mounts the other, taking `AddVolunteerForm` and with it the running count
	// and every half-typed field. Because `open` lives on the page, the
	// replacement shell then opens IMMEDIATELY, blank: the batch is gone, the
	// count is silently back to zero and the footer has reverted to `Cancel`.
	//
	// The trigger is an ordinary one — an iPad rotating portrait to landscape
	// crosses 1024 (834 → 1194), as does snapping a desktop window — and
	// `useMediaQuery` subscribes to `change`, so it fires every time. Before T25
	// this cost one in-flight entry over about a second; a stay-open form makes
	// it a whole batch.
	//
	// Freezing rather than hoisting the state: the shells genuinely are different
	// components, and a form that changes shape underneath someone mid-sentence is
	// wrong even if its state survived. Re-reading while closed keeps an idle tab
	// correct. Not reachable in jsdom (no layout) or the e2e (fixed viewport), so
	// it is held by this comment rather than a test.
	const [shellIsDesktop, setShellIsDesktop] = useState(liveIsDesktop);
	useEffect(() => {
		if (!open) setShellIsDesktop(liveIsDesktop);
	}, [open, liveIsDesktop]);
	const isDesktop = open ? shellIsDesktop : liveIsDesktop;

	const trigger = <AddVolunteerButton />;

	// Only one branch ever mounts, so the form's state and mutation exist once.
	// Both shells unmount their content when closed, so a half-typed entry, a
	// stale inline error and the session's running count all clear on close
	// without an explicit reset.
	const form = (
		<AddVolunteerForm
			onAdded={onAdded}
			onClose={() => onOpenChange(false)}
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
			footerClassName={
				isDesktop ? undefined : 'flex-col-reverse px-0 pt-0 pb-0'
			}
		/>
	);

	if (isDesktop) {
		return (
			<Dialog open={open} onOpenChange={onOpenChange}>
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
		<Drawer open={open} onOpenChange={onOpenChange}>
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
				{/* `overflow-y-auto min-h-0` because DrawerContent is
				    `max-h-[85vh] flex flex-col` and drawer.tsx declares no overflow
				    utility anywhere: past the cap the default `flex-shrink: 1`
				    compresses children below their content size and the form spills
				    outside the painted sheet instead of scrolling, with no way back.
				    `min-h-0` is required — a flex child will not shrink below its
				    content without it, so `overflow-y-auto` alone does nothing. T25
				    added a count row to the tallest shell, and a 375x667 phone has
				    only ~567px of budget. */}
				<div className="min-h-0 overflow-y-auto px-4 pb-6">{form}</div>
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
	const [addedCount, setAddedCount] = useState(0);
	const nameRef = useRef<HTMLInputElement>(null);

	const addVolunteer = trpc.volunteers.add.useMutation({
		onSuccess: (result) => {
			// `notified` is the ONLY thing the server tells us about which branch
			// ran. The three internal outcomes are deliberately collapsed to two
			// server-side (see toClientResult) so the response body cannot leak
			// that another org already had this person.
			//
			// The toast stays even though the form no longer closes, because it is
			// the ONLY surface carrying the "we emailed them" disclosure — and the
			// rule above is about the two silent branches being indistinguishable,
			// which a toast that fires only for the third branch would break by
			// its absence.
			toast.success(
				result.notified
					? `${result.displayName} added to your roster. We let them know by email.`
					: `${result.displayName} added to your roster.`,
			);
			setDisplayName('');
			setEmail('');
			setPhone('');
			setFieldError(null);
			setAddedCount((n) => n + 1);
			// Refresh per add, not once on close: the list and the header count sit
			// behind an open form now, and a coordinator typing the fourth name
			// should not be reading a roster that still shows none of the first
			// three.
			onAdded();
			// The core task is a spreadsheet or a sign-up sheet being typed in, so
			// the next name has to be reachable without touching the mouse.
			nameRef.current?.focus();
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
		<form
			// Both footer buttons go disabled during an add and nothing else
			// announces why, so the freeze needs an assistive-tech path too.
			aria-busy={addVolunteer.isPending}
			className="space-y-4"
			onSubmit={handleSubmit}
		>
			<div className="space-y-2">
				<Label htmlFor="volunteer-name">Name</Label>
				<Input
					id="volunteer-name"
					ref={nameRef}
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

			{/* Wrapped with the footer rather than sitting in the form's own
			    `space-y-4`, so the count is nearer the actions it describes than the
			    field group above it. The drawer needs `pt-0` passed as well (see
			    `footerClassName`): DrawerFooter carries its own `p-4`, and with that
			    residual top padding the count read as a label attached UPWARD to the
			    phone field instead of downward to the buttons. */}
			<div className="space-y-2">
				{/* Above the footer rather than inside it, deliberately. The two
				    footers this form renders into run in OPPOSITE flex directions —
				    DialogFooter is a right-justified row at this breakpoint,
				    DrawerFooter a reversed column — so any single document order
				    puts the count above the buttons in one shell and below them in
				    the other. Its own row reads the same in both.

				    `<output>` is an implicit polite live region, so each add is
				    announced without stealing focus from the name field it was just
				    returned to. Same idiom as the roster page's removal
				    announcements (`page.tsx:341`) and `org-profile-form.tsx:270`.

				    ALWAYS RENDERED, with only its CONTENT conditional. A live
				    region inserted into the DOM in the same commit as its first
				    text is unreliably announced — NVDA and JAWS track regions they
				    observed before the change, so the first add (the one that tells
				    the coordinator the form is working) is the one most likely to
				    be missed. Mounting it empty with the dialog costs an empty
				    block element and makes every announcement a content change.
				    For the same reason it must not be hidden with `hidden` or
				    `empty:hidden` while empty: `display: none` takes it back out of
				    the accessibility tree and restores the bug. */}
				{/* `min-h-5` reserves the line from mount. Mounting the region
				    empty buys the announcement, not the space: an empty block has no
				    line box, so without this the first add grows the shell by 20px —
				    and `DrawerContent` is pinned to the bottom, so the sheet grows
				    UPWARD and the Name input jumps out from under the caret at the
				    exact moment focus is returned to it and the next name is being
				    typed. That is the one moment in a batch when nothing should move.

				    `tabular-nums` per DESIGN.md (counts get tabular figures) and to
				    match the roster behind this form; the number increments live, so
				    proportional digits reflow the string on every add.

				    `lg:text-right` bites only in the Dialog branch, the only one that
				    mounts at that width and whose footer is a right-justified row —
				    flush left there strands the count diagonally away from the buttons
				    it describes. The drawer's buttons are full width, so left already
				    aligns with them. */}
				<output
					aria-live="polite"
					className="block min-h-5 text-sm text-muted-foreground tabular-nums lg:text-right"
				>
					{/* The count region doubles as the in-flight status. The
					    secondary action is disabled during an add while the primary
					    self-narrates with `Adding…`, so without this the button whose
					    refusal is surprising is the silent one. `polite` means the
					    coordinator hears `Adding…` then `3 added` in order, and it
					    reuses the region that is already reserved rather than adding a
					    second live region competing with it. */}
					{addVolunteer.isPending
						? 'Adding…'
						: addedCount > 0
							? `${addedCount} added`
							: null}
				</output>

				<Footer className={footerClassName}>
					<Button
						type="button"
						variant="outline"
						className={`${FIELD_HEIGHT} ${SECONDARY_WIDTH}`}
						// Disabled mid-flight for the same reason submit is, and the
						// consequence here is worse. Closing unmounts this form, and
						// with it the mutation's `onSuccess` — so a volunteer the server
						// DID create gets no toast, no place in the running count, and
						// no `onAdded()` — which means the roster behind the form is
						// never invalidated and simply does not show them. A coordinator
						// has no reason to distrust that list.
						//
						// `Add another` then `Done` in one motion is the natural way to
						// end a batch, so this is the likely path, not an edge case.
						// Escape and the overlay still close mid-flight and still orphan
						// the callback (P3 in docs/TODOS.md) — trapping someone in a
						// modal because a request is slow is the worse failure.
						disabled={addVolunteer.isPending}
						onClick={onClose}
					>
						{/* "Cancel" stops being true the moment something has been
					    committed — it offers to undo adds this button cannot undo. */}
						{addedCount > 0 ? 'Done' : 'Cancel'}
					</Button>
					<Button
						type="submit"
						className={`${FIELD_HEIGHT} ${SUBMIT_WIDTH}`}
						disabled={addVolunteer.isPending}
					>
						{addVolunteer.isPending
							? 'Adding…'
							: addedCount > 0
								? 'Add another'
								: 'Add volunteer'}
					</Button>
				</Footer>
			</div>
		</form>
	);
}
