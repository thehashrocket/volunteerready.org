// @vitest-environment jsdom

/**
 * The PAGE-level query error on /app/my-applications, as distinct from the
 * `ClaimableApplications` card covered in `claimable-applications.test.tsx`.
 *
 * This file exists because that split is exactly how the leak survived T35:
 * the card's two mutations were migrated to `safeErrorMessage`, the file
 * therefore imported it, and a grep for the importer reported the page as done
 * while `{query.error.message}` was still rendering above it — on a
 * volunteer-facing surface.
 */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
	mockMyApplications,
	mockClaimableApplications,
	mockClaimMutation,
	mockDeclineMutation,
	mockUseUtils,
} = vi.hoisted(() => ({
	mockMyApplications: vi.fn(),
	mockClaimableApplications: vi.fn(),
	mockClaimMutation: vi.fn(),
	mockDeclineMutation: vi.fn(),
	mockUseUtils: vi.fn(),
}));

vi.mock('@/lib/trpc/client', () => ({
	trpc: {
		screener: {
			myApplications: { useQuery: mockMyApplications },
			claimableApplications: { useQuery: mockClaimableApplications },
			claimApplication: { useMutation: mockClaimMutation },
			declineApplication: { useMutation: mockDeclineMutation },
		},
		useUtils: mockUseUtils,
	},
}));

import MyApplicationsPage from '../page';

function setup(error: { message: string; data?: { code?: string } }) {
	mockMyApplications.mockReturnValue({
		data: undefined,
		isLoading: false,
		isError: true,
		isFetching: false,
		error,
		refetch: vi.fn(),
	});
	// The claimable card fails silent by design; keep it out of the way.
	mockClaimableApplications.mockReturnValue({
		data: [],
		isLoading: false,
		isError: false,
	});
	mockClaimMutation.mockReturnValue({ mutate: vi.fn(), isPending: false });
	mockDeclineMutation.mockReturnValue({ mutate: vi.fn(), isPending: false });
	mockUseUtils.mockReturnValue({
		screener: {
			myApplications: { invalidate: vi.fn() },
			claimableApplications: { invalidate: vi.fn() },
		},
	});
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe('MyApplicationsPage error state', () => {
	it('SECURITY: shows generic copy, never the raw server text', () => {
		setup({
			message:
				'Invalid `prisma.volunteerApplication.findMany()` invocation: relation does not exist',
			data: { code: 'INTERNAL_SERVER_ERROR' },
		});

		render(<MyApplicationsPage />);

		expect(screen.queryByText(/prisma\./i)).not.toBeInTheDocument();
		expect(screen.getByRole('alert')).toHaveTextContent(
			'Something went wrong. Please try again.',
		);
	});

	it('renders the error, NOT the empty state, when the query failed', () => {
		// The ShiftsClient bug class: a failed load that falls through to "you
		// have nothing" answers a real question with a confident lie. A volunteer
		// checking whether they ever applied somewhere must not be told they
		// did not.
		setup({
			message: 'You are not signed in.',
			data: { code: 'UNAUTHORIZED' },
		});

		render(<MyApplicationsPage />);

		expect(screen.getByRole('alert')).toHaveTextContent(
			'You are not signed in.',
		);
		expect(screen.queryByText(/no applications yet/i)).not.toBeInTheDocument();
	});
});
