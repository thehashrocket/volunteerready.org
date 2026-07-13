// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockCompanyUseQuery, mockEsgUseQuery } = vi.hoisted(() => ({
	mockCompanyUseQuery: vi.fn(),
	mockEsgUseQuery: vi.fn(),
}));

vi.mock('@/lib/trpc/client', () => ({
	trpc: {
		company: {
			getCurrent: { useQuery: mockCompanyUseQuery },
		},
		esgReport: {
			getSummary: { useQuery: mockEsgUseQuery },
		},
	},
}));

import ESGTeamDashboardPage from '../page';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSummary(overrides: Record<string, unknown> = {}) {
	return {
		companyId: 'company-1',
		companyName: 'Acme Corporation',
		generatedAt: new Date('2026-07-01T00:00:00Z'),
		dateRange: { from: null, to: null },
		totalEmployeesActive: 12,
		totalOrgsSupported: 2,
		totalShifts: 34,
		totalHours: 85.5,
		totalVerifiedCredentials: 7,
		rows: [
			{
				orgId: 'org-1',
				orgName: 'Helping Hands',
				employeeCount: 8,
				shiftCount: 20,
				totalHours: 50,
				verifiedCredentialCount: 4,
			},
		],
		...overrides,
	};
}

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
	company = queryResult({
		data: { id: 'company-1', name: 'Acme Corporation', planTier: 'PRO' },
	}),
	esg = queryResult({ data: makeSummary() }),
}: {
	company?: ReturnType<typeof queryResult>;
	esg?: ReturnType<typeof queryResult>;
} = {}) {
	mockCompanyUseQuery.mockReturnValue(company);
	mockEsgUseQuery.mockReturnValue(esg);
}

beforeEach(() => {
	vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ESGTeamDashboardPage — company query states', () => {
	it('renders skeletons while the company is loading', () => {
		setupMocks({ company: queryResult({ isLoading: true }) });
		const { container } = render(<ESGTeamDashboardPage />);

		expect(
			container.querySelectorAll('[data-slot="skeleton"], .h-28'),
		).not.toHaveLength(0);
		expect(screen.queryByText(/upgrade to pro/i)).not.toBeInTheDocument();
	});

	it('renders an error card (NOT the upgrade gate) when the company query fails', () => {
		setupMocks({
			company: queryResult({
				isError: true,
				error: {
					message: 'boom: company fetch failed',
					data: { code: 'FORBIDDEN' },
				},
			}),
		});
		render(<ESGTeamDashboardPage />);

		expect(screen.getByText(/couldn’t load your company/i)).toBeInTheDocument();
		// FORBIDDEN is a client-safe code → verbatim message is shown
		expect(screen.getByText('boom: company fetch failed')).toBeInTheDocument();
		expect(
			screen.queryByText(/esg reporting requires a pro plan/i),
		).not.toBeInTheDocument();
	});

	it('retry button refetches the company query', async () => {
		const refetch = vi.fn();
		setupMocks({
			company: queryResult({ isError: true, error: { message: 'x' }, refetch }),
		});
		render(<ESGTeamDashboardPage />);

		await userEvent.click(screen.getByRole('button', { name: /try again/i }));
		expect(refetch).toHaveBeenCalledOnce();
	});

	it('renders the upgrade gate for non-PRO companies', () => {
		setupMocks({
			company: queryResult({
				data: { id: 'company-1', name: 'Acme', planTier: 'FREE' },
			}),
			esg: queryResult({}),
		});
		render(<ESGTeamDashboardPage />);

		expect(
			screen.getByText(/esg reporting requires a pro plan/i),
		).toBeInTheDocument();
	});
});

