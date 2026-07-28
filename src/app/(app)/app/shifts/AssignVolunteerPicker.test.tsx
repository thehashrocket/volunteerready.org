// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	mutate: vi.fn(),
	toastSuccess: vi.fn(),
	toastError: vi.fn(),
	onSuccess: null as ((r: unknown) => void) | null,
	isPending: false,
	query: {
		data: [] as unknown[],
		isLoading: false,
		isError: false,
		error: null as unknown,
	},
}));

vi.mock('@/lib/trpc/client', () => ({
	trpc: {
		shifts: {
			assignableVolunteers: { useQuery: () => mocks.query },
			assignVolunteer: {
				useMutation: (opts: { onSuccess: (r: unknown) => void }) => {
					mocks.onSuccess = opts.onSuccess;
					return { mutate: mocks.mutate, isPending: mocks.isPending };
				},
			},
		},
	},
}));

vi.mock('sonner', () => ({
	toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

import { AssignVolunteerPicker } from './AssignVolunteerPicker';

const MARIA = {
	id: 'ov-1',
	displayName: 'Maria Garcia',
	email: 'maria@x.test',
	accountState: 'UNCLAIMED' as const,
};
const SAM = {
	id: 'ov-2',
	displayName: 'Sam Chen',
	email: 'sam@x.test',
	accountState: 'ACTIVE' as const,
};

async function openPicker(props: { capacity: number; confirmedCount: number }) {
	const user = userEvent.setup();
	render(
		<AssignVolunteerPicker
			shiftId="shift-1"
			shiftTitle="Saturday Morning Sort"
			onAssigned={vi.fn()}
			{...props}
		/>,
	);
	await user.click(screen.getByRole('button', { name: /assign volunteer/i }));
	return user;
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.isPending = false;
	mocks.onSuccess = null;
	mocks.query = {
		data: [MARIA, SAM],
		isLoading: false,
		isError: false,
		error: null,
	};
});

describe('AssignVolunteerPicker', () => {
	it('shows each candidate with their account state, so suppression is known before choosing', async () => {
		await openPicker({ capacity: 9, confirmedCount: 3 });

		expect(await screen.findByText('Maria Garcia')).toBeInTheDocument();
		expect(screen.getByText('maria@x.test')).toBeInTheDocument();
		// The badge is what tells the coordinator this person will never be
		// reminded — the whole point of surfacing accountState here.
		expect(screen.getByText('No account yet')).toBeInTheDocument();
		expect(screen.getByText('Has account')).toBeInTheDocument();
	});

	it('assigns directly when the shift has room, with no override', async () => {
		const user = await openPicker({ capacity: 9, confirmedCount: 3 });

		await user.click(await screen.findByText('Sam Chen'));

		expect(mocks.mutate).toHaveBeenCalledWith({
			shiftId: 'shift-1',
			volunteerId: 'ov-2',
		});
	});

	it('distinguishes a filtered-empty roster from an error', async () => {
		mocks.query = {
			data: [],
			isLoading: false,
			isError: false,
			error: null,
		};
		await openPicker({ capacity: 9, confirmedCount: 3 });

		expect(
			await screen.findByText('No volunteers match that search.'),
		).toBeInTheDocument();
	});

	// -- Over capacity -------------------------------------------------------

	it('confirms with the REAL numbers before exceeding capacity', async () => {
		const user = await openPicker({ capacity: 9, confirmedCount: 9 });

		await user.click(await screen.findByText('Maria Garcia'));

		// Not "this shift is full" — the coordinator is deciding whether one more
		// is acceptable, and 9-of-9 and 40-of-9 are different decisions.
		expect(screen.getByText(/9 of 9/)).toBeInTheDocument();
		expect(screen.getByText(/Add Maria Garcia anyway\?/)).toBeInTheDocument();
		// Nothing is written until the coordinator confirms.
		expect(mocks.mutate).not.toHaveBeenCalled();
	});

	it('sets allowOverCapacity only after the confirm', async () => {
		const user = await openPicker({ capacity: 9, confirmedCount: 9 });

		await user.click(await screen.findByText('Maria Garcia'));
		await user.click(screen.getByRole('button', { name: 'Add anyway' }));

		expect(mocks.mutate).toHaveBeenCalledWith({
			shiftId: 'shift-1',
			volunteerId: 'ov-1',
			allowOverCapacity: true,
		});
	});

	it('cancelling the confirm writes nothing and returns to the list', async () => {
		const user = await openPicker({ capacity: 9, confirmedCount: 9 });

		await user.click(await screen.findByText('Maria Garcia'));
		await user.click(screen.getByRole('button', { name: 'Cancel' }));

		expect(mocks.mutate).not.toHaveBeenCalled();
		expect(await screen.findByText('Sam Chen')).toBeInTheDocument();
	});

	// -- Confirmation copy ---------------------------------------------------

	it('says the reminder will not arrive when the volunteer has no account', async () => {
		await openPicker({ capacity: 9, confirmedCount: 3 });

		mocks.onSuccess?.({
			displayName: 'Maria Garcia',
			shiftTitle: 'Saturday Morning Sort',
			accountState: 'UNCLAIMED',
		});

		expect(mocks.toastSuccess).toHaveBeenCalledWith(
			"Maria Garcia added to Saturday Morning Sort. They won't get an automatic reminder — no account yet.",
		);
	});

	it('stays quiet about reminders for a volunteer who has an account', async () => {
		await openPicker({ capacity: 9, confirmedCount: 3 });

		mocks.onSuccess?.({
			displayName: 'Sam Chen',
			shiftTitle: 'Saturday Morning Sort',
			accountState: 'ACTIVE',
		});

		expect(mocks.toastSuccess).toHaveBeenCalledWith(
			'Sam Chen added to Saturday Morning Sort.',
		);
	});
});
