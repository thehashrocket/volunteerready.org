// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — no top-level variables inside vi.mock factories
// ---------------------------------------------------------------------------

vi.mock('@/lib/trpc/client', () => ({
	trpc: {
		feedback: {
			submit: {
				useMutation: vi.fn(() => ({
					mutate: vi.fn(),
					isPending: false,
				})),
			},
			myFeedback: {
				invalidate: vi.fn(),
			},
		},
		useUtils: vi.fn(() => ({
			feedback: {
				myFeedback: {
					invalidate: vi.fn(),
				},
			},
		})),
	},
}));

vi.mock('@/lib/hooks/use-media-query', () => ({
	useMediaQuery: vi.fn(() => true), // desktop mode
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
	globalThis.IntersectionObserver = class {
		observe() {}
		unobserve() {}
		disconnect() {}
	} as unknown as typeof IntersectionObserver;
});

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { FeedbackWidget } from '../feedback-widget';

describe('FeedbackWidget', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders pill with "Send feedback" text', () => {
		render(<FeedbackWidget />);
		expect(screen.getByText('Send feedback')).toBeTruthy();
	});

	it('opens dialog on pill click (desktop)', async () => {
		const user = userEvent.setup();
		render(<FeedbackWidget />);
		await user.click(screen.getByText('Send feedback'));
		expect(screen.getByText('Share feedback')).toBeTruthy();
	});

	it('shows mood selector with 5 options', async () => {
		const user = userEvent.setup();
		render(<FeedbackWidget />);
		await user.click(screen.getByText('Send feedback'));
		const radios = screen.getAllByRole('radio');
		expect(radios).toHaveLength(5);
	});

	it('shows textarea after selecting a mood', async () => {
		const user = userEvent.setup();
		render(<FeedbackWidget />);
		await user.click(screen.getByText('Send feedback'));
		await user.click(screen.getByLabelText('Great'));
		expect(screen.getByPlaceholderText('Tell us more...')).toBeTruthy();
	});

	it('submit button disabled when message is empty', async () => {
		const user = userEvent.setup();
		render(<FeedbackWidget />);
		await user.click(screen.getByText('Send feedback'));
		await user.click(screen.getByLabelText('Great'));
		// Find the submit button inside the dialog (not the pill)
		const buttons = screen
			.getAllByRole('button')
			.filter(
				(b) =>
					b.textContent === 'Send feedback' && b.closest('[role="dialog"]'),
			);
		expect(buttons.length).toBeGreaterThan(0);
		expect(buttons[0].hasAttribute('disabled')).toBe(true);
	});

	it('shows mood-aware success message after submit', async () => {
		const { trpc } = await import('@/lib/trpc/client');
		vi.mocked(trpc.feedback.submit.useMutation).mockImplementation(
			(opts: { onSuccess?: () => void } = {}) => {
				return {
					mutate: vi.fn(() => {
						opts.onSuccess?.();
					}),
					isPending: false,
				} as ReturnType<typeof trpc.feedback.submit.useMutation>;
			},
		);

		const user = userEvent.setup();
		render(<FeedbackWidget />);
		await user.click(screen.getByText('Send feedback'));
		await user.click(screen.getByLabelText('Great'));
		await user.type(screen.getByPlaceholderText('Tell us more...'), 'Awesome!');

		const buttons = screen
			.getAllByRole('button')
			.filter(
				(b) =>
					b.textContent === 'Send feedback' && b.closest('[role="dialog"]'),
			);
		await user.click(buttons[0]);

		expect(screen.getByText('That made our day — thank you!')).toBeTruthy();
	});

	it('auto-dismisses success after 2.5s', async () => {
		vi.useFakeTimers({ shouldAdvanceTime: true });

		const { trpc } = await import('@/lib/trpc/client');
		vi.mocked(trpc.feedback.submit.useMutation).mockImplementation(
			(opts: { onSuccess?: () => void } = {}) => {
				return {
					mutate: vi.fn(() => {
						opts.onSuccess?.();
					}),
					isPending: false,
				} as ReturnType<typeof trpc.feedback.submit.useMutation>;
			},
		);

		const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
		render(<FeedbackWidget />);
		await user.click(screen.getByText('Send feedback'));
		await user.click(screen.getByLabelText('Great'));
		await user.type(screen.getByPlaceholderText('Tell us more...'), 'Nice!');

		const buttons = screen
			.getAllByRole('button')
			.filter(
				(b) =>
					b.textContent === 'Send feedback' && b.closest('[role="dialog"]'),
			);
		await user.click(buttons[0]);

		expect(screen.getByText('That made our day — thank you!')).toBeTruthy();

		// Advance past the 2.5s auto-dismiss + 200ms reset
		await vi.advanceTimersByTimeAsync(3000);

		// After dismiss, the dialog should close — the success message should be gone
		expect(screen.queryByText('That made our day — thank you!')).toBeNull();

		vi.useRealTimers();
	});
});
