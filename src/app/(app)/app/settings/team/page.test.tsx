// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ useListQuery: vi.fn() }));

// Only `members.list` drives the branch under test; a Proxy keeps the rest
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
								router === 'members' && proc === 'list'
									? { useQuery: mocks.useListQuery }
									: inert,
						},
					);
				},
			},
		),
	};
});

vi.mock('next-auth/react', () => ({
	useSession: () => ({ data: { user: { email: 'staff@example.org' } } }),
}));
vi.mock('@tanstack/react-query', async () => {
	const actual = await vi.importActual<typeof import('@tanstack/react-query')>(
		'@tanstack/react-query',
	);
	return { ...actual, useQueryClient: () => ({ invalidateQueries: vi.fn() }) };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import TeamPage from './page';

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
describe('TeamPage error state', () => {
	it('SECURITY: does not render an internal error string verbatim', () => {
		mocks.useListQuery.mockReturnValue({
			data: undefined,
			isLoading: false,
			isError: true,
			isFetching: false,
			error: {
				message: 'Invalid `prisma.organizationMember.findMany()` invocation',
				data: { code: 'INTERNAL_SERVER_ERROR' },
			},
			refetch: vi.fn(),
		});

		render(<TeamPage />);

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

		render(<TeamPage />);

		expect(screen.getByRole('alert')).toHaveTextContent(
			'You do not have access to this organisation.',
		);
		expect(screen.queryByText('No members yet')).not.toBeInTheDocument();
	});
});
