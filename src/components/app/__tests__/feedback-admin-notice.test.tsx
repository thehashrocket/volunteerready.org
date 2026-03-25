// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUseSession = vi.fn();
vi.mock('next-auth/react', () => ({
	useSession: () => mockUseSession(),
}));

const mockUseQuery = vi.fn();
vi.mock('@/lib/trpc/client', () => ({
	trpc: {
		feedback: {
			stats: {
				useQuery: (...args: unknown[]) => mockUseQuery(...args),
			},
		},
	},
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { FeedbackAdminNotice } from '../feedback-admin-notice';

describe('FeedbackAdminNotice', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns null when user is not platform admin', () => {
		mockUseSession.mockReturnValue({
			data: { user: { isPlatformAdmin: false } },
		});
		const { container } = render(<FeedbackAdminNotice />);
		expect(container.innerHTML).toBe('');
	});

	it('returns null when newCount is 0', () => {
		mockUseSession.mockReturnValue({
			data: { user: { isPlatformAdmin: true } },
		});
		mockUseQuery.mockReturnValue({
			data: { newCount: 0 },
			isLoading: false,
			isError: false,
		});
		const { container } = render(<FeedbackAdminNotice />);
		expect(container.innerHTML).toBe('');
	});

	it('renders "N new feedback items" link when count > 0', () => {
		mockUseSession.mockReturnValue({
			data: { user: { isPlatformAdmin: true } },
		});
		mockUseQuery.mockReturnValue({
			data: { newCount: 3 },
			isLoading: false,
			isError: false,
		});
		render(<FeedbackAdminNotice />);
		expect(screen.getByText(/3 new/)).toBeTruthy();
		expect(screen.getByText(/feedback items/)).toBeTruthy();
	});

	it('shows loading skeleton while fetching', () => {
		mockUseSession.mockReturnValue({
			data: { user: { isPlatformAdmin: true } },
		});
		mockUseQuery.mockReturnValue({
			data: undefined,
			isLoading: true,
			isError: false,
		});
		const { container } = render(<FeedbackAdminNotice />);
		// Skeleton renders a div with a specific height class
		expect(container.querySelector('.h-12')).toBeTruthy();
	});
});
