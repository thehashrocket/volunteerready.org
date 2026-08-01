// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	pendingIds: new Set<string>(),
	useShiftsQuery: vi.fn(),
	refetch: vi.fn(),
	// Keyed BY PROCEDURE, not one shared object. `isShiftPending` ORs three
	// independent mutations, and a single shared mock makes those three clauses
	// three copies of one expression — two of them deletable with every test
	// still green, which is precisely the collapse the split exists to prevent.
	mutations: {
		complete: { mutate: vi.fn(), isPending: false, variables: undefined },
		cancel: { mutate: vi.fn(), isPending: false, variables: undefined },
		remove: { mutate: vi.fn(), isPending: false, variables: undefined },
		other: { mutate: vi.fn(), isPending: false, variables: undefined },
	} as Record<
		string,
		{
			mutate: ReturnType<typeof vi.fn>;
			isPending: boolean;
			variables: { id: string } | undefined;
		}
	>,
}));

// Every other trpc path this tree touches is inert for these tests; only
// `shifts.list` drives the branch under test. A Proxy keeps the mock from
// breaking the day someone adds another query to the page.
vi.mock('@/lib/trpc/client', () => {
	const inertMutation = () => mocks.mutations.other;
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
				if (prop === 'complete' || prop === 'cancel' || prop === 'remove') {
					return { useMutation: () => mocks.mutations[prop as string] };
				}
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

// `usePendingIds` owns which ROWS are mid-request. Mocked here so a test can
// declare a set directly; the hook's own semantics — including the concurrency
// property this replaced `mutation.variables` to get — are covered in
// `src/lib/hooks/use-pending-ids.test.ts`.
vi.mock('@/lib/hooks/use-pending-ids', () => ({
	usePendingIds: () => ({
		has: (id: string) => mocks.pendingIds.has(id),
		start: vi.fn(),
		finish: vi.fn(),
	}),
}));

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

// `clearAllMocks` clears call records but does NOT restore implementations, and
// this file spies on `window.confirm`. Without this, a failure between the spy
// and its `mockRestore()` leaks a confirm that always returns false into every
// later test in the file — turning one real failure into a cascade.
afterEach(() => {
	vi.restoreAllMocks();
});

beforeEach(() => {
	vi.clearAllMocks();
	mocks.pendingIds.clear();
	for (const m of Object.values(mocks.mutations)) {
		m.isPending = false;
		m.variables = undefined;
	}
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

// ---------------------------------------------------------------------------
// T36 — the mobile card list
// ---------------------------------------------------------------------------

const SHIFTS = [
	{
		id: 'shift-1',
		title: 'Saturday morning',
		status: 'OPEN',
		startTime: new Date('2026-08-01T09:00:00Z'),
		endTime: new Date('2026-08-01T12:00:00Z'),
		location: 'Main kennel',
		isRemote: false,
		capacity: 10,
		_count: { signups: 4 },
		opportunity: { id: 'opp-1', title: 'Dog walking' },
	},
	{
		// FULL, not just OPEN: `ShiftRowActions`' rule is
		// `status === 'OPEN' || status === 'FULL'`, and with only an OPEN row in
		// the fixture, narrowing it to `=== 'OPEN'` stays green — which would
		// strip Complete and Cancel from exactly the shifts a coordinator most
		// needs to close out.
		id: 'shift-full',
		title: 'Friday evening',
		status: 'FULL',
		startTime: new Date('2026-08-03T17:00:00Z'),
		endTime: new Date('2026-08-03T20:00:00Z'),
		location: 'Front desk',
		isRemote: false,
		capacity: 4,
		_count: { signups: 4 },
		opportunity: null,
	},
	{
		id: 'shift-2',
		title: 'Sunday cleanup',
		status: 'COMPLETED',
		startTime: new Date('2026-08-02T09:00:00Z'),
		endTime: new Date('2026-08-02T11:00:00Z'),
		location: null,
		isRemote: true,
		capacity: 6,
		_count: { signups: 6 },
		opportunity: null,
	},
];

function renderWithShifts() {
	mocks.useShiftsQuery.mockReturnValue(queryResult({ data: SHIFTS }));
	render(<ShiftsClient hasVolunteerRoster={false} />);
}

/**
 * Both trees are always mounted — the switch is pure CSS — so every title,
 * badge and action button matches TWICE and an unscoped query throws. Scope
 * through the wrapper testids, exactly as `volunteers/page.test.tsx` does.
 *
 * jsdom has no layout engine and evaluates no media query, so nothing here can
 * prove WHICH tree a human sees; that is the 375px e2e's job.
 */
const cardList = () => within(screen.getByTestId('shifts-card-list'));

describe('ShiftsClient mobile card list (T36)', () => {
	it('renders both trees, switched by CSS rather than by a hook', () => {
		renderWithShifts();

		expect(screen.getByTestId('shifts-table')).toHaveClass(
			'hidden',
			'lg:block',
		);
		expect(screen.getByTestId('shifts-card-list')).toHaveClass('lg:hidden');
	});

	it('leads with the facts a coordinator opens this page to check', () => {
		renderWithShifts();

		// "Is Saturday covered?" — the title, when it runs, and how many of the
		// places are taken. Everything else is secondary.
		expect(cardList().getByText('Saturday morning')).toBeInTheDocument();
		expect(
			cardList().getByText(/Main kennel · 4\/10 signed up/),
		).toBeInTheDocument();
	});

	it('KEEPS the lifecycle actions on the card', () => {
		renderWithShifts();

		// Deliberately not moved into `ShiftDetailDialog` the way the roster's
		// Remove was: that dialog holds signups, the assign picker and
		// attendance, and none of Complete/Cancel/Delete exist anywhere but this
		// list. Pushing them one tap deeper would leave a phone unable to close
		// out a shift at all.
		expect(
			cardList().getByRole('button', {
				name: 'Mark "Saturday morning" complete',
			}),
		).toBeInTheDocument();
		expect(
			cardList().getByRole('button', { name: 'Cancel "Saturday morning"' }),
		).toBeInTheDocument();
		expect(
			cardList().getByRole('button', { name: 'Delete "Saturday morning"' }),
		).toBeInTheDocument();
	});

	it('offers Complete and Cancel only while a shift is still live', () => {
		renderWithShifts();

		// A COMPLETED shift keeps Delete and loses the other two — the same rule
		// the table applies, which is the point of the two trees sharing one
		// `ShiftRowActions` rather than each spelling the condition out.
		expect(
			cardList().getByRole('button', { name: 'Delete "Sunday cleanup"' }),
		).toBeInTheDocument();
		expect(
			cardList().queryByRole('button', {
				name: 'Mark "Sunday cleanup" complete',
			}),
		).not.toBeInTheDocument();
	});

	it('drops the linked opportunity to the detail dialog', () => {
		renderWithShifts();

		// Present on the desktop tree beside the title; on a phone it is one tap
		// away rather than competing with the date for the same line.
		//
		// The dialog genuinely renders it — verified, and it did NOT when this
		// test was first written. Review caught that the card's comment claimed a
		// destination the dialog did not have, which would have made this a
		// capability change wearing a layout change's clothes. `ShiftDetailDialog`
		// now shows "Part of {opportunity.title}".
		expect(cardList().queryByText(/Dog walking/)).not.toBeInTheDocument();
		expect(
			within(screen.getByTestId('shifts-table')).getByText(/Dog walking/),
		).toBeInTheDocument();
	});
});

describe('ShiftsClient per-row action state (T36)', () => {
	it('offers Complete and Cancel on a FULL shift, not just an OPEN one', () => {
		renderWithShifts();

		// The other half of `isLive`. Without a FULL row in the fixture,
		// narrowing the predicate to `=== 'OPEN'` passes.
		expect(
			cardList().getByRole('button', {
				name: 'Mark "Friday evening" complete',
			}),
		).toBeInTheDocument();
	});

	it('disables only the row being acted on, not every row', () => {
		mocks.pendingIds.add('shift-1');
		renderWithShifts();

		expect(
			cardList().getByRole('button', {
				name: 'Mark "Saturday morning" complete',
			}),
		).toBeDisabled();
		// The half that fails under a bare `isPending`: a different live row
		// stays usable. Before T36 this page had no disabled state at all, so a
		// double-tap on a 44px phone target sent the mutation twice.
		expect(
			cardList().getByRole('button', {
				name: 'Mark "Friday evening" complete',
			}),
		).toBeEnabled();
	});
});

describe('ShiftsClient concurrent pending rows (T36)', () => {
	// Three independent lifecycle mutations share one pending set, keyed by row
	// rather than by mutation — "is this shift busy" is one question. The shape
	// this replaced keyed off each mutation's `variables`, which query-core only
	// tracks for the most recent call, so completing shift B re-enabled a shift A
	// whose delete was still in flight.
	it('keeps every mid-request row disabled, not just the latest', () => {
		mocks.pendingIds.add('shift-1');
		mocks.pendingIds.add('shift-full');
		renderWithShifts();

		expect(
			cardList().getByRole('button', {
				name: 'Mark "Saturday morning" complete',
			}),
		).toBeDisabled();
		expect(
			cardList().getByRole('button', {
				name: 'Mark "Friday evening" complete',
			}),
		).toBeDisabled();
	});
});

describe('ShiftsClient delete confirmation (T36)', () => {
	// Delete is irreversible and guarded only by a native `confirm()`. Nothing
	// stubbed it before, so inverting the `!` — turning "cancel" into "delete
	// anyway" — reddened nothing in any suite.
	it('does NOT delete when the confirm is dismissed', () => {
		const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
		renderWithShifts();

		fireEvent.click(
			cardList().getByRole('button', { name: 'Delete "Saturday morning"' }),
		);

		expect(confirmSpy).toHaveBeenCalled();
		expect(mocks.mutations.remove.mutate).not.toHaveBeenCalled();
		confirmSpy.mockRestore();
	});

	it('deletes the row it was fired from when confirmed', () => {
		const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
		renderWithShifts();

		// The SECOND live row deliberately: firing on the first passes even with
		// a stale-closure bug that always names row one.
		fireEvent.click(
			cardList().getByRole('button', { name: 'Delete "Friday evening"' }),
		);

		expect(mocks.mutations.remove.mutate).toHaveBeenCalledWith({
			id: 'shift-full',
		});
		confirmSpy.mockRestore();
	});
});

describe('ShiftsClient shared date formatting (T36)', () => {
	// `formatShiftDate`/`formatShiftTimeRange` were extracted so the two trees
	// cannot drift. Neither tree asserted the date/time line, so the extraction's
	// whole purpose was unverified — one tree could have been left on the old
	// inline `toLocaleTimeString` call with nothing to catch it.
	it('renders the same date and time range in both trees', () => {
		renderWithShifts();

		const expected = new Date(SHIFTS[0].startTime).toLocaleDateString();
		expect(cardList().getByText(new RegExp(expected))).toBeInTheDocument();
		expect(
			within(screen.getByTestId('shifts-table')).getByText(expected),
		).toBeInTheDocument();
	});

	it('shows a time RANGE, not just a start time', () => {
		// The card folds date and time onto one line; dropping the end time there
		// would silently answer "is Saturday covered?" with half the information.
		renderWithShifts();

		const start = new Date(SHIFTS[0].startTime).toLocaleTimeString([], {
			hour: '2-digit',
			minute: '2-digit',
		});
		const end = new Date(SHIFTS[0].endTime).toLocaleTimeString([], {
			hour: '2-digit',
			minute: '2-digit',
		});
		expect(
			cardList().getByText(new RegExp(`${start}.*–.*${end}`)),
		).toBeInTheDocument();
	});
});
