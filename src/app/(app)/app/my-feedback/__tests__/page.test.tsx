// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUseQuery = vi.fn();

vi.mock('@/lib/trpc/client', () => ({
	trpc: {
		feedback: {
			myFeedback: {
				useQuery: () => mockUseQuery(),
			},
		},
	},
}));

// ---------------------------------------------------------------------------
// Polyfills for jsdom
// ---------------------------------------------------------------------------

beforeAll(() => {
	Object.defineProperty(window, 'matchMedia', {
		writable: true,
		value: (query: string) => ({
			matches: false,
			media: query,
			onchange: null,
			addListener: () => {},
			removeListener: () => {},
			addEventListener: () => {},
			removeEventListener: () => {},
			dispatchEvent: () => false,
		}),
	});
});

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import MyFeedbackPage from '../page';

const makeFeedbackItem = (overrides = {}) => ({
	id: 'fb-1',
	mood: 'HAPPY' as const,
	message: 'This is great!',
	pageName: 'Dashboard',
	status: 'NEW' as const,
	createdAt: new Date(),
	replyMessage: null,
	repliedAt: null,
	...overrides,
});

describe('MyFeedbackPage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders feedback items list', () => {
		mockUseQuery.mockReturnValue({
			data: [
				makeFeedbackItem(),
				makeFeedbackItem({ id: 'fb-2', message: 'Second item' }),
			],
			isLoading: false,
			isError: false,
			refetch: vi.fn(),
		});
		render(<MyFeedbackPage />);
		expect(screen.getByText('This is great!')).toBeTruthy();
		expect(screen.getByText('Second item')).toBeTruthy();
	});

	it('expand item shows full message and admin reply', async () => {
		const user = userEvent.setup();
		mockUseQuery.mockReturnValue({
			data: [
				makeFeedbackItem({
					replyMessage: 'Thanks for the kind words!',
					repliedAt: new Date(),
				}),
			],
			isLoading: false,
			isError: false,
			refetch: vi.fn(),
		});
		render(<MyFeedbackPage />);

		// Click to expand
		const expandButton = screen.getByRole('button', { name: /this is great/i });
		await user.click(expandButton);

		// Admin reply should be visible
		expect(screen.getByText('Thanks for the kind words!')).toBeTruthy();
	});

	it('empty state shows "No feedback yet"', () => {
		mockUseQuery.mockReturnValue({
			data: [],
			isLoading: false,
			isError: false,
			refetch: vi.fn(),
		});
		render(<MyFeedbackPage />);
		expect(screen.getByText('No feedback yet')).toBeTruthy();
	});

	it('status badges render with volunteer-friendly labels', () => {
		mockUseQuery.mockReturnValue({
			data: [
				makeFeedbackItem({ id: 'fb-new', status: 'NEW' }),
				makeFeedbackItem({
					id: 'fb-progress',
					status: 'IN_PROGRESS',
					message: 'Being reviewed msg',
				}),
				makeFeedbackItem({
					id: 'fb-resolved',
					status: 'RESOLVED',
					message: 'Resolved msg',
				}),
				makeFeedbackItem({
					id: 'fb-dismissed',
					status: 'DISMISSED',
					message: 'Noted msg',
				}),
			],
			isLoading: false,
			isError: false,
			refetch: vi.fn(),
		});
		render(<MyFeedbackPage />);
		expect(screen.getByText('Received')).toBeTruthy();
		expect(screen.getByText('Being reviewed')).toBeTruthy();
		expect(screen.getByText('We took action')).toBeTruthy();
		expect(screen.getByText('Noted')).toBeTruthy();
	});
});
