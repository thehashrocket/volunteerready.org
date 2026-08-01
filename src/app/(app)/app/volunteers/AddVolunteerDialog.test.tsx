// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	mutate: vi.fn(),
	toastSuccess: vi.fn(),
	onSuccess: null as ((r: unknown) => void) | null,
	onError: null as ((e: { message: string }) => void) | null,
	isPending: false,
	mediaQueryState: { isDesktop: true },
	mediaQueryCalls: [] as string[],
}));

vi.mock('@/lib/trpc/client', () => ({
	trpc: {
		volunteers: {
			add: {
				useMutation: (opts: {
					onSuccess: (r: unknown) => void;
					onError: (e: {
						message: string;
						data?: { code?: string } | null;
					}) => void;
				}) => {
					// Capture the handlers so tests can drive them directly.
					mocks.onSuccess = opts.onSuccess;
					mocks.onError = opts.onError;
					return { mutate: mocks.mutate, isPending: mocks.isPending };
				},
			},
		},
	},
}));

vi.mock('sonner', () => ({
	toast: { success: mocks.toastSuccess, error: vi.fn() },
}));

// Records the query STRING, not just the answer — the breakpoint value is the
// invariant ("one breakpoint per page"), and a mock that swallows the argument
// lets it drift to `md` silently.
vi.mock('@/lib/hooks/use-media-query', () => ({
	useMediaQuery: (query: string) => {
		mocks.mediaQueryCalls.push(query);
		return mocks.mediaQueryState.isDesktop;
	},
}));

import { AddVolunteerDialog } from './AddVolunteerDialog';

// vaul's Drawer uses pointer capture, which jsdom doesn't implement, so the
// Drawer branch throws on the very click that opens it. Needed by the tests
// below that set `isDesktop = false` deliberately — this file mocks the hook
// wholesale, so `window.matchMedia` is never consulted and `beforeEach` pins
// the default to the Dialog branch.
Element.prototype.setPointerCapture = vi.fn();
Element.prototype.releasePointerCapture = vi.fn();
Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);

// vaul reads `style.transform || style.webkitTransform || style.mozTransform`
// and calls `.match()` on the result. jsdom computes `transform` as the empty
// string and defines neither prefixed alias, so that chain yields `undefined`
// and every pointer release inside the drawer throws — asynchronously, so it
// surfaces as an unhandled error that fails the run while every test still
// reports green. Shadow the one property rather than replacing the whole
// declaration, so nothing else about computed style changes.
const realGetComputedStyle = window.getComputedStyle;
window.getComputedStyle = ((
	element: Element,
	pseudoElement?: string | null,
) => {
	const style = realGetComputedStyle.call(window, element, pseudoElement);
	return Object.create(style, {
		transform: { value: style.transform || 'none' },
	}) as CSSStyleDeclaration;
}) as typeof window.getComputedStyle;

/**
 * `open` is owned by the roster page, so the component is controlled. This is
 * the smallest thing that owns it — see AddVolunteerButton's docstring for why
 * the page holds it rather than the dialog.
 */
function Harness({ onAdded }: { onAdded: () => void }) {
	const [open, setOpen] = useState(false);
	return (
		<AddVolunteerDialog onAdded={onAdded} open={open} onOpenChange={setOpen} />
	);
}

async function openDialog(onAdded: () => void = vi.fn()) {
	const user = userEvent.setup();
	render(<Harness onAdded={onAdded} />);
	await user.click(screen.getByRole('button', { name: /add volunteer/i }));
	return user;
}

