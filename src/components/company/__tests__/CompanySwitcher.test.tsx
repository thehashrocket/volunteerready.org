// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const {
	mockUsePathname,
	mockUseRouter,
	mockUseSession,
	mockListMyCompaniesQuery,
	mockSwitchCompanyMutation,
	mockUseQueryClient,
	mockRouterPush,
	mockRouterRefresh,
} = vi.hoisted(() => ({
	mockUsePathname: vi.fn(),
	mockUseRouter: vi.fn(),
	mockUseSession: vi.fn(),
	mockListMyCompaniesQuery: vi.fn(),
	mockSwitchCompanyMutation: vi.fn(),
	mockUseQueryClient: vi.fn(),
	mockRouterPush: vi.fn(),
	mockRouterRefresh: vi.fn(),
}));

vi.mock('next/navigation', () => ({
	usePathname: mockUsePathname,
	useRouter: mockUseRouter,
}));

vi.mock('next-auth/react', () => ({
	useSession: mockUseSession,
}));

vi.mock('@tanstack/react-query', () => ({
	useQueryClient: mockUseQueryClient,
}));

vi.mock('sonner', () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/trpc/client', () => ({
	trpc: {
		company: {
			listMyCompanies: { useQuery: mockListMyCompaniesQuery },
			switchCompany: { useMutation: mockSwitchCompanyMutation },
		},
	},
}));

import { CompanySwitcher } from '../CompanySwitcher';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MEMBERSHIPS = [
	{
		role: 'OWNER',
		company: { id: 'company-A', name: 'Company A', slug: 'a', planTier: 'PRO' },
	},
	{
		role: 'MEMBER',
		company: {
			id: 'company-B',
			name: 'Company B',
			slug: 'b',
			planTier: 'FREE',
		},
	},
];

// switchCompany.useMutation({onSuccess}) is captured here so tests can invoke
// onSuccess directly — exercising the routing decision without needing to
// drive the Radix dropdown open/click sequence through jsdom.
let capturedOnSuccess:
	| ((res: { companyId: string; role: string }) => void)
	| undefined;

beforeEach(() => {
	vi.clearAllMocks();
	mockUseRouter.mockReturnValue({
		push: mockRouterPush,
		refresh: mockRouterRefresh,
	});
	mockUseSession.mockReturnValue({ data: { currentCompanyId: 'company-A' } });
	mockUseQueryClient.mockReturnValue({ invalidateQueries: vi.fn() });
	mockListMyCompaniesQuery.mockReturnValue({
		data: MEMBERSHIPS,
		isLoading: false,
	});
	mockSwitchCompanyMutation.mockImplementation(
		(opts: {
			onSuccess: (res: { companyId: string; role: string }) => void;
		}) => {
			capturedOnSuccess = opts.onSuccess;
			return { mutate: vi.fn(), isPending: false };
		},
	);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CompanySwitcher — navigates to the new company URL on switch', () => {
	it('preserves the subpath when on a company subpage', () => {
		mockUsePathname.mockReturnValue('/app/company/company-A/esg');
		render(<CompanySwitcher />);

		capturedOnSuccess?.({ companyId: 'company-B', role: 'MEMBER' });

		expect(mockRouterPush).toHaveBeenCalledWith('/app/company/company-B/esg');
		expect(mockRouterRefresh).not.toHaveBeenCalled();
	});

	it('navigates on the bare company overview page (regression: previously fell through to refresh())', () => {
		mockUsePathname.mockReturnValue('/app/company/company-A');
		render(<CompanySwitcher />);

		capturedOnSuccess?.({ companyId: 'company-B', role: 'MEMBER' });

		expect(mockRouterPush).toHaveBeenCalledWith('/app/company/company-B');
		expect(mockRouterRefresh).not.toHaveBeenCalled();
	});

	it('falls back to a plain refresh when not on a company-scoped route', () => {
		mockUsePathname.mockReturnValue('/app');
		render(<CompanySwitcher />);

		capturedOnSuccess?.({ companyId: 'company-B', role: 'MEMBER' });

		expect(mockRouterRefresh).toHaveBeenCalledOnce();
		expect(mockRouterPush).not.toHaveBeenCalled();
	});

	it('treats /app/company/new as a non-company route, not a companyId (regression: "new" was matching the companyId capture group)', () => {
		mockUsePathname.mockReturnValue('/app/company/new');
		render(<CompanySwitcher />);

		capturedOnSuccess?.({ companyId: 'company-B', role: 'MEMBER' });

		expect(mockRouterRefresh).toHaveBeenCalledOnce();
		expect(mockRouterPush).not.toHaveBeenCalled();
	});
});

describe('CompanySwitcher — displayed selection follows the URL, not session state', () => {
	it('shows the URL company as selected even when a different company is session-active', () => {
		mockUseSession.mockReturnValue({ data: { currentCompanyId: 'company-A' } });
		mockUsePathname.mockReturnValue('/app/company/company-B/esg');
		render(<CompanySwitcher />);

		expect(screen.getByRole('button')).toHaveTextContent('Company B');
	});

	it('falls back to the session-active company off a company-scoped route', () => {
		mockUseSession.mockReturnValue({ data: { currentCompanyId: 'company-A' } });
		mockUsePathname.mockReturnValue('/app');
		render(<CompanySwitcher />);

		expect(screen.getByRole('button')).toHaveTextContent('Company A');
	});
});

describe('CompanySwitcher — zero-membership state', () => {
	it('links to /app/company/new with copy that reads as a distinct CSR-sponsor account, not "create my org"', () => {
		mockUsePathname.mockReturnValue('/app');
		mockListMyCompaniesQuery.mockReturnValue({ data: [], isLoading: false });
		render(<CompanySwitcher />);

		const link = screen.getByText('Add company sponsor');
		expect(link.closest('a')).toHaveAttribute('href', '/app/company/new');
	});
});
