// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MatchResult } from '@/server/domain/volunteer-matching';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('next-auth/react', () => ({
	useSession: () => ({ data: null, status: 'unauthenticated' }),
}));

const mockUseQuery = vi.fn(() => ({ data: undefined, isLoading: false }));
vi.mock('@/lib/trpc/client', () => ({
	trpc: {
		screener: {
			getMyAppliedOpportunitiesCrossOrg: {
				useQuery: (...args: unknown[]) => mockUseQuery(...args),
			},
		},
	},
}));

vi.mock('next/link', () => ({
	default: ({
		children,
		href,
	}: {
		children: React.ReactNode;
		href: string;
	}) => <a href={href}>{children}</a>,
}));

vi.mock('@/lib/format-date', () => ({
	formatDateRange: () => null,
}));

// Import after mocks
const { BrowseOpportunities } = await import('./BrowseOpportunities');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ORG = { id: 'org-1', name: 'Test Org', slug: 'test-org' };

function makeOpp(overrides: Partial<Record<string, unknown>> = {}) {
	return {
		id: overrides.id ?? 'opp-1',
		title: overrides.title ?? 'Park Cleanup',
		description: overrides.description ?? 'Help clean the park',
		location: overrides.location ?? null,
		isRemote: overrides.isRemote ?? false,
		startDate: null,
		endDate: null,
		commitmentHours: null,
		capacity: null,
		tags: (overrides.tags as { id: string; name: string }[]) ?? [],
		requirements: [],
		organization: overrides.organization ?? ORG,
		...(overrides as Record<string, unknown>),
	};
}

function makeMatch(overrides: Partial<MatchResult> = {}): MatchResult {
	return {
		opportunityId: overrides.opportunityId ?? 'opp-1',
		score: overrides.score ?? 100,
		matchType: overrides.matchType ?? 'PERFECT',
		matchedRequired: overrides.matchedRequired ?? [],
		missingRequired: overrides.missingRequired ?? [],
		matchedPreferred: overrides.matchedPreferred ?? [],
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BrowseOpportunities', () => {
	afterEach(() => {
		cleanup();
		mockUseQuery.mockClear();
	});

	it('renders "Apply now" button when user has NOT applied', () => {
		mockUseQuery.mockReturnValue({ data: {}, isLoading: false });

		render(<BrowseOpportunities opportunities={[makeOpp()] as never} />);

		expect(screen.getByText('Apply now')).toBeInTheDocument();
		expect(screen.queryByText(/Applied/)).not.toBeInTheDocument();
	});

	it('disables the cross-org applied query when unauthenticated', () => {
		mockUseQuery.mockReturnValue({ data: undefined, isLoading: false });

		render(<BrowseOpportunities opportunities={[makeOpp()] as never} />);

		expect(mockUseQuery).toHaveBeenCalledWith(
			expect.objectContaining({ opportunityIds: ['opp-1'] }),
			expect.objectContaining({ enabled: false }),
		);
	});

	it('hides opportunities missing a required qualification by default', () => {
		mockUseQuery.mockReturnValue({ data: {}, isLoading: false });

		const qualified = makeOpp({ id: 'opp-1', title: 'Qualified Opp' });
		const unqualified = makeOpp({ id: 'opp-2', title: 'Unqualified Opp' });

		render(
			<BrowseOpportunities
				opportunities={[qualified, unqualified] as never}
				matchResults={{
					'opp-1': makeMatch({ opportunityId: 'opp-1' }),
					'opp-2': makeMatch({
						opportunityId: 'opp-2',
						score: 0,
						matchType: 'NONE',
						missingRequired: ['First Aid'],
					}),
				}}
			/>,
		);

		expect(screen.getByText('Qualified Opp')).toBeInTheDocument();
		expect(screen.queryByText('Unqualified Opp')).not.toBeInTheDocument();
	});

	it('reveals unqualified opportunities when the "show unqualified" toggle is checked', () => {
		mockUseQuery.mockReturnValue({ data: {}, isLoading: false });

		const qualified = makeOpp({ id: 'opp-1', title: 'Qualified Opp' });
		const unqualified = makeOpp({ id: 'opp-2', title: 'Unqualified Opp' });

		render(
			<BrowseOpportunities
				opportunities={[qualified, unqualified] as never}
				matchResults={{
					'opp-1': makeMatch({ opportunityId: 'opp-1' }),
					'opp-2': makeMatch({
						opportunityId: 'opp-2',
						score: 0,
						matchType: 'NONE',
						missingRequired: ['First Aid'],
					}),
				}}
			/>,
		);

		fireEvent.click(screen.getByLabelText(/not qualified for/i));

		expect(screen.getByText('Qualified Opp')).toBeInTheDocument();
		expect(screen.getByText('Unqualified Opp')).toBeInTheDocument();
	});

	it('does not filter opportunities when no matchResults are provided', () => {
		mockUseQuery.mockReturnValue({ data: {}, isLoading: false });

		const oppA = makeOpp({ id: 'opp-1', title: 'Opp A' });
		const oppB = makeOpp({ id: 'opp-2', title: 'Opp B' });

		render(<BrowseOpportunities opportunities={[oppA, oppB] as never} />);

		expect(screen.getByText('Opp A')).toBeInTheDocument();
		expect(screen.getByText('Opp B')).toBeInTheDocument();
		expect(
			screen.queryByLabelText(/not qualified for/i),
		).not.toBeInTheDocument();
	});

	it('offers a direct escape hatch instead of a dead-end "Clear filters" when the qualification filter empties the list', () => {
		mockUseQuery.mockReturnValue({ data: {}, isLoading: false });

		const unqualified = makeOpp({ id: 'opp-1', title: 'Unqualified Opp' });

		render(
			<BrowseOpportunities
				opportunities={[unqualified] as never}
				matchResults={{
					'opp-1': makeMatch({
						opportunityId: 'opp-1',
						score: 0,
						matchType: 'NONE',
						missingRequired: ['First Aid'],
					}),
				}}
			/>,
		);

		expect(
			screen.getByText('No opportunities match your skills right now.'),
		).toBeInTheDocument();

		const revealButton = screen.getByRole('button', {
			name: /show opportunities i'm not qualified for/i,
		});
		fireEvent.click(revealButton);

		expect(screen.getByText('Unqualified Opp')).toBeInTheDocument();
	});

	it('shows the plain "Clear filters" message when an explicit filter (not qualification) empties the list', () => {
		mockUseQuery.mockReturnValue({ data: {}, isLoading: false });

		render(
			<BrowseOpportunities
				opportunities={[makeOpp({ title: 'Only Opp' })] as never}
			/>,
		);

		fireEvent.change(
			screen.getByPlaceholderText('Search opportunities, organizations...'),
			{ target: { value: 'no-match-for-this-query' } },
		);

		expect(
			screen.getByText('No opportunities match your filters.'),
		).toBeInTheDocument();
		expect(
			screen.queryByText(/show opportunities i'm not qualified for/i),
		).not.toBeInTheDocument();

		fireEvent.click(screen.getAllByText('Clear filters')[0]);
		expect(screen.getByText('Only Opp')).toBeInTheDocument();
	});
});
