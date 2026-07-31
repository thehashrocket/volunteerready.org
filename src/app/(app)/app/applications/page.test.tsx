// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
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
