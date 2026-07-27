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

import { AddVolunteerDialog } from './AddVolunteerDialog';

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

		expect(
			await screen.findByText('Already on your roster'),
		).toBeInTheDocument();
		expect(toast.error).not.toHaveBeenCalled();
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
