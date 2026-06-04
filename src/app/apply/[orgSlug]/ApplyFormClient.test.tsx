// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUseSession = vi.fn(() => ({
	data: { user: { id: 'user-1', email: 'test@example.com' } },
	status: 'authenticated',
}));

vi.mock('next-auth/react', () => ({
	useSession: (...args: unknown[]) => mockUseSession(...args),
}));

const mockDedupQuery = vi.fn(() => ({ data: null, isLoading: false }));
const mockAnonDedupQuery = vi.fn(() => ({ data: null, isLoading: false }));
const mockSubmitMutation = vi.fn(() => ({
	mutate: vi.fn(),
	isPending: false,
}));

vi.mock('@/lib/trpc/client', () => ({
	trpc: {
		screener: {
			checkExistingApplication: {
				useQuery: (...args: unknown[]) => mockDedupQuery(...args),
			},
			checkAnonymousApplication: {
				useQuery: (...args: unknown[]) => mockAnonDedupQuery(...args),
			},
			submit: {
				useMutation: (...args: unknown[]) => mockSubmitMutation(...args),
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

vi.mock('sonner', () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/format-date', () => ({
	formatDateRange: () => null,
}));

vi.mock('@/server/domain/screener/publicForm', () => ({
	buildZodSchema: () => {
		const { z } = require('zod');
		return z.object({});
	},
	buildDefaultValues: () => ({}),
	buildResponsesFromAnswers: () => [],
}));

vi.mock('@/server/domain/volunteer-screening', () => {
	const { z } = require('zod');
	return {
		volunteerProfileSchema: z.object({
			name: z.string(),
			email: z.string().email(),
			phone: z.string(),
			county: z.string(),
			availability: z.string(),
			experienceLevel: z.string(),
			notes: z.string().optional(),
		}),
	};
});

// Import after mocks
const { default: ApplyFormClient } = await import('./ApplyFormClient');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ORG = { id: 'org-1', name: 'Test Org', slug: 'test-org' };
const OPPORTUNITY = {
	id: 'opp-1',
	title: 'Park Cleanup',
	location: null,
	isRemote: false,
	startDate: null,
	endDate: null,
	commitmentHours: null,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ApplyFormClient', () => {
	afterEach(() => {
		cleanup();
		mockUseSession.mockClear();
		mockDedupQuery.mockClear();
		mockAnonDedupQuery.mockClear();
		mockSubmitMutation.mockClear();
	});

	describe('AlreadyAppliedCard (authenticated dedup interception)', () => {
		it('shows interception card when user has an existing application', () => {
			mockDedupQuery.mockReturnValue({
				data: {
					id: 'app-1',
					submittedAt: '2026-03-15T12:00:00Z',
				},
				isLoading: false,
			});

			render(
				<ApplyFormClient org={ORG} questions={[]} opportunity={OPPORTUNITY} />,
			);

			expect(
				screen.getByText("You're already on the list!"),
			).toBeInTheDocument();
			expect(screen.getByText(/Park Cleanup/)).toBeInTheDocument();
			expect(screen.getByText('View My Application')).toBeInTheDocument();
			expect(
				screen.getByText('Browse Other Opportunities'),
			).toBeInTheDocument();
		});

		it('links to the correct application detail page', () => {
			mockDedupQuery.mockReturnValue({
				data: {
					id: 'app-42',
					submittedAt: '2026-03-15T12:00:00Z',
				},
				isLoading: false,
			});

			render(
				<ApplyFormClient org={ORG} questions={[]} opportunity={OPPORTUNITY} />,
			);

			const viewLink = screen.getByText('View My Application');
			expect(viewLink.closest('a')).toHaveAttribute(
				'href',
				'/app/my-applications/app-42',
			);
		});

		it('links to org opportunities page for browsing', () => {
			mockDedupQuery.mockReturnValue({
				data: {
					id: 'app-1',
					submittedAt: '2026-03-15T12:00:00Z',
				},
				isLoading: false,
			});

			render(
				<ApplyFormClient org={ORG} questions={[]} opportunity={OPPORTUNITY} />,
			);

			const browseLink = screen.getByText('Browse Other Opportunities');
			expect(browseLink.closest('a')).toHaveAttribute(
				'href',
				'/opportunities/test-org',
			);
		});

		it('shows the form when no existing application exists', () => {
			mockDedupQuery.mockReturnValue({ data: null, isLoading: false });

			render(
				<ApplyFormClient org={ORG} questions={[]} opportunity={OPPORTUNITY} />,
			);

			expect(
				screen.queryByText("You're already on the list!"),
			).not.toBeInTheDocument();
			expect(screen.getByText('Volunteer application')).toBeInTheDocument();
		});
	});

	describe('source prop forwarding', () => {
		it('renders the form when source is DIRECT', () => {
			render(
				<ApplyFormClient
					org={ORG}
					questions={[]}
					opportunity={OPPORTUNITY}
					source="DIRECT"
				/>,
			);
			expect(screen.getByText('Volunteer application')).toBeInTheDocument();
		});

		it('renders the form when source is MARKETPLACE', () => {
			render(
				<ApplyFormClient
					org={ORG}
					questions={[]}
					opportunity={OPPORTUNITY}
					source="MARKETPLACE"
				/>,
			);
			expect(screen.getByText('Volunteer application')).toBeInTheDocument();
		});

		it('renders the form when source is undefined', () => {
			render(
				<ApplyFormClient
					org={ORG}
					questions={[]}
					opportunity={OPPORTUNITY}
					source={undefined}
				/>,
			);
			expect(screen.getByText('Volunteer application')).toBeInTheDocument();
		});

		it('accepts MARKETPLACE as a valid source prop', () => {
			render(
				<ApplyFormClient
					org={ORG}
					questions={[]}
					opportunity={OPPORTUNITY}
					source="MARKETPLACE"
				/>,
			);

			expect(screen.getByText('Volunteer application')).toBeInTheDocument();
		});
	});

	describe('Anonymous email soft-block', () => {
		it('shows warning when anonymous email already has an application', () => {
			// Unauthenticated user
			mockUseSession.mockReturnValue({
				data: null,
				status: 'unauthenticated',
			});
			mockDedupQuery.mockReturnValue({ data: null, isLoading: false });
			mockAnonDedupQuery.mockReturnValue({
				data: { exists: true },
				isLoading: false,
			});

			render(
				<ApplyFormClient org={ORG} questions={[]} opportunity={OPPORTUNITY} />,
			);

			expect(
				screen.getByText(/already exists for this opportunity/),
			).toBeInTheDocument();
			expect(
				screen.getByText('Check your application status'),
			).toBeInTheDocument();
		});

		it('does not show warning when anonymous check returns null', () => {
			mockUseSession.mockReturnValue({
				data: null,
				status: 'unauthenticated',
			});
			mockDedupQuery.mockReturnValue({ data: null, isLoading: false });
			mockAnonDedupQuery.mockReturnValue({
				data: null,
				isLoading: false,
			});

			render(
				<ApplyFormClient org={ORG} questions={[]} opportunity={OPPORTUNITY} />,
			);

			expect(
				screen.queryByText(/already exists for this opportunity/),
			).not.toBeInTheDocument();
		});

		it('links to /apply/status from the warning', () => {
			mockUseSession.mockReturnValue({
				data: null,
				status: 'unauthenticated',
			});
			mockDedupQuery.mockReturnValue({ data: null, isLoading: false });
			mockAnonDedupQuery.mockReturnValue({
				data: { exists: true },
				isLoading: false,
			});

			render(
				<ApplyFormClient org={ORG} questions={[]} opportunity={OPPORTUNITY} />,
			);

			const statusLink = screen.getByText('Check your application status');
			expect(statusLink.closest('a')).toHaveAttribute('href', '/apply/status');
		});
	});
});
