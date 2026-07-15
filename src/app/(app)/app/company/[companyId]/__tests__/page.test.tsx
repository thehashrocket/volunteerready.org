// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const {
	mockCurrentUseQuery,
	mockLinkedUseQuery,
	mockInviteUseMutation,
	mockLinkUseMutation,
	mockUnlinkUseMutation,
	mockInviteMutate,
	mockLinkMutate,
	mockUnlinkMutate,
} = vi.hoisted(() => ({
	mockCurrentUseQuery: vi.fn(),
	mockLinkedUseQuery: vi.fn(),
	mockInviteUseMutation: vi.fn(),
	mockLinkUseMutation: vi.fn(),
	mockUnlinkUseMutation: vi.fn(),
	mockInviteMutate: vi.fn(),
	mockLinkMutate: vi.fn(),
	mockUnlinkMutate: vi.fn(),
}));

vi.mock('@/lib/trpc/client', () => ({
	trpc: {
		company: {
			getCurrent: { useQuery: mockCurrentUseQuery },
			listLinkedNonprofits: { useQuery: mockLinkedUseQuery },
			invite: { useMutation: mockInviteUseMutation },
			linkNonprofit: { useMutation: mockLinkUseMutation },
			unlinkNonprofit: { useMutation: mockUnlinkUseMutation },
		},
	},
}));

vi.mock('next/navigation', () => ({
	useParams: () => ({ companyId: 'company-1' }),
}));