describe('ESGTeamDashboardPage — ESG query states', () => {
	it('renders an error card instead of fabricated zeros when the ESG query fails', () => {
		setupMocks({
			esg: queryResult({
				isError: true,
				error: {
					message: 'Raw query failed. Code: 42804',
					data: { code: 'INTERNAL_SERVER_ERROR' },
				},
			}),
		});
		render(<ESGTeamDashboardPage />);

		// Error card present — internal error detail is NOT leaked to the UI
		expect(
			screen.getByText(/couldn’t load your esg report/i),
		).toBeInTheDocument();
		expect(screen.queryByText(/raw query failed/i)).not.toBeInTheDocument();
		expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
		expect(screen.getByRole('alert')).toBeInTheDocument();

		// No fabricated zero stats, no misleading zero-state copy
		expect(screen.queryByText('Employees Active')).not.toBeInTheDocument();
		expect(
			screen.queryByText(/no volunteer activity recorded yet/i),
		).not.toBeInTheDocument();
	});

	it('shows the verbatim message only for client-safe tRPC error codes', () => {
		setupMocks({
			esg: queryResult({
				isError: true,
				error: {
					message: 'ESG Reporting requires a PRO plan',
					data: { code: 'FORBIDDEN' },
				},
			}),
		});
		render(<ESGTeamDashboardPage />);

		expect(
			screen.getByText('ESG Reporting requires a PRO plan'),
		).toBeInTheDocument();
	});

	it('disables the retry button and spins while refetching', () => {
		setupMocks({
			esg: queryResult({
				isError: true,
				isRefetching: true,
				error: { message: 'x', data: { code: 'INTERNAL_SERVER_ERROR' } },
			}),
		});
		render(<ESGTeamDashboardPage />);

		expect(screen.getByRole('button', { name: /try again/i })).toBeDisabled();
	});

	it('disables CSV and PDF exports while the ESG query is errored', () => {
		setupMocks({
			esg: queryResult({ isError: true, error: { message: 'x' } }),
		});
		render(<ESGTeamDashboardPage />);

		expect(screen.getByRole('button', { name: /export csv/i })).toBeDisabled();
		expect(screen.getByRole('button', { name: /export pdf/i })).toBeDisabled();
	});

	it('retry button refetches the ESG query', async () => {
		const refetch = vi.fn();
		setupMocks({
			esg: queryResult({ isError: true, error: { message: 'x' }, refetch }),
		});
		render(<ESGTeamDashboardPage />);

		await userEvent.click(screen.getByRole('button', { name: /try again/i }));
		expect(refetch).toHaveBeenCalledOnce();
	});

	it('renders stat cards and the per-org table on success', () => {
		setupMocks();
		render(<ESGTeamDashboardPage />);

		expect(screen.getByText('Employees Active')).toBeInTheDocument();
		// '12' appears in the stat card and again in the table totals row
		expect(screen.getAllByText('12').length).toBeGreaterThan(0);
		expect(screen.getByText('Helping Hands')).toBeInTheDocument();
		expect(
			screen.queryByText(/couldn’t load your esg report/i),
		).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: /export csv/i })).toBeEnabled();
	});

	it('shows a validation state (not fabricated zeros) for an inverted date range', () => {
		setupMocks({ esg: queryResult({}) }); // disabled query: no data, no error
		render(<ESGTeamDashboardPage />);

		fireEvent.change(screen.getByLabelText('From'), {
			target: { value: '2026-02-01' },
		});
		fireEvent.change(screen.getByLabelText('To'), {
			target: { value: '2026-01-01' },
		});

		expect(
			screen.getByText(/end date must be on or after the start date/i),
		).toBeInTheDocument();
		// No fabricated stats or misleading zero-state while the range is invalid
		expect(screen.queryByText('Employees Active')).not.toBeInTheDocument();
		expect(
			screen.queryByText(/no volunteer activity recorded yet/i),
		).not.toBeInTheDocument();
		// Exports would 400 on the server — keep them disabled
		expect(screen.getByRole('button', { name: /export csv/i })).toBeDisabled();
		expect(screen.getByRole('button', { name: /export pdf/i })).toBeDisabled();
	});

	it('renders the zero-state (not an error) on success with no rows', () => {
		setupMocks({
			esg: queryResult({
				data: makeSummary({
					rows: [],
					totalEmployeesActive: 0,
					totalOrgsSupported: 0,
					totalShifts: 0,
					totalHours: 0,
					totalVerifiedCredentials: 0,
				}),
			}),
		});
		render(<ESGTeamDashboardPage />);

		expect(
			screen.getByText(/no volunteer activity recorded yet/i),
		).toBeInTheDocument();
		expect(
			screen.queryByText(/couldn’t load your esg report/i),
		).not.toBeInTheDocument();
	});
});
