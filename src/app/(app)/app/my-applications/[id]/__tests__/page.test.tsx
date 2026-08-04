// @vitest-environment jsdom

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const {
	mockUseQuery,
	mockUseMutation,
	mockUseUtils,
	mockUseParams,
	mockUseRouter,
} = vi.hoisted(() => ({
	mockUseQuery: vi.fn(),
	mockUseMutation: vi.fn(),
	mockUseUtils: vi.fn(),
	mockUseParams: vi.fn(),
	mockUseRouter: vi.fn(),
}));

vi.mock('@/lib/trpc/client', () => ({
	trpc: {
		screener: {
			myApplicationDetail: { useQuery: mockUseQuery },
			withdrawApplication: { useMutation: mockUseMutation },
		},
		useUtils: mockUseUtils,
	},
}));

vi.mock('next/navigation', () => ({
	useParams: mockUseParams,
	useRouter: mockUseRouter,
}));

// Stub heavy components that aren't under test
vi.mock('@/components/my-applications/StatusTimeline', () => ({
	StatusTimeline: () => <div data-testid="status-timeline" />,
}));

import MyApplicationDetailPage from '../page';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeApplication(overrides: Record<string, unknown> = {}) {
	return {
		id: 'app-1',
		status: 'SUBMITTED',
		submittedAt: new Date('2026-01-15T10:00:00Z'),
		screeningStatus: 'PASS',
		screeningReasons: [],
		organization: { id: 'org-1', name: 'Test Org', slug: 'test-org' },
		answers: [],
		...overrides,
	};
}

function setupMocks({
	application = makeApplication(),
	mutate = vi.fn(),
	isPending = false,
	isError = false,
	error = null as { message: string } | null,
}: {
	application?: ReturnType<typeof makeApplication> | null;
	mutate?: ReturnType<typeof vi.fn>;
	isPending?: boolean;
	isError?: boolean;
	error?: { message: string } | null;
} = {}) {
	mockUseParams.mockReturnValue({ id: 'app-1' });
	mockUseRouter.mockReturnValue({ refresh: vi.fn() });

	const invalidate = vi.fn().mockResolvedValue(undefined);
	mockUseUtils.mockReturnValue({
		screener: {
			myApplications: { invalidate },
			myApplicationDetail: { invalidate },
		},
	});

	mockUseQuery.mockReturnValue({
		isLoading: false,
		isError: false,
		error: null,
		data: application,
	});

	mockUseMutation.mockReturnValue({
		mutate,
		isPending,
		isError,
		error,
	});

	return { mutate, invalidate };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MyApplicationDetailPage — withdraw button + dialog', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('shows Withdraw button for SUBMITTED application', () => {
		setupMocks({ application: makeApplication({ status: 'SUBMITTED' }) });
		render(<MyApplicationDetailPage />);
		expect(
			screen.getByRole('button', { name: /withdraw application/i }),
		).toBeInTheDocument();
	});

	it('shows Withdraw button for REVIEW application', () => {
		setupMocks({ application: makeApplication({ status: 'REVIEW' }) });
		render(<MyApplicationDetailPage />);
		expect(
			screen.getByRole('button', { name: /withdraw application/i }),
		).toBeInTheDocument();
	});

	it.each(['APPROVED', 'REJECTED', 'WITHDRAWN'])(
		'hides Withdraw button for %s application',
		(status) => {
			setupMocks({ application: makeApplication({ status }) });
			render(<MyApplicationDetailPage />);
			expect(
				screen.queryByRole('button', { name: /withdraw application/i }),
			).not.toBeInTheDocument();
		},
	);

	it('opens confirmation dialog on Withdraw button click', async () => {
		setupMocks();
		render(<MyApplicationDetailPage />);

		await userEvent.click(
			screen.getByRole('button', { name: /withdraw application/i }),
		);

		expect(
			screen.getByRole('dialog', { name: /withdraw this application/i }),
		).toBeInTheDocument();
		expect(screen.getByText(/marked as withdrawn/i)).toBeInTheDocument();
	});

	it('closes dialog on Cancel without calling mutate', async () => {
		const { mutate } = setupMocks();
		render(<MyApplicationDetailPage />);

		await userEvent.click(
			screen.getByRole('button', { name: /withdraw application/i }),
		);
		await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

		await waitFor(() =>
			expect(
				screen.queryByRole('dialog', { name: /withdraw this application/i }),
			).not.toBeInTheDocument(),
		);
		expect(mutate).not.toHaveBeenCalled();
	});

	it('calls withdrawApplication mutation on Confirm', async () => {
		const { mutate } = setupMocks();
		render(<MyApplicationDetailPage />);

		await userEvent.click(
			screen.getByRole('button', { name: /withdraw application/i }),
		);
		await userEvent.click(screen.getByRole('button', { name: /^withdraw$/i }));

		expect(mutate).toHaveBeenCalledWith({ id: 'app-1' });
	});

	it('shows an allowlisted refusal verbatim inside the dialog', async () => {
		setupMocks({
			isError: true,
			error: {
				message: 'This application can no longer be withdrawn.',
				data: { code: 'PRECONDITION_FAILED' },
			},
		});
		render(<MyApplicationDetailPage />);

		await userEvent.click(
			screen.getByRole('button', { name: /withdraw application/i }),
		);

		expect(
			screen.getByText('This application can no longer be withdrawn.'),
		).toBeInTheDocument();
	});

	it('SECURITY: shows generic copy for an internal error, never the raw text', async () => {
		// This surface is volunteer-facing. Delete the `safeErrorMessage` call in
		// page.tsx and this goes red — the Prisma string renders instead.
		setupMocks({
			isError: true,
			error: {
				message:
					'Invalid `prisma.volunteerApplication.update()` invocation: relation does not exist',
				data: { code: 'INTERNAL_SERVER_ERROR' },
			},
		});
		render(<MyApplicationDetailPage />);

		await userEvent.click(
			screen.getByRole('button', { name: /withdraw application/i }),
		);

		expect(screen.queryByText(/prisma\./i)).not.toBeInTheDocument();
		expect(screen.getByRole('alert')).toHaveTextContent(
			"We couldn't withdraw that application. Try again.",
		);
	});

	it('disables both buttons while mutation is pending', async () => {
		setupMocks({ isPending: true });
		render(<MyApplicationDetailPage />);

		await userEvent.click(
			screen.getByRole('button', { name: /withdraw application/i }),
		);

		expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
		expect(screen.getByRole('button', { name: /withdrawing/i })).toBeDisabled();
	});
});
