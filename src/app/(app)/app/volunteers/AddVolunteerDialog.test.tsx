// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

async function openDialog() {
	const user = userEvent.setup();
	render(<AddVolunteerDialog onAdded={vi.fn()} />);
	await user.click(screen.getByRole('button', { name: /add volunteer/i }));
	return user;
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