/** Drives the mutation's success handler the way a real add would. */
function succeed(displayName = 'Ava Thompson', notified = false) {
	act(() => {
		mocks.onSuccess?.({ notified, displayName });
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.isPending = false;
	mocks.onSuccess = null;
	mocks.onError = null;
	mocks.mediaQueryState.isDesktop = true;
	mocks.mediaQueryCalls.length = 0;
});

describe('AddVolunteerDialog copy', () => {
	// THE test for this component. Security §7 accepted account enumeration by
	// reasoning about two branches ("unknown" vs "existing"). There are THREE.
	// If the other-org-UNCLAIMED case reads differently from the unknown-email
	// case, the coordinator learns that ANOTHER ORGANISATION already has this
	// person on their roster — cross-org membership disclosure, which §7 never
	// accepted. The service enforces half of this; the toast is the other half,
	// and it is the half the coordinator actually reads.
	it('SECURITY: shadow-mint and other-org-UNCLAIMED produce IDENTICAL copy', async () => {
		await openDialog();

		// Both silent branches arrive as the SAME payload — the server collapses
		// them via toClientResult, so the client literally cannot tell them apart.
		mocks.onSuccess?.({ notified: false, displayName: 'Ava Thompson' });
		const shadowToast = mocks.toastSuccess.mock.calls[0][0];

		mocks.toastSuccess.mockClear();
		mocks.onSuccess?.({ notified: false, displayName: 'Ava Thompson' });
		const unclaimedToast = mocks.toastSuccess.mock.calls[0][0];

		expect(shadowToast).toBe(unclaimedToast);
		expect(shadowToast).toBe('Ava Thompson added to your roster.');
		// And neither may hint that an email went out.
		expect(shadowToast).not.toMatch(/email/i);
	});

	it('tells the coordinator when an email actually went out', async () => {
		// The ACTIVE branch mails a real third party on the org's behalf. If the
		// toast omits it, "did Maria get notified?" is unanswerable.
		await openDialog();

		mocks.onSuccess?.({ notified: true, displayName: 'Maria Garcia' });

		expect(mocks.toastSuccess).toHaveBeenCalledWith(
			'Maria Garcia added to your roster. We let them know by email.',
		);
	});

	it('warns before submit that an email may be sent', async () => {
		await openDialog();
		expect(
			screen.getByText(/we'll let them know you added them/i),
		).toBeInTheDocument();
	});
});

describe('AddVolunteerDialog behaviour', () => {
	it('submits trimmed field values with a null phone when blank', async () => {
		// A blank phone must be null, not "" — "" is a value the roster would
		// render as an empty phone rather than "no phone on file".
		const user = await openDialog();

		await user.type(screen.getByLabelText('Name'), 'Ada Lovelace');
		await user.type(screen.getByLabelText('Email'), 'ada@example.com');
		await user.click(screen.getByRole('button', { name: 'Add volunteer' }));

		expect(mocks.mutate).toHaveBeenCalledWith({
			displayName: 'Ada Lovelace',
			email: 'ada@example.com',
			phone: null,
		});
	});

	it('passes a phone through when provided', async () => {
		const user = await openDialog();

		await user.type(screen.getByLabelText('Name'), 'Ada');
		await user.type(screen.getByLabelText('Email'), 'ada@example.com');
		await user.type(screen.getByLabelText(/phone/i), '555-1234 (cell)');
		await user.click(screen.getByRole('button', { name: 'Add volunteer' }));

		expect(mocks.mutate).toHaveBeenCalledWith(
			expect.objectContaining({ phone: '555-1234 (cell)' }),
		);
	});

	it('renders a duplicate as an INLINE message, never an error toast', async () => {
		// "Already on your roster" is a no-op, not a failure. Toasting it as an
		// error trains coordinators to dismiss real errors.
		//
		// The `data.code` matters: errors reach onError as TRPCClientError, and
		// safeErrorMessage allowlists by code. A mock without it is not the shape
		// production produces and would test the fallback branch by accident.
		const { toast } = await import('sonner');
		await openDialog();

		mocks.onError?.({
			message: 'Already on your roster',
			data: { code: 'CONFLICT' },
		});

		// role="alert" is an implicit assertive live region: without it the only
		// signal that a submit did nothing is red text a screen-reader user never
		// hears — and this benign "already there" case is exactly the one that
		// makes a silent form look broken.
		const alert = await screen.findByRole('alert');
		expect(alert).toHaveTextContent('Already on your roster');
		expect(toast.error).not.toHaveBeenCalled();
	});

	it('does not carry a stale error into the next open', async () => {
		// REGRESSION: this diff DELETED the explicit `setFieldError(null)` that
		// ran on close, relying instead on both shells unmounting their content.
		// If either shell is ever changed to keep its subtree mounted, the next
		// open reopens showing "Already on your roster" over an empty form.
		const user = await openDialog();

		mocks.onError?.({
			message: 'Already on your roster',
			data: { code: 'CONFLICT' },
		});
		expect(await screen.findByRole('alert')).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'Cancel' }));
		await user.click(screen.getByRole('button', { name: /add volunteer/i }));

		expect(screen.queryByRole('alert')).not.toBeInTheDocument();
		expect(screen.getByLabelText('Email')).not.toHaveAttribute('aria-invalid');
	});

	it('points the email field at the inline error for assistive tech', async () => {
		await openDialog();

		mocks.onError?.({
			message: 'Already on your roster',
			data: { code: 'CONFLICT' },
		});

		const email = await screen.findByLabelText('Email');
		expect(email).toHaveAttribute('aria-invalid', 'true');
		expect(email).toHaveAttribute('aria-describedby', 'volunteer-add-error');
		expect(screen.getByRole('alert')).toHaveAttribute(
			'id',
			'volunteer-add-error',
		);
	});

	it('caps the name field at the domain max length', async () => {
		await openDialog();
		expect(screen.getByLabelText('Name')).toHaveAttribute('maxLength', '120');
	});

	it('disables submit and shows progress while pending', async () => {
		mocks.isPending = true;
		await openDialog();

		const submit = screen.getByRole('button', { name: 'Adding…' });
		expect(submit).toBeDisabled();
	});
});

