// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	shift: null as unknown,
	waitlist: [] as unknown[],
}));

vi.mock('@tanstack/react-query', () => ({
	useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('@/lib/trpc/client', () => ({
	trpc: {
		shifts: {
			getById: { useQuery: () => ({ data: mocks.shift }) },
			getWaitlist: { useQuery: () => ({ data: mocks.waitlist }) },
			getCheckinStats: { useQuery: () => ({ data: undefined }) },
			markAttendance: {
				useMutation: () => ({ mutate: vi.fn(), isPending: false }),
			},
		},
	},
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// The picker has its own suite; here it only has to be identifiable.
vi.mock('./AssignVolunteerPicker', () => ({
	AssignVolunteerPicker: () => <div data-testid="assign-picker" />,
}));

import { ShiftDetailDialog } from './ShiftDetailDialog';

function makeSignup(
	id: string,
	status: string,
	accountState: 'UNCLAIMED' | 'ACTIVE',
) {
	return {
		id,
		status,
		user: {
			id: `u-${id}`,
			name: `Person ${id}`,
			email: `${id}@x.test`,
			accountState,
		},
	};
}

function makeShift(signups: unknown[], capacity = 9) {
	return {
		id: 'shift-1',
		title: 'Saturday Morning Sort',
		startTime: new Date('2026-08-01T09:00:00Z'),
		endTime: new Date('2026-08-01T12:00:00Z'),
		capacity,
		status: 'OPEN',
		location: 'Warehouse',
		signups,
	};
}

async function openDialog(hasVolunteerRoster: boolean) {
	const user = userEvent.setup();
	render(
		<ShiftDetailDialog
			shiftId="shift-1"
			hasVolunteerRoster={hasVolunteerRoster}
		>
			<button type="button">Open</button>
		</ShiftDetailDialog>,
	);
	await user.click(screen.getByRole('button', { name: 'Open' }));
	return user;
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.waitlist = [];
	mocks.shift = makeShift([
		makeSignup('a', 'CONFIRMED', 'UNCLAIMED'),
		makeSignup('b', 'CONFIRMED', 'ACTIVE'),
	]);
});

describe('ShiftDetailDialog — feature gating', () => {
	it('hides the assign picker and the suppression notice when the flag is off', async () => {
		await openDialog(false);

		expect(screen.queryByTestId('assign-picker')).not.toBeInTheDocument();
		expect(screen.queryByText(/automatic reminder/i)).not.toBeInTheDocument();
		expect(screen.queryByText('No account yet')).not.toBeInTheDocument();
	});

	it('shows both when the flag is on', async () => {
		await openDialog(true);

		expect(screen.getByTestId('assign-picker')).toBeInTheDocument();
		expect(screen.getByText(/automatic reminder/i)).toBeInTheDocument();
	});
});

describe('ShiftDetailDialog — reminder suppression', () => {
	// The disclosure that matters most. Assignment happens weeks out; this is
	// what the coordinator sees on the Friday they are checking Saturday is
	// covered, which is the last moment they can still pick up the phone.
	it('counts only volunteers who will actually be missed', async () => {
		mocks.shift = makeShift([
			makeSignup('a', 'CONFIRMED', 'UNCLAIMED'),
			makeSignup('b', 'CONFIRMED', 'UNCLAIMED'),
			makeSignup('c', 'CONFIRMED', 'ACTIVE'),
			// Cancelled and waitlisted rows are not reminded either way, so
			// counting them would overstate the problem.
			makeSignup('d', 'CANCELLED', 'UNCLAIMED'),
			makeSignup('e', 'WAITLISTED', 'UNCLAIMED'),
		]);

		await openDialog(true);

		expect(
			screen.getByText(
				'2 volunteers won’t get an automatic reminder — no account yet.',
			),
		).toBeInTheDocument();
	});

	it('reads as singular for one volunteer', async () => {
		mocks.shift = makeShift([makeSignup('a', 'CONFIRMED', 'UNCLAIMED')]);

		await openDialog(true);

		expect(
			screen.getByText(
				'1 volunteer won’t get an automatic reminder — no account yet.',
			),
		).toBeInTheDocument();
	});

	it('says nothing when every volunteer has an account', async () => {
		mocks.shift = makeShift([makeSignup('a', 'CONFIRMED', 'ACTIVE')]);

		await openDialog(true);

		expect(screen.queryByText(/automatic reminder/i)).not.toBeInTheDocument();
	});

	it('badges the affected rows so the fact survives past the toast', async () => {
		await openDialog(true);

		// One UNCLAIMED signup → exactly one badge, and no "Has account" noise on
		// the row beside it.
		expect(screen.getAllByText('No account yet')).toHaveLength(1);
		expect(screen.queryByText('Has account')).not.toBeInTheDocument();
	});
});

describe('ShiftDetailDialog — capacity', () => {
	it('renders human status labels, never raw enum values', async () => {
		mocks.shift = makeShift([
			makeSignup('a', 'WAITLISTED', 'ACTIVE'),
			makeSignup('b', 'NO_SHOW', 'ACTIVE'),
		]);

		await openDialog(true);

		expect(screen.getByText('Waitlisted')).toBeInTheDocument();
		// These four are what a coordinator used to read, in screaming snake case.
		for (const raw of ['WAITLISTED', 'NO_SHOW', 'CONFIRMED', 'CANCELLED']) {
			expect(screen.queryByText(raw)).not.toBeInTheDocument();
		}
	});

	it('keeps an exceeded cap visible in the warning tone rather than normalising it', async () => {
		mocks.shift = makeShift(
			[
				makeSignup('a', 'CONFIRMED', 'ACTIVE'),
				makeSignup('b', 'CONFIRMED', 'ACTIVE'),
			],
			1,
		);

		await openDialog(true);

		const count = screen.getByText('2 / 1');
		expect(count.className).toContain('text-warning-foreground');
	});

	it('leaves a within-capacity count in the default tone', async () => {
		await openDialog(true);

		const count = screen.getByText('2 / 9');
		expect(count.className).not.toContain('text-warning-foreground');
	});
});
