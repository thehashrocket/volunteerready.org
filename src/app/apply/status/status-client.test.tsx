// @vitest-environment jsdom

/**
 * `/apply/status` is PUBLIC — a volunteer follows a one-time emailed link, with
 * no account and no session. It rendered `{statusQ.error.message}` raw, so an
 * unhandled throw in `status.getByToken` reached an unauthenticated stranger.
 *
 * The page deliberately does NOT use QueryErrorCard: a status link genuinely
 * expires, so the answer is the request form beneath it, not a retry button.
 * That makes the message the only thing telling the reader what happened, which
 * is why it is worth pinning on both branches.
 */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRequestLink, mockGetByToken } = vi.hoisted(() => ({
	mockRequestLink: vi.fn(),
	mockGetByToken: vi.fn(),
}));

vi.mock('@/lib/trpc/client', () => ({
	trpc: {
		status: {
			requestLink: { useMutation: mockRequestLink },
			getByToken: { useQuery: mockGetByToken },
		},
	},
}));

import StatusClient from './status-client';

function setup(error: { message: string; data?: { code?: string } }) {
	mockGetByToken.mockReturnValue({
		data: undefined,
		isLoading: false,
		isError: true,
		isFetching: false,
		error,
		refetch: vi.fn(),
	});
	mockRequestLink.mockReturnValue({ mutate: vi.fn(), isPending: false });
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe('StatusClient link-issue state', () => {
	it('SECURITY: never renders an internal error string on a public page', () => {
		setup({
			message:
				'Invalid `prisma.volunteerApplication.findMany()` invocation: column does not exist',
			data: { code: 'INTERNAL_SERVER_ERROR' },
		});

		render(<StatusClient token="tok_1" />);

		expect(screen.queryByText(/prisma\./i)).not.toBeInTheDocument();
		expect(
			screen.getByText("We couldn't check that link. Please try again."),
		).toBeInTheDocument();
	});

	it('keeps the request form reachable so a failure is not a dead end', () => {
		// The recovery path matters more than the message here — whatever went
		// wrong, this person still needs a working link.
		setup({
			message: 'That link has expired.',
			data: { code: 'BAD_REQUEST' },
		});

		render(<StatusClient token="tok_1" />);

		expect(screen.getByText('That link has expired.')).toBeInTheDocument();
		expect(
			screen.getByRole('button', { name: /send link/i }),
		).toBeInTheDocument();
	});
});
