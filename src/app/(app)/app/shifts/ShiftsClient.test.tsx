// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	useShiftsQuery: vi.fn(),
	refetch: vi.fn(),
}));

// Every other trpc path this tree touches is inert for these tests; only
// `shifts.list` drives the branch under test. A Proxy keeps the mock from
// breaking the day someone adds another query to the page.
vi.mock('@/lib/trpc/client', () => {
	const inertMutation = () => ({ mutate: vi.fn(), isPending: false });
	const inertQuery = () => ({
		data: undefined,
		isLoading: false,
		isError: false,
		isFetching: false,
		error: null,
		refetch: vi.fn(),
	});
	const leaf = new Proxy(
		{},
		{
			get: (_t, prop) => {
				if (prop === 'useMutation') return inertMutation;
				if (prop === 'useQuery') return inertQuery;
				return undefined;
			},
		},
	);
	const router: Record<string, unknown> = new Proxy(
		{},
		{
			get: (_t, prop) => {
				if (prop === 'list') return { useQuery: mocks.useShiftsQuery };
				return leaf;
			},
		},
	);
	return {
		trpc: new Proxy(
			{},
			{
				get: (_t, prop) => {
					if (prop === 'shifts') return router;
					if (prop === 'useUtils') return () => ({});
					return new Proxy({}, { get: () => leaf });
				},
			},
		),
	};
});

vi.mock('@tanstack/react-query', async () => {
	const actual = await vi.importActual<typeof import('@tanstack/react-query')>(
		'@tanstack/react-query',
	);
	return { ...actual, useQueryClient: () => ({ invalidateQueries: vi.fn() }) };
});

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { ShiftsClient } from './ShiftsClient';

function queryResult(over: Record<string, unknown> = {}) {
	return {
		data: undefined,
		isLoading: false,
		isError: false,
		isFetching: false,
		error: null,
		refetch: mocks.refetch,
		...over,
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.useShiftsQuery.mockReturnValue(queryResult({ data: [] }));
});

describe('ShiftsClient error state (T35)', () => {
	it('shows an error card, NEVER the empty state, when the query fails', () => {
		// The bug this closes: before the isError branch existed, a failed query
		// fell through to "No shifts found" — a coordinator checking whether
		// Saturday is covered would be told, confidently, that it is not.
		//
		// The negative assertion is the load-bearing half: it pins the branch
		// ORDER (isLoading -> isError -> empty). Reinstating the fall-through
		// keeps the positive assertion green.
		mocks.useShiftsQuery.mockReturnValue(
			queryResult({
				isError: true,
				error: {
					message: 'You do not have access.',
					data: { code: 'FORBIDDEN' },
				},
			}),
		);

		render(<ShiftsClient hasVolunteerRoster={false} />);

		expect(screen.getByRole('alert')).toHaveTextContent(
			"Couldn't load your shifts",
		);
		expect(screen.queryByText('No shifts found')).not.toBeInTheDocument();
	});

	it('SECURITY: does not render an internal error string verbatim', () => {
		mocks.useShiftsQuery.mockReturnValue(
			queryResult({
				isError: true,
				error: {
					message: 'Invalid `prisma.shift.findMany()` invocation',
					data: { code: 'INTERNAL_SERVER_ERROR' },
				},
			}),
		);

		render(<ShiftsClient hasVolunteerRoster={false} />);

		expect(screen.queryByText(/prisma\./i)).not.toBeInTheDocument();
		expect(screen.getByRole('alert')).toHaveTextContent(
			'Something went wrong. Please try again.',
		);
	});

	it('still shows the empty state when the query genuinely returns nothing', () => {
		// The other side of the branch — proving the error card did not simply
		// swallow the empty case.
		render(<ShiftsClient hasVolunteerRoster={false} />);

		expect(screen.getByText('No shifts found')).toBeInTheDocument();
		expect(screen.queryByRole('alert')).not.toBeInTheDocument();
	});
});
