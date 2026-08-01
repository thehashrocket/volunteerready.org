// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	pendingIds: new Set<string>(),
	useListQuery: vi.fn(),
	// The page's one mutation (`opportunities.updateStatus`). Held here rather
	// than returned fresh so a test can put it in flight for a NAMED row, which
	// is what the per-row disabling assertion needs.
	mutation: {
		mutate: vi.fn(),
		isPending: false,
		variables: undefined as { id: string } | undefined,
	},
}));

// Only `opportunities.list` drives the branch under test; a Proxy keeps the rest
// inert so this file does not break when the page gains another query.
vi.mock('@/lib/trpc/client', () => {
	const inert = new Proxy(
		{},
		{
			get: (_t, prop) => {
				if (prop === 'useMutation') return () => mocks.mutation;
				if (prop === 'useQuery')
					return () => ({ data: undefined, isLoading: false, isError: false });
				return undefined;
			},
		},
	);
	return {
		trpc: new Proxy(
			{},
			{
				get: (_t, router) => {
					if (router === 'useUtils') return () => ({});
					return new Proxy(
						{},
						{
							get: (_r, proc) =>
								router === 'opportunities' && proc === 'list'
									? { useQuery: mocks.useListQuery }
									: inert,
						},
					);
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

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@tanstack/react-query', async () => {
	const actual = await vi.importActual<typeof import('@tanstack/react-query')>(
		'@tanstack/react-query',
	);
	return { ...actual, useQueryClient: () => ({ invalidateQueries: vi.fn() }) };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { OpportunitiesClient } from './OpportunitiesClient';

beforeEach(() => {
	vi.clearAllMocks();
	mocks.pendingIds.clear();
	mocks.mutation.isPending = false;
	mocks.mutation.variables = undefined;
});

/**
 * This page had no test file at all when it was migrated from rendering
 * `{query.error.message}` raw to `QueryErrorCard` + `safeErrorMessage`. The
 * helper's own contract is covered in `query-error-card.test.tsx`; what these
 * assert is that THIS page actually calls it — without them, reverting the
 * migration reddens nothing.
 */
describe('OpportunitiesClient error state', () => {
	it('SECURITY: does not render an internal error string verbatim', () => {
		mocks.useListQuery.mockReturnValue({
			data: undefined,
			isLoading: false,
			isError: true,
			isFetching: false,
			error: {
				message: 'Invalid `prisma.volunteerOpportunity.findMany()` invocation',
				data: { code: 'INTERNAL_SERVER_ERROR' },
			},
			refetch: vi.fn(),
		});

		render(<OpportunitiesClient />);

		expect(screen.queryByText(/prisma\./i)).not.toBeInTheDocument();
		expect(screen.getByRole('alert')).toHaveTextContent(
			'Something went wrong. Please try again.',
		);
	});

	it('shows an allowlisted message and never the empty state', () => {
		mocks.useListQuery.mockReturnValue({
			data: undefined,
			isLoading: false,
			isError: true,
			isFetching: false,
			error: {
				message: 'You do not have access to this organisation.',
				data: { code: 'FORBIDDEN' },
			},
			refetch: vi.fn(),
		});

		render(<OpportunitiesClient />);

		expect(screen.getByRole('alert')).toHaveTextContent(
			'You do not have access to this organisation.',
		);
		expect(screen.queryByText('No opportunities yet')).not.toBeInTheDocument();
	});
});

// ---------------------------------------------------------------------------
// T36 — the mobile card list
// ---------------------------------------------------------------------------

const OPPORTUNITIES = [
	{
		id: 'opp-1',
		title: 'Dog walking',
		description: '',
		status: 'PUBLISHED' as const,
		location: 'Fresno, CA',
		isRemote: false,
		startDate: null,
		endDate: null,
		commitmentHours: null,
		capacity: 12,
		createdAt: new Date('2026-07-01T00:00:00Z'),
		updatedAt: new Date('2026-07-01T00:00:00Z'),
		tags: [{ id: 'tag-1', name: 'Animals' }],
		requirements: [],
	},
	{
		id: 'opp-2',
		title: 'Kennel cleaning',
		description: '',
		status: 'DRAFT' as const,
		location: null,
		isRemote: true,
		startDate: null,
		endDate: null,
		commitmentHours: null,
		capacity: null,
		createdAt: new Date('2026-07-02T00:00:00Z'),
		updatedAt: new Date('2026-07-02T00:00:00Z'),
		tags: [],
		requirements: [],
	},
];

function renderWithOpportunities() {
	mocks.useListQuery.mockReturnValue({
		data: { items: OPPORTUNITIES },
		isLoading: false,
		isError: false,
		isFetching: false,
		error: null,
		refetch: vi.fn(),
	});
	render(<OpportunitiesClient />);
}

/**
 * Both trees are always mounted — the switch is pure CSS — so every title and
 * badge matches TWICE and an unscoped `getByText` throws. Scope through the
 * wrapper testids, exactly as `volunteers/page.test.tsx` does.
 *
 * jsdom has no layout engine and evaluates no media query, so nothing here can
 * prove WHICH tree a human sees; that is the 375px e2e's job.
 */
const table = () => within(screen.getByTestId('opportunities-table'));
const cardList = () => within(screen.getByTestId('opportunities-card-list'));

describe('OpportunitiesClient mobile card list (T36)', () => {
	it('renders both trees, switched by CSS rather than by a hook', () => {
		renderWithOpportunities();

		expect(screen.getByTestId('opportunities-table')).toHaveClass(
			'hidden',
			'lg:block',
		);
		expect(screen.getByTestId('opportunities-card-list')).toHaveClass(
			'lg:hidden',
		);
	});

	it('KEEPS the state-transition action on the card', () => {
		renderWithOpportunities();

		// The one place this deliberately departs from the roster's shape, and
		// the reason is a capability rather than a preference: `Publish`/`Close`
		// exist on this list and NOWHERE else — the opportunity detail page has
		// only `Edit`. A whole-row card with the actions pushed one tap deeper
		// would be a phone that cannot publish an opportunity at all.
		expect(
			cardList().getByRole('button', { name: 'Publish "Kennel cleaning"' }),
		).toBeInTheDocument();
		expect(
			cardList().getByRole('button', { name: 'Close "Dog walking"' }),
		).toBeInTheDocument();
	});

	it('drops tags to the detail page and folds the metadata into one line', () => {
		renderWithOpportunities();

		expect(cardList().queryByText('Animals')).not.toBeInTheDocument();
		// Still on the desktop tree, so this is a per-tree difference rather than
		// the tag having vanished from the page.
		expect(table().getByText('Animals')).toBeInTheDocument();

		expect(cardList().getByText('Fresno, CA · 12 places')).toBeInTheDocument();
	});

	it('titles link to the detail page rather than making the row a button', () => {
		renderWithOpportunities();

		// A nested `<button>` inside a tappable row is invalid markup, so a card
		// that carries its own actions cannot also be a button. The title is the
		// navigation.
		const link = cardList().getByRole('link', { name: 'Kennel cleaning' });
		expect(link).toHaveAttribute('href', '/app/opportunities/opp-2');
	});

	it('disables only the row being published, not every row', () => {
		mocks.pendingIds.add('opp-2');
		renderWithOpportunities();

		// Gating on the bare `isPending` greys out the whole list on one click —
		// worst on the card tree, where the button is a full-width row of its own
		// and nothing says WHICH opportunity is moving.
		expect(
			cardList().getByRole('button', { name: 'Publish "Kennel cleaning"' }),
		).toBeDisabled();
		expect(
			cardList().getByRole('button', { name: 'Close "Dog walking"' }),
		).toBeEnabled();
	});

	it('disables EVERY row that is mid-request, not just the latest', () => {
		// The regression this replaced `mutation.variables` to fix: query-core's
		// `mutate()` detaches the observer from the previous call, so `variables`
		// names only the most recent one and an earlier in-flight row silently
		// re-enables. Two concurrent transitions must both stay disabled.
		mocks.pendingIds.add('opp-1');
		mocks.pendingIds.add('opp-2');
		renderWithOpportunities();

		expect(
			cardList().getByRole('button', { name: 'Publish "Kennel cleaning"' }),
		).toBeDisabled();
		expect(
			cardList().getByRole('button', { name: 'Close "Dog walking"' }),
		).toBeDisabled();
	});

	it('fires the mutation for its OWN row', () => {
		renderWithOpportunities();

		// The SECOND row deliberately: clicking the first passes even with a
		// stale-closure bug that always names row one.
		fireEvent.click(
			cardList().getByRole('button', { name: 'Publish "Kennel cleaning"' }),
		);

		expect(mocks.mutation.mutate).toHaveBeenCalledWith({
			id: 'opp-2',
			status: 'PUBLISHED',
		});
	});
});

describe('OpportunitiesClient row action naming (T36)', () => {
	it('names every action by its own opportunity, on BOTH trees', () => {
		// Both trees are mounted, so a bare "Publish"/"Edit" gives a rotor 2N
		// identical entries. Only the accessible name carries the target; the
		// visible label stays one word per the table's density.
		renderWithOpportunities();

		for (const scope of [table(), cardList()]) {
			expect(
				scope.getByRole('button', { name: 'Publish "Kennel cleaning"' }),
			).toBeInTheDocument();
			expect(
				scope.getByRole('button', { name: 'Close "Dog walking"' }),
			).toBeInTheDocument();
			expect(
				scope.getByRole('button', { name: 'Edit "Kennel cleaning"' }),
			).toBeInTheDocument();
		}
	});

	it('offers exactly ONE state transition per row, never both', () => {
		// `DRAFT → Publish` and `PUBLISHED → Close` are separate conditions.
		// Broadening either (e.g. `!== 'DRAFT'`) would render Close on a closed
		// opportunity, or both buttons on one row.
		renderWithOpportunities();

		expect(
			cardList().queryByRole('button', { name: 'Close "Kennel cleaning"' }),
		).not.toBeInTheDocument();
		expect(
			cardList().queryByRole('button', { name: 'Publish "Dog walking"' }),
		).not.toBeInTheDocument();
	});

	it('opens the edit dialog from the card without navigating', () => {
		// `Edit` is the one card action that is not a mutation — it opens a
		// dialog. Nothing asserted it existed on the card at all.
		renderWithOpportunities();

		fireEvent.click(
			cardList().getByRole('button', { name: 'Edit "Kennel cleaning"' }),
		);

		expect(screen.getByRole('dialog')).toBeInTheDocument();
	});
});