describe('AddVolunteerDialog repeat entry (T25)', () => {
	it('stays open after a successful add, with the fields cleared', async () => {
		// THE task this surface exists for is a coordinator typing in a sign-up
		// sheet. Closing after each name makes that N trips through the trigger.
		const user = await openDialog();

		await user.type(screen.getByLabelText('Name'), 'Ada Lovelace');
		await user.type(screen.getByLabelText('Email'), 'ada@example.com');
		succeed('Ada Lovelace');

		expect(screen.getByRole('dialog')).toBeInTheDocument();
		expect(screen.getByLabelText('Name')).toHaveValue('');
		expect(screen.getByLabelText('Email')).toHaveValue('');
		expect(screen.getByLabelText(/phone/i)).toHaveValue('');
	});

	it('submits the SECOND entry with its own values, not stale or empty ones', async () => {
		// The core claim of T25, and until now only the e2e proved it — which is
		// not in CI. Every other test in this suite drives `succeed()` directly and
		// never clicks the relabelled primary, so nothing here exercised a real
		// second submit. Clearing three fields and then reading them back on the
		// next submit is exactly where a stale-closure or reset bug would land, and
		// it would ship a batch where every row after the first repeats person one.
		const user = await openDialog();

		await user.type(screen.getByLabelText('Name'), 'Ada Lovelace');
		await user.type(screen.getByLabelText('Email'), 'ada@example.com');
		await user.click(screen.getByRole('button', { name: 'Add volunteer' }));
		succeed('Ada Lovelace');

		// Named `Add another` now — clicking it by that name also proves the relabel.
		await user.type(screen.getByLabelText('Name'), 'Grace Hopper');
		await user.type(screen.getByLabelText('Email'), 'grace@example.com');
		await user.type(screen.getByLabelText(/phone/i), '555-0100');
		await user.click(screen.getByRole('button', { name: 'Add another' }));

		expect(mocks.mutate).toHaveBeenCalledTimes(2);
		expect(mocks.mutate).toHaveBeenNthCalledWith(1, {
			displayName: 'Ada Lovelace',
			email: 'ada@example.com',
			phone: null,
		});
		expect(mocks.mutate).toHaveBeenNthCalledWith(2, {
			displayName: 'Grace Hopper',
			email: 'grace@example.com',
			phone: '555-0100',
		});
	});

	it('returns focus to the name field so the next name can be typed', async () => {
		// T29: without this the coordinator's focus is left on the submit button
		// and every subsequent name costs a shift-tab hunt back up the form.
		const user = await openDialog();

		await user.type(screen.getByLabelText('Name'), 'Ada Lovelace');
		await user.type(screen.getByLabelText('Email'), 'ada@example.com');
		succeed('Ada Lovelace');

		expect(screen.getByLabelText('Name')).toHaveFocus();
	});

	it('announces a running count from a region that exists BEFORE the first add', async () => {
		// T29: `polite`, not `assertive` — it must not interrupt the name being
		// typed into the field focus was just returned to.
		//
		// The region is mounted EMPTY with the dialog rather than appearing
		// alongside its first value. Screen readers announce changes to regions
		// they were already observing, so one inserted in the same commit as its
		// text can miss the very first add — the one that tells the coordinator
		// the form is working at all. `<output>` carries an implicit role=status.
		//
		// Holding the SAME node across both adds is the assertion: if the region
		// is ever made conditional again it is a different element each time, and
		// `toHaveTextContent` below fails on a detached node.
		await openDialog();

		const region = screen.getByRole('status');
		expect(region).toHaveAttribute('aria-live', 'polite');
		expect(region).toBeEmptyDOMElement();

		succeed('Ada Lovelace');
		expect(region).toHaveTextContent('1 added');

		succeed('Grace Hopper');
		expect(region).toHaveTextContent('2 added');
	});

	it('offers Add another beside Done once something has been committed', async () => {
		// "Cancel" stops being true after the first add: it reads as an offer to
		// undo adds this button cannot undo.
		await openDialog();

		expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();

		succeed('Ada Lovelace');

		expect(
			screen.getByRole('button', { name: 'Add another' }),
		).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
		expect(
			screen.queryByRole('button', { name: 'Cancel' }),
		).not.toBeInTheDocument();
	});

	it('refreshes the roster after EVERY add, not once at the end', async () => {
		// The list and the header count are behind an open form now. Refreshing
		// only on close means the coordinator types the fourth name while reading
		// a roster showing none of the first three.
		const onAdded = vi.fn();
		await openDialog(onAdded);

		succeed('Ada Lovelace');
		succeed('Grace Hopper');

		expect(onAdded).toHaveBeenCalledTimes(2);
	});

	it('starts a fresh count on the next open', async () => {
		// Same mechanism as the stale-error regression above: both shells unmount
		// their subtree on close, so the count clears without an explicit reset.
		// If either is ever changed to stay mounted, reopening would greet the
		// coordinator with a stale "2 added" over an untouched form.
		const user = await openDialog();

		succeed('Ada Lovelace');
		succeed('Grace Hopper');
		expect(screen.getByText('2 added')).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'Done' }));
		await user.click(screen.getByRole('button', { name: /add volunteer/i }));

		expect(screen.queryByText('2 added')).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
	});

	it('the running count does not become a third branch signal', async () => {
		// NOT independent evidence of the two-branch collapse, and it must not be
		// described as such. The client only ever receives `notified`, so both
		// drives here are the same payload — a component cannot distinguish inputs
		// it is never given, and an equality assertion over identical drives cannot
		// fail for the reason "the branches diverged". That evidence lives in
		// `SECURITY: shadow-mint and other-org-UNCLAIMED produce IDENTICAL copy`
		// above, plus the service and router tests.
		//
		// What IS worth pinning is the new surface: the running count is a second
		// thing that moves on every success, and it must stay a pure function of
		// how many adds happened — never of which branch ran, and never leaking
		// into the message. A count that appeared in the toast, or advanced
		// differently per branch, would reopen the channel the toast closed.
		await openDialog();

		succeed('Ava Thompson', false);
		expect(screen.getByText('1 added')).toBeInTheDocument();
		expect(mocks.toastSuccess).toHaveBeenLastCalledWith(
			'Ava Thompson added to your roster.',
		);

		succeed('Ava Thompson', false);
		expect(screen.getByText('2 added')).toBeInTheDocument();
		// The message is byte-identical on the second add — the count did not
		// bleed into it.
		expect(mocks.toastSuccess).toHaveBeenLastCalledWith(
			'Ava Thompson added to your roster.',
		);
	});

	it('keeps the count and the batch labels when a later add fails', async () => {
		// The commonest error here is the benign "Already on your roster", and it
		// arrives mid-batch — a coordinator working down a list will hit someone
		// they already added. `onSuccess` and `onError` are independent state
		// transitions, so nothing but this test stops a future edit from resetting
		// the count on error and telling the coordinator the first two names went
		// nowhere.
		await openDialog();

		succeed('Ada Lovelace');
		act(() => {
			mocks.onError?.({
				message: 'Already on your roster',
				data: { code: 'CONFLICT' },
			});
		});

		expect(await screen.findByRole('alert')).toHaveTextContent(
			'Already on your roster',
		);
		expect(screen.getByText('1 added')).toBeInTheDocument();
		expect(
			screen.getByRole('button', { name: 'Add another' }),
		).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
	});

	it('disables DONE mid-batch, not just Cancel, and re-enables after', async () => {
		// The case the guard exists for is `Add another` → `Done` in one motion,
		// which only happens once `addedCount > 0` — i.e. on the button labelled
		// `Done`. A test that pins `isPending` before the dialog opens asserts on
		// `Cancel` at a count of zero and never reaches that branch, which is how
		// the first version of this suite "covered" the guard without testing it.
		//
		// Flipping the mock between adds is what forces a re-render at
		// `addedCount > 0 && isPending` — also the only path that renders
		// `Adding…` mid-batch.
		await openDialog();

		succeed('Ada Lovelace');
		expect(screen.getByRole('button', { name: 'Done' })).toBeEnabled();

		mocks.isPending = true;
		succeed('Grace Hopper');

		expect(screen.getByRole('button', { name: 'Done' })).toBeDisabled();
		expect(screen.getByRole('button', { name: 'Adding…' })).toBeDisabled();

		mocks.isPending = false;
		succeed('Katherine Johnson');

		expect(screen.getByRole('button', { name: 'Done' })).toBeEnabled();
		expect(screen.getByRole('button', { name: 'Add another' })).toBeEnabled();
	});

	it('disables the secondary action during the very first add', async () => {
		// The count-zero half of the guard: `Cancel`, before anything has been
		// committed. The mid-batch `Done` case — the one the guard actually exists
		// for — is the test above; this asserts only that the button is disabled,
		// NOT that the form cannot be closed. It can: Escape and an overlay click
		// still reach Radix's own close and still orphan `onSuccess` (accepted P3
		// in docs/TODOS.md), so do not rename this to a claim about closing.
		mocks.isPending = true;
		await openDialog();

		expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
		expect(screen.getByRole('button', { name: 'Adding…' })).toBeDisabled();
	});

	it('behaves the same in the Drawer as in the Dialog', async () => {
		// The form is one component, but the shell around it is not: vaul owns
		// focus and animation below `lg` and has already needed jsdom shims in
		// this file for its own quirks. The repeat-entry contract — focus back to
		// Name, count, relabelled footer — is asserted against the Dialog branch
		// everywhere above, so this is the only thing standing between a vaul
		// upgrade and a phone-only regression on the surface T28 exists for.
		mocks.mediaQueryState.isDesktop = false;
		const user = await openDialog();

		await user.type(screen.getByLabelText('Name'), 'Ada Lovelace');
		await user.type(screen.getByLabelText('Email'), 'ada@example.com');
		succeed('Ada Lovelace');

		expect(screen.getByRole('dialog').dataset.slot).toBe('drawer-content');
		expect(screen.getByLabelText('Name')).toHaveFocus();
		expect(screen.getByLabelText('Name')).toHaveValue('');
		expect(screen.getByText('1 added')).toBeInTheDocument();
		expect(
			screen.getByRole('button', { name: 'Add another' }),
		).toBeInTheDocument();
	});
});

