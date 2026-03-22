// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
			getMyAppliedOpportunities: {
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
const { OpportunitiesListing } = await import('./OpportunitiesListing');

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
		...(overrides as Record<string, unknown>),
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OpportunitiesListing', () => {
	afterEach(() => {
		cleanup();
		mockUseQuery.mockClear();
	});

	it('renders "Apply now" button when user has NOT applied', () => {
		mockUseQuery.mockReturnValue({ data: {}, isLoading: false });

		render(
			<OpportunitiesListing org={ORG} opportunities={[makeOpp()] as never} />,
		);

		expect(screen.getByText('Apply now')).toBeInTheDocument();
		expect(screen.queryByText(/Applied/)).not.toBeInTheDocument();
	});

	it('renders "Applied — Pending" badge and "View My Application" link for SUBMITTED', () => {
		mockUseQuery.mockReturnValue({
			data: {
				'opp-1': {
					applicationId: 'app-1',
					status: 'SUBMITTED',
					submittedAt: new Date().toISOString(),
				},
			},
			isLoading: false,
		});

		render(
			<OpportunitiesListing org={ORG} opportunities={[makeOpp()] as never} />,
		);

		expect(screen.getByText('Applied — Pending')).toBeInTheDocument();
		expect(screen.getByText(/View My Application/)).toBeInTheDocument();
		expect(screen.queryByText('Apply now')).not.toBeInTheDocument();
	});

	it('renders "Applied — In Review" badge for REVIEW status', () => {
		mockUseQuery.mockReturnValue({
			data: {
				'opp-1': {
					applicationId: 'app-1',
					status: 'REVIEW',
					submittedAt: new Date().toISOString(),
				},
			},
			isLoading: false,
		});

		render(
			<OpportunitiesListing org={ORG} opportunities={[makeOpp()] as never} />,
		);

		expect(screen.getByText('Applied — In Review')).toBeInTheDocument();
	});

	it('renders "Applied — Approved" badge for APPROVED status', () => {
		mockUseQuery.mockReturnValue({
			data: {
				'opp-1': {
					applicationId: 'app-1',
					status: 'APPROVED',
					submittedAt: new Date().toISOString(),
				},
			},
			isLoading: false,
		});

		render(
			<OpportunitiesListing org={ORG} opportunities={[makeOpp()] as never} />,
		);

		expect(screen.getByText('Applied — Approved')).toBeInTheDocument();
	});

	it('links "View My Application" to the correct application detail page', () => {
		mockUseQuery.mockReturnValue({
			data: {
				'opp-1': {
					applicationId: 'app-42',
					status: 'SUBMITTED',
					submittedAt: new Date().toISOString(),
				},
			},
			isLoading: false,
		});

		render(
			<OpportunitiesListing org={ORG} opportunities={[makeOpp()] as never} />,
		);

		const link = screen.getByText(/View My Application/);
		expect(link.closest('a')).toHaveAttribute(
			'href',
			'/app/my-applications/app-42',
		);
	});

	it('disables the applied query when unauthenticated', () => {
		mockUseQuery.mockReturnValue({ data: undefined, isLoading: false });

		render(
			<OpportunitiesListing org={ORG} opportunities={[makeOpp()] as never} />,
		);

		// The query should be called with enabled: false since useSession returns unauthenticated
		expect(mockUseQuery).toHaveBeenCalledWith(
			expect.objectContaining({ orgId: 'org-1' }),
			expect.objectContaining({ enabled: false }),
		);
	});
});
