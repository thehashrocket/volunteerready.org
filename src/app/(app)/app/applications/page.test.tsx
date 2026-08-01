// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ useListQuery: vi.fn() }));

// Only `screener.list` drives the branch under test; a Proxy keeps the rest
// inert so this file does not break when the page gains another query.
vi.mock('@/lib/trpc/client', () => {
	const inert = new Proxy(
		{},
		{
			get: (_t, prop) => {
				if (prop === 'useMutation')
					return () => ({ mutate: vi.fn(), isPending: false });
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
								router === 'screener' && proc === 'list'
									? { useQuery: mocks.useListQuery }
									: inert,
						},
					);
				},
			},
		),
	};
});

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

import ApplicationsPage from './page';

beforeEach(() => {
	vi.clearAllMocks();
});

/**
 * This page had no test file at all when it was migrated from rendering
 * `{query.error.message}` raw to `QueryErrorCard` + `safeErrorMessage`. The
 * helper's own contract is covered in `query-error-card.test.tsx`; what these
 * assert is that THIS page actually calls it — without them, reverting the
 * migration reddens nothing.
 */
describe('ApplicationsPage error state', () => {
	it('SECURITY: does not render an internal error string verbatim', () => {
		mocks.useListQuery.mockReturnValue({
			data: undefined,
			isLoading: false,
			isError: true,
			isFetching: false,
			error: {
				message:
					'Invalid `prisma.volunteerApplication.findMany()` invocation: relation does not exist',
				data: { code: 'INTERNAL_SERVER_ERROR' },
			},
			refetch: vi.fn(),
		});

		render(<ApplicationsPage />);

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

		render(<ApplicationsPage />);

		expect(screen.getByRole('alert')).toHaveTextContent(
			'You do not have access to this organisation.',
		);
		expect(screen.queryByText('No applications yet')).not.toBeInTheDocument();
	});
});

// ---------------------------------------------------------------------------
// T36 — the mobile card list
// ---------------------------------------------------------------------------

const APPLICATIONS = [
	{
		id: 'app-1',
		submittedAt: new Date('2026-07-20T10:00:00Z'),
		submittedByEmail: 'first@example.com',
		opportunity: { id: 'opp-1', title: 'Dog walking' },
		status: 'SUBMITTED',
		screeningStatus: 'PASS',
		screeningReasons: [],
	},
	{
		id: 'app-2',
		submittedAt: new Date('2026-07-21T10:00:00Z'),
		submittedByEmail: 'second@example.com',
		opportunity: { id: 'opp-2', title: 'Kennel cleaning' },
		status: 'REVIEW',
		screeningStatus: 'REVIEW',
		screeningReasons: ['dob_missing', 'name_mismatch'],
	},
];

function renderWithApplications() {
	mocks.useListQuery.mockReturnValue({
		data: { items: APPLICATIONS, total: APPLICATIONS.length },
		isLoading: false,
		isError: false,
		isFetching: false,
		error: null,
		refetch: vi.fn(),
	});
	render(<ApplicationsPage />);
}

/**
 * Both trees are always mounted — the switch is pure CSS — so every address and
 * badge matches TWICE and an unscoped `getByText` throws. Scope through the
 * wrapper testids, exactly as `volunteers/page.test.tsx` does.
 *
 * jsdom has no layout engine and evaluates no media query, so nothing here can
 * prove WHICH tree a human sees; that is what the 375px e2e is for. What these
 * assert is that both trees exist, carry the right breakpoint classes, and
 * render the right subset of the row.
 */
const table = () => within(screen.getByTestId('applications-table'));
const cardList = () => within(screen.getByTestId('applications-card-list'));

describe('ApplicationsPage mobile card list (T36)', () => {
	it('renders both trees, switched by CSS rather than by a hook', () => {
		renderWithApplications();

		// The literal class strings, not merely "is it visible" — jsdom reports
		// both as visible, so the classes are the only evidence available here.
		expect(screen.getByTestId('applications-table')).toHaveClass(
			'hidden',
			'lg:block',
		);
		expect(screen.getByTestId('applications-card-list')).toHaveClass(
			'lg:hidden',
		);
	});

	it('keeps identity, status and flags on the card and drops the rest', () => {
		renderWithApplications();

		expect(cardList().getByText('second@example.com')).toBeInTheDocument();
		expect(cardList().getByText('2 flags')).toBeInTheDocument();

		// Screening is reference detail one tap away on the application itself,
		// not what a coordinator scans a queue for. Flags stay because they are
		// the only cell that says "this one needs you" — asserting its ABSENCE
		// here would be the change that quietly makes the phone a worse triage
		// surface than the desktop rather than a narrower one.
		expect(cardList().queryByText('Needs review')).not.toBeInTheDocument();
		// The desktop tree still carries it, so this is a per-tree difference and
		// not the badge having disappeared from the page. Matched on the exact
		// `ScreeningStatusBadge` label: a first version used `/review/i`, which
		// also matches `ApplicationStatusBadge`'s "In review" on the same fixture
		// row — so deleting the screening badge from the table entirely left it
		// green, and the negative assertion above became an unpaired
		// "never renders X".
		expect(table().getByText('Needs review')).toBeInTheDocument();
	});

	it('gives each card exactly one control, and it names its own row', () => {
		renderWithApplications();

		// One per row: the row IS the link. A count is the assertion that catches
		// a stray nested button being added later, which is both a mis-tap
		// generator and (inside a link) invalid markup.
		const links = cardList().getAllByRole('link');
		expect(links).toHaveLength(2);
		expect(links[1]).toHaveAccessibleName(
			'View application from second@example.com',
		);
		expect(links[1]).toHaveAttribute('href', '/app/applications/app-2');
	});
});

describe('ApplicationsPage loading state (T36)', () => {
	function renderLoading() {
		mocks.useListQuery.mockReturnValue({
			data: undefined,
			isLoading: true,
			isError: false,
			isFetching: true,
			error: null,
			refetch: vi.fn(),
		});
		render(<ApplicationsPage />);
	}

	it('reserves a CARD-shaped skeleton below lg, not the table one', () => {
		// Reusing the table skeleton below `lg` reserves the wrong height and
		// reflows the moment data lands — the exact failure a shaped skeleton
		// exists to prevent. This page is the only one of the four that has a
		// card skeleton at all, so nothing else would catch its removal.
		renderLoading();

		expect(
			screen.getByTestId('applications-skeleton-cards'),
		).toBeInTheDocument();
	});

	it('gates the two skeletons on the same breakpoint as the two real trees', () => {
		// A skeleton that switches at a different width than the content it
		// stands in for swaps shape mid-load.
		renderLoading();

		const cards = screen.getByTestId('applications-skeleton-cards');
		expect(cards.parentElement).toHaveClass('lg:hidden');
		// BOTH wrappers. Asserting only the card one leaves `hidden` removable
		// from the table skeleton — which paints a seven-column table skeleton on
		// a phone and then swaps to cards when data lands, the exact reflow the
		// card skeleton exists to prevent.
		const tableSkeleton = screen.getByTestId('applications-skeleton-table');
		expect(tableSkeleton.parentElement).toHaveClass('hidden', 'lg:block');
	});

	it('shows neither the empty state nor an error while loading', () => {
		// Branch order is loading → error → empty; falling through to the empty
		// state during a slow load tells a coordinator they have no applications.
		renderLoading();

		expect(screen.queryByText('No applications yet')).not.toBeInTheDocument();
		expect(screen.queryByRole('alert')).not.toBeInTheDocument();
	});
});