describe('AddVolunteerDialog responsive shell (T28)', () => {
	it('switches at lg, the SAME breakpoint the list uses', async () => {
		// The list switches with Tailwind `lg:` classes and this form switches
		// with a media-query string — two mechanisms that must agree by hand.
		// If they drift, a 768-1023px viewport gets the card list behind a
		// centred dialog, which is the inconsistency the `lg` choice exists to
		// prevent. Assert the string, not just the branch it picked.
		await openDialog();
		expect(mocks.mediaQueryCalls).toContain('(min-width: 1024px)');
	});

	it('renders a Dialog at lg and above', async () => {
		await openDialog();

		expect(screen.getByRole('dialog').dataset.slot).toBe('dialog-content');
	});

	it('renders a Drawer below lg, with the same form', async () => {
		// A centred modal fighting the on-screen keyboard is the failure this
		// avoids. The form itself is one component, so the fields must be
		// reachable identically in both shells.
		mocks.mediaQueryState.isDesktop = false;
		await openDialog();

		expect(screen.getByRole('dialog').dataset.slot).toBe('drawer-content');
		expect(screen.getByLabelText('Name')).toBeInTheDocument();
		expect(screen.getByLabelText('Email')).toBeInTheDocument();
		expect(screen.getByLabelText(/phone/i)).toBeInTheDocument();
	});

	it('submits the same payload from the Drawer as from the Dialog', async () => {
		mocks.mediaQueryState.isDesktop = false;
		const user = await openDialog();

		await user.type(screen.getByLabelText('Name'), 'Ada Lovelace');
		await user.type(screen.getByLabelText('Email'), 'ada@example.com');
		await user.click(screen.getByRole('button', { name: 'Add volunteer' }));

		expect(mocks.mutate).toHaveBeenCalledWith({
			displayName: 'Ada Lovelace',
			email: 'ada@example.com',
			phone: null,
		});
	});

	it('reverses the drawer footer so the primary action comes first', async () => {
		// DrawerFooter is a plain flex-col, so the shared document order (Cancel,
		// then submit) would stack Cancel on top. Reversing puts submit first —
		// confirmed against a 375px screenshot. The Dialog branch needs no
		// reversal: it only mounts at >=1024px, where DialogFooter is already a
		// right-justified row.
		mocks.mediaQueryState.isDesktop = false;
		await openDialog();

		const footer = screen
			.getByRole('dialog')
			.querySelector('[data-slot="drawer-footer"]');
		expect(footer).toHaveClass('flex-col-reverse');
	});
});

describe('AddVolunteerDialog error safety', () => {
	it('SECURITY: does not render an internal error string verbatim', async () => {
		// safeErrorMessage swallows non-allowlisted codes so a Prisma or other
		// internal message can never reach the coordinator.
		await openDialog();

		mocks.onError?.({
			message: 'PrismaClientKnownRequestError: relation "User" does not exist',
			data: { code: 'INTERNAL_SERVER_ERROR' },
		});

		expect(
			await screen.findByText('Could not add that volunteer.'),
		).toBeInTheDocument();
		expect(screen.queryByText(/PrismaClient/)).not.toBeInTheDocument();
	});
});
