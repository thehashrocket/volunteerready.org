// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
	query: {
		data: [] as unknown[] | undefined,
		isLoading: false,
		isError: false,
		isFetching: false,
		error: null as unknown,
		refetch: vi.fn(),
	},
	signup: vi.fn(),
	waitlist: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
	useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/trpc/client', () => ({
	trpc: {
		shifts: {
			claimable: { useQuery: () => state.query },
			signup: { useMutation: () => ({ mutate: state.signup }) },
			joinWaitlist: { useMutation: () => ({ mutate: state.waitlist }) },
		},
	},
}));

import { OpenShifts } from './open-shifts';

function shift(overrides: Record<string, unknown> = {}) {
	return {
		id: 'shift-1',
		title: 'Saturday Food Sort — Morning',
		startTime: '2030-03-08T16:00:00Z',
		endTime: '2030-03-08T19:00:00Z',
		location: '1200 Main St',
		isRemote: false,
		capacity: 10,
		seatsLeft: 6,
		isFull: false,
		orgName: 'Helping Hands',
		opportunityTitle: 'Weekly Sorting',
		myStatus: null,
		...overrides,
	};
}

beforeEach(() => {
	state.query = {
		data: [],
		isLoading: false,
		isError: false,
		isFetching: false,
		error: null,
		refetch: vi.fn(),
	};
	state.signup.mockReset();
	state.waitlist.mockReset();
});
afterEach(cleanup);

describe('OpenShifts', () => {
	it('signs the volunteer up for an open shift', () => {
		state.query.data = [shift()];
		render(<OpenShifts />);
		expect(screen.getByText('Saturday Food Sort — Morning')).toBeTruthy();
		expect(screen.getByText('Helping Hands · Weekly Sorting')).toBeTruthy();
		expect(screen.getByText('6 spots left')).toBeTruthy();
		fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));
		expect(state.signup).toHaveBeenCalledWith({ shiftId: 'shift-1' });
	});

	it('offers the waitlist, not a signup, when a shift is full', () => {
		state.query.data = [shift({ isFull: true, seatsLeft: 0 })];
		render(<OpenShifts />);
		expect(screen.queryByRole('button', { name: 'Sign up' })).toBeNull();
		fireEvent.click(screen.getByRole('button', { name: 'Join waitlist' }));
		expect(state.waitlist).toHaveBeenCalledWith({ shiftId: 'shift-1' });
	});

	it('shows status instead of a button for a shift I already have', () => {
		state.query.data = [
			shift({ id: 'a', myStatus: 'CONFIRMED' }),
			shift({ id: 'b', myStatus: 'WAITLISTED', isFull: true }),
		];
		render(<OpenShifts />);
		expect(screen.getByText('You’re signed up')).toBeTruthy();
		expect(screen.getByText('On the waitlist')).toBeTruthy();
		expect(screen.queryByRole('button')).toBeNull();
	});

	it('offers no signup for a shift I am already recorded on', () => {
		state.query.data = [shift({ myStatus: 'ATTENDED' })];
		render(<OpenShifts />);
		expect(screen.getByText('Already recorded')).toBeTruthy();
		expect(screen.queryByRole('button')).toBeNull();
	});

	it('explains the empty list', () => {
		render(<OpenShifts />);
		expect(screen.getByText(/Once an organization approves your/)).toBeTruthy();
	});

	it('shows an error with a retry, not an empty list, when the query fails', () => {
		state.query.isError = true;
		state.query.data = undefined;
		render(<OpenShifts />);
		expect(screen.getByRole('alert')).toBeTruthy();
		expect(screen.queryByText(/Once an organization approves/)).toBeNull();
		fireEvent.click(screen.getByRole('button', { name: /Try again/ }));
		expect(state.query.refetch).toHaveBeenCalled();
	});
});
