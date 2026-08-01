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

// ---------------------------------------------------------------------------
// Width discipline (app-shell overflow fix)
//
// jsdom evaluates no media query and has no layout, so these assert the CLASS
// STRINGS rather than rendered widths — the same technique the roster's
// dual-tree tests use, and the only evidence available here. The rendered
// consequence is covered by the 800px e2e in `staff-tables-mobile.spec.ts`.
//
// These exist because every one of these caps was revertible with the whole
// suite green: removing them does not overflow the DOCUMENT (the left cluster
// now shrinks), it squeezes the switchers to bare ellipses, which no assertion
// was watching.
// ---------------------------------------------------------------------------

describe('CompanySwitcher — width discipline', () => {
	it('hides the zero-membership link below sm', () => {
		// The only one of the four states with no width constraint of its own —
		// plain text, so it neither truncates nor shrinks — and it is the state
		// most users are in. At 375px it was pushing the account button off the
		// right edge.
		mockUsePathname.mockReturnValue('/app');
		mockListMyCompaniesQuery.mockReturnValue({ data: [], isLoading: false });
		render(<CompanySwitcher />);

		const link = screen.getByText('Add company sponsor');
		expect(link).toHaveClass('hidden', 'sm:inline', 'whitespace-nowrap');
	});

	it('caps and truncates the single-membership name, tightest at the base width', () => {
		mockUsePathname.mockReturnValue('/app');
		mockListMyCompaniesQuery.mockReturnValue({
			data: [MEMBERSHIPS[0]],
			isLoading: false,
		});
		render(<CompanySwitcher />);

		const label = screen.getByText('Company A');
		expect(label).toHaveClass('truncate', 'max-w-24', 'sm:max-w-36');
	});

	it('lets the multi-membership trigger SHRINK, overriding Button’s base shrink-0', () => {
		// `Button` is `shrink-0` by default. Without the explicit `shrink` the
		// trigger cannot give up width, so `min-w-0` on the parent cluster buys
		// nothing in the tablet band — the widest state in the header.
		mockUsePathname.mockReturnValue('/app');
		render(<CompanySwitcher />);

		expect(screen.getByRole('button')).toHaveClass('shrink', 'max-w-[110px]');
	});
});
