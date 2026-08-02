// @vitest-environment jsdom

/**
 * `/credentials/claim/[token]` is PUBLIC — reachable by anyone holding (or
 * guessing) a token, with no session behind it. It rendered
 * `{infoQuery.error.message}` raw from launch, so an unhandled throw inside
 * `getTokenInfo` put the Prisma text on an unauthenticated page.
 *
 * The server-side `errorFormatter` now redacts that before it is serialized;
 * these pin the client half, which is what decides whether the message was
 * written for this reader at all.
 */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetTokenInfo, mockClaim } = vi.hoisted(() => ({
	mockGetTokenInfo: vi.fn(),
	mockClaim: vi.fn(),
}));

vi.mock('@/lib/trpc/client', () => ({
	trpc: {
		credentialSharing: {
			getTokenInfo: { useQuery: mockGetTokenInfo },
			claim: { useMutation: mockClaim },
		},
	},
}));

import ClaimClient from './ClaimClient';

function setup(error: { message: string; data?: { code?: string } }) {
	mockGetTokenInfo.mockReturnValue({
		data: undefined,
		isLoading: false,
		isError: true,
		isFetching: false,
		error,
		refetch: vi.fn(),
	});
	mockClaim.mockReturnValue({ mutate: vi.fn(), isPending: false });
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe('ClaimClient error state', () => {
	it('SECURITY: never renders an internal error string on a public page', () => {
		setup({
			message:
				'Invalid `prisma.volunteerCredential.findFirst()` invocation: relation does not exist',
			data: { code: 'INTERNAL_SERVER_ERROR' },
		});

		render(<ClaimClient token="tok_1" />);

		expect(screen.queryByText(/prisma\./i)).not.toBeInTheDocument();
		expect(screen.getByRole('alert')).toHaveTextContent(
			"We couldn't check that link right now.",
		);
	});

	it('shows the real reason for an allowlisted refusal', () => {
		// Contrast case. Without it the assertion above would pass just as well
		// against a page that had stopped saying anything at all — and "this link
		// expired" is the only actionable thing this page can tell someone.
		setup({
			message: 'This share link has expired.',
			data: { code: 'NOT_FOUND' },
		});

		render(<ClaimClient token="tok_1" />);

		expect(screen.getByRole('alert')).toHaveTextContent(
			'This share link has expired.',
		);
	});
});
