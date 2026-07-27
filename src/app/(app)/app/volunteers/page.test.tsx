// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	useListQuery: vi.fn(),
	useCountQuery: vi.fn(),
	useRemoveMutation: vi.fn(),
	invalidate: vi.fn(),
}));

vi.mock('@/lib/trpc/client', () => ({
	trpc: {
		volunteers: {
			list: { useQuery: mocks.useListQuery },
			count: { useQuery: mocks.useCountQuery },
			remove: { useMutation: mocks.useRemoveMutation },
			add: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
		},
		useUtils: () => ({ volunteers: { invalidate: mocks.invalidate } }),
	},
}));

vi.mock('sonner', () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

import VolunteersPage from './page';

function listResult(over: Record<string, unknown> = {}) {
	return {
		data: { volunteers: [], nextCursor: null },
		isLoading: false,
		isError: false,
		isFetching: false,
		error: null,
		refetch: vi.fn(),
		...over,
	};
}

const VOLUNTEER = {
	id: 'ov-1',
	displayName: 'Maria Garcia',
	email: 'maria@example.com',
	phone: null,
	accountState: 'UNCLAIMED' as const,
	source: 'STAFF_ADDED' as const,
	userId: 'u-1',
	addedAt: new Date('2026-03-01T00:00:00Z'),
	attendedShifts: 12,
};

beforeEach(() => {
	vi.clearAllMocks();
	mocks.useListQuery.mockReturnValue(listResult());
	mocks.useCountQuery.mockReturnValue({ data: 0 });
	mocks.useRemoveMutation.mockReturnValue({
		mutate: vi.fn(),
		isPending: false,
	});
});

describe('VolunteersPage states', () => {
	it('renders a table-shaped skeleton with the REAL column headers while loading', () => {
		// A skeleton carrying the real headers means nothing reflows when the
		// data lands. Five anonymous grey bars visibly jump.
		mocks.useListQuery.mockReturnValue(listResult({ isLoading: true }));
		render(<VolunteersPage />);

		expect(screen.getByText('Volunteer')).toBeInTheDocument();
		expect(screen.getByText('Added')).toBeInTheDocument();
		expect(screen.getByText('Shifts')).toBeInTheDocument();
		expect(screen.getByText('Status')).toBeInTheDocument();
	});

	it('renders QueryErrorCard on error, NOT an empty state', () => {
		// The failure this prevents: shifts/page.tsx never checks isError, so a
		// failed query renders as "you have no data" — a broken page that looks
		// correct. On a roster that is the worst possible confusion.
		mocks.useListQuery.mockReturnValue(
			listResult({ isError: true, error: { message: 'boom', data: null } }),
		);
		render(<VolunteersPage />);

		expect(screen.getByRole('alert')).toBeInTheDocument();
		expect(screen.queryByText('No volunteers yet')).not.toBeInTheDocument();
	});

	it('does not leak an internal error string to the user', () => {
		mocks.useListQuery.mockReturnValue(
			listResult({
				isError: true,
				error: {
					message: 'PrismaClientKnownRequestError: relation does not exist',
					data: { code: 'INTERNAL_SERVER_ERROR' },
				},
			}),
		);
		render(<VolunteersPage />);

		expect(screen.queryByText(/PrismaClient/)).not.toBeInTheDocument();
	});

	it('shows the true-empty state with the concierge offer', () => {
		render(<VolunteersPage />);

		expect(screen.getByText('No volunteers yet')).toBeInTheDocument();
		expect(screen.getByText(/Have a spreadsheet/)).toBeInTheDocument();
	});

	it('shows DIFFERENT copy for a filtered-empty result', async () => {
		// Conflating the two makes a working filter look like an empty roster.
		const { rerender } = render(<VolunteersPage />);
		const user = (await import('@testing-library/user-event')).default.setup();

		await user.type(screen.getByLabelText('Search volunteers'), 'zzz');
		rerender(<VolunteersPage />);

		expect(
			screen.getByText('No volunteers match that search.'),
		).toBeInTheDocument();
		expect(screen.queryByText('No volunteers yet')).not.toBeInTheDocument();
	});

	it('renders a roster row with name, email, shift count and status badge', () => {
		mocks.useListQuery.mockReturnValue(
			listResult({ data: { volunteers: [VOLUNTEER], nextCursor: null } }),
		);
		mocks.useCountQuery.mockReturnValue({ data: 1 });
		render(<VolunteersPage />);

		expect(screen.getByText('Maria Garcia')).toBeInTheDocument();
		expect(screen.getByText('maria@example.com')).toBeInTheDocument();
		expect(screen.getByText('12')).toBeInTheDocument();
		// The approved wording, not "Not activated" and not a raw enum.
		expect(screen.getByText('No account yet')).toBeInTheDocument();
	});

	it('renders no avatars', () => {
		// No table in this app has them; adding them here would be net-new
		// vocabulary for no informational gain.
		mocks.useListQuery.mockReturnValue(
			listResult({ data: { volunteers: [VOLUNTEER], nextCursor: null } }),
		);
		const { container } = render(<VolunteersPage />);
		expect(container.querySelector('img')).toBeNull();
	});

	it('shows Load more only when there is a next cursor', () => {
		mocks.useListQuery.mockReturnValue(
			listResult({ data: { volunteers: [VOLUNTEER], nextCursor: null } }),
		);
		const { rerender } = render(<VolunteersPage />);
		expect(screen.queryByText('Load more')).not.toBeInTheDocument();

		mocks.useListQuery.mockReturnValue(
			listResult({ data: { volunteers: [VOLUNTEER], nextCursor: 'ov-9' } }),
		);
		rerender(<VolunteersPage />);
		expect(screen.getByText('Load more')).toBeInTheDocument();
	});

	it('never renders numbered pagination', () => {
		// Offset pages silently skip or duplicate rows while a concierge import
		// is writing to the same table.
		mocks.useListQuery.mockReturnValue(
			listResult({ data: { volunteers: [VOLUNTEER], nextCursor: 'ov-9' } }),
		);
		render(<VolunteersPage />);
		expect(screen.queryByLabelText(/page \d/i)).not.toBeInTheDocument();
	});
});

describe('VolunteersPage concierge threshold', () => {
	it('keeps the offer visible while the roster is below the threshold', () => {
		// The org that types 3 names and stalls is exactly the org that needs it.
		mocks.useListQuery.mockReturnValue(
			listResult({ data: { volunteers: [VOLUNTEER], nextCursor: null } }),
		);
		mocks.useCountQuery.mockReturnValue({ data: 3 });
		render(<VolunteersPage />);

		expect(screen.getByText(/Have a spreadsheet/)).toBeInTheDocument();
	});

	it('hides the offer once the roster reaches the threshold', () => {
		mocks.useListQuery.mockReturnValue(
			listResult({ data: { volunteers: [VOLUNTEER], nextCursor: null } }),
		);
		mocks.useCountQuery.mockReturnValue({ data: 10 });
		render(<VolunteersPage />);

		expect(screen.queryByText(/Have a spreadsheet/)).not.toBeInTheDocument();
	});

	it('does not show the offer over an error state', () => {
		mocks.useListQuery.mockReturnValue(
			listResult({ isError: true, error: { message: 'x', data: null } }),
		);
		mocks.useCountQuery.mockReturnValue({ data: 0 });
		render(<VolunteersPage />);

		expect(screen.queryByText(/Have a spreadsheet/)).not.toBeInTheDocument();
	});
});