vi.mock('sonner', () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

import CompanyDashboardPage from '../page';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type QueryState = {
	data?: unknown;
	isLoading?: boolean;
	isError?: boolean;
	isRefetching?: boolean;
	error?: { message: string; data?: { code?: string } | null } | null;
	refetch?: ReturnType<typeof vi.fn>;
};

function queryResult({
	data = undefined,
	isLoading = false,
	isError = false,
	isRefetching = false,
	error = null,
	refetch = vi.fn(),
}: QueryState = {}) {
	return { data, isLoading, isError, isRefetching, error, refetch };
}

function setupMocks({
	current = queryResult({
		data: { id: 'company-1', name: 'Acme Corp', planTier: 'PRO' },
	}),
	linked = queryResult({
		data: [
			{
				id: 'link-1',
				org: { id: 'org-1', name: 'Helping Hands', slug: 'helping-hands' },
			},
		],
	}),
}: {
	current?: ReturnType<typeof queryResult>;
	linked?: ReturnType<typeof queryResult>;
} = {}) {
	mockCurrentUseQuery.mockReturnValue(current);
	mockLinkedUseQuery.mockReturnValue(linked);
	mockInviteUseMutation.mockReturnValue({
		mutate: mockInviteMutate,
		isPending: false,
	});
	mockLinkUseMutation.mockReturnValue({
		mutate: mockLinkMutate,
		isPending: false,
	});
	mockUnlinkUseMutation.mockReturnValue({
		mutate: mockUnlinkMutate,
		isPending: false,
	});
}

beforeEach(() => {
	vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CompanyDashboardPage — company scoping', () => {
	it('queries company data and linked nonprofits using the URL companyId, not session state', () => {
		setupMocks();
		render(<CompanyDashboardPage />);

		expect(mockCurrentUseQuery).toHaveBeenCalledWith({
			companyId: 'company-1',
		});
		expect(mockLinkedUseQuery).toHaveBeenCalledWith({ companyId: 'company-1' });
	});

	it('renders the URL company name and plan badge', () => {
		setupMocks({
			current: queryResult({
				data: { id: 'company-1', name: 'Acme Corp', planTier: 'PRO' },
			}),
		});
		render(<CompanyDashboardPage />);

		expect(screen.getByText('Acme Corp')).toBeInTheDocument();
		expect(screen.getByText('PRO')).toBeInTheDocument();
	});

	it('shows the empty state when no nonprofits are linked', () => {
		setupMocks({ linked: queryResult({ data: [] }) });
		render(<CompanyDashboardPage />);

		expect(screen.getByText(/no nonprofits linked yet/i)).toBeInTheDocument();
	});

	it('renders each linked nonprofit', () => {
		setupMocks();
		render(<CompanyDashboardPage />);

		expect(screen.getByText('Helping Hands')).toBeInTheDocument();
		expect(screen.getByText('helping-hands')).toBeInTheDocument();
	});
});

describe('CompanyDashboardPage — company query states', () => {
	it('renders skeletons while the company is loading', () => {
		setupMocks({ current: queryResult({ isLoading: true }) });
		const { container } = render(<CompanyDashboardPage />);

		expect(container.querySelectorAll('.h-9, .h-40')).not.toHaveLength(0);
		expect(screen.queryByText('Acme Corp')).not.toBeInTheDocument();
	});

	it('renders an error card instead of a blank dashboard with live forms when the company query fails', () => {
		setupMocks({
			current: queryResult({
				isError: true,
				error: {
					message: 'boom: company fetch failed',
					data: { code: 'FORBIDDEN' },
				},
			}),
		});
		render(<CompanyDashboardPage />);

		expect(screen.getByText(/couldn’t load your company/i)).toBeInTheDocument();
		expect(screen.getByText('boom: company fetch failed')).toBeInTheDocument();
		expect(
			screen.queryByRole('button', { name: /invite member/i }),
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole('button', { name: /link nonprofit/i }),
		).not.toBeInTheDocument();
	});

	it('retry button refetches the company query', async () => {
		const refetch = vi.fn();
		setupMocks({
			current: queryResult({ isError: true, error: { message: 'x' }, refetch }),
		});
		render(<CompanyDashboardPage />);

		await userEvent.click(screen.getByRole('button', { name: /try again/i }));
		expect(refetch).toHaveBeenCalledOnce();
	});

	it('renders an error card for linked nonprofits without hiding the rest of the page', () => {
		setupMocks({
			linked: queryResult({
				isError: true,
				error: {
					message: 'boom: linked fetch failed',
					data: { code: 'FORBIDDEN' },
				},
			}),
		});
		render(<CompanyDashboardPage />);

		// Company header still rendered — only the linked-nonprofits section failed
		expect(screen.getByText('Acme Corp')).toBeInTheDocument();
		expect(
			screen.getByText(/couldn’t load linked nonprofits/i),
		).toBeInTheDocument();
		expect(screen.getByText('boom: linked fetch failed')).toBeInTheDocument();
		expect(
			screen.queryByText(/no nonprofits linked yet/i),
		).not.toBeInTheDocument();
	});
});

describe('CompanyDashboardPage — mutations carry the URL companyId', () => {
	it('unlinking a nonprofit passes the URL companyId, not a session-derived one', async () => {
		setupMocks();
		render(<CompanyDashboardPage />);

		await userEvent.click(screen.getByRole('button', { name: /unlink/i }));

		expect(mockUnlinkMutate).toHaveBeenCalledWith({
			companyId: 'company-1',
			orgId: 'org-1',
		});
	});

	it('linking a nonprofit passes the URL companyId and the entered orgId', async () => {
		setupMocks();
		render(<CompanyDashboardPage />);

		await userEvent.click(
			screen.getByRole('button', { name: /link nonprofit/i }),
		);
		await userEvent.type(screen.getByLabelText(/organization id/i), 'org-2');
		await userEvent.click(screen.getByRole('button', { name: /^link$/i }));

		expect(mockLinkMutate).toHaveBeenCalledWith({
			companyId: 'company-1',
			orgId: 'org-2',
		});
	});

	it('inviting a member passes the URL companyId and the entered email', async () => {
		setupMocks();
		render(<CompanyDashboardPage />);

		await userEvent.click(
			screen.getByRole('button', { name: /invite member/i }),
		);
		await userEvent.type(
			screen.getByLabelText(/email address/i),
			'newmember@example.com',
		);
		await userEvent.click(
			screen.getByRole('button', { name: /send invitation/i }),
		);

		expect(mockInviteMutate).toHaveBeenCalledWith({
			companyId: 'company-1',
			email: 'newmember@example.com',
			role: 'MEMBER',
		});
	});

	it('disables the link button until an org id is entered', async () => {
		setupMocks();
		render(<CompanyDashboardPage />);

		await userEvent.click(
			screen.getByRole('button', { name: /link nonprofit/i }),
		);

		expect(screen.getByRole('button', { name: /^link$/i })).toBeDisabled();
	});
});
