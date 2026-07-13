// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { FileText, LayoutDashboard, Search } from 'lucide-react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppSidebar, getActiveHref } from './app-sidebar';

const { mockUsePathname, mockUseSession } = vi.hoisted(() => ({
	mockUsePathname: vi.fn(),
	mockUseSession: vi.fn(),
}));

vi.mock('next/navigation', () => ({
	usePathname: mockUsePathname,
}));

vi.mock('next-auth/react', () => ({
	useSession: mockUseSession,
}));

function activeLinks() {
	return screen
		.getAllByRole('link')
		.filter((a) => a.className.includes('border-primary'));
}

beforeEach(() => {
	mockUsePathname.mockReturnValue('/app');
	mockUseSession.mockReturnValue({ data: { user: {} } });
});

describe('getActiveHref', () => {
	const items = [
		{ label: 'Dashboard', href: '/app', icon: LayoutDashboard },
		{ label: 'Opportunities', href: '/app/opportunities', icon: Search },
		{ label: 'Settings', href: '/app/settings', icon: FileText },
		{ label: 'Team', href: '/app/settings/team', icon: FileText },
	];

	it('matches /app exactly only', () => {
		expect(getActiveHref(items, '/app')).toBe('/app');
		expect(getActiveHref(items, '/app/impact-report')).toBeUndefined();
	});

	it('prefix-matches on segment boundaries', () => {
		expect(getActiveHref(items, '/app/opportunities/abc123')).toBe(
			'/app/opportunities',
		);
	});

	it('rejects false prefixes that are not segment-bounded', () => {
		expect(getActiveHref(items, '/app/opportunities2')).toBeUndefined();
	});

	it('picks the longest (most specific) match when several match', () => {
		expect(getActiveHref(items, '/app/settings/team')).toBe(
			'/app/settings/team',
		);
		expect(getActiveHref(items, '/app/settings/background-checks')).toBe(
			'/app/settings',
		);
	});

	it('returns undefined when nothing matches', () => {
		expect(getActiveHref(items, '/apply/some-org')).toBeUndefined();
	});

	it('returns undefined for an empty item list', () => {
		expect(getActiveHref([], '/app')).toBeUndefined();
	});
});

describe('AppSidebar', () => {
	it('shows volunteer nav when user has no org', () => {
		render(<AppSidebar hasOrg={false} hasCompany={false} />);
		expect(screen.getByText('Browse opportunities')).toBeInTheDocument();
		expect(screen.queryByText('Screener')).not.toBeInTheDocument();
	});

	it('shows staff nav when user has an org', () => {
		render(<AppSidebar hasOrg={true} hasCompany={false} />);
		expect(screen.getByText('Screener')).toBeInTheDocument();
		expect(screen.queryByText('Browse opportunities')).not.toBeInTheDocument();
	});

	it('shows company section only when user has a company', () => {
		render(<AppSidebar hasOrg={true} hasCompany={true} companyId="c1" />);
		expect(screen.getByText('ESG Report')).toBeInTheDocument();
	});

	it('shows platform admin section from session flag', () => {
		mockUseSession.mockReturnValue({
			data: { user: { isPlatformAdmin: true } },
		});
		render(<AppSidebar hasOrg={true} hasCompany={false} />);
		expect(screen.getByText('Audit log')).toBeInTheDocument();
	});

	it('Settings links to /app/settings, not credentials', () => {
		render(<AppSidebar hasOrg={true} hasCompany={false} />);
		expect(screen.getByText('Settings').closest('a')).toHaveAttribute(
			'href',
			'/app/settings',
		);
	});

	it('ESG Report links to the /esg route', () => {
		render(<AppSidebar hasOrg={true} hasCompany={true} companyId="c1" />);
		expect(screen.getByText('ESG Report').closest('a')).toHaveAttribute(
			'href',
			'/app/company/c1/esg',
		);
	});

	it('highlights exactly one item on the ESG page (regression: issue #127)', () => {
		mockUsePathname.mockReturnValue('/app/company/c1/esg');
		render(<AppSidebar hasOrg={true} hasCompany={true} companyId="c1" />);
		const active = activeLinks();
		expect(active).toHaveLength(1);
		expect(active[0]).toHaveTextContent('ESG Report');
	});

	it('highlights only Company on the company dashboard', () => {
		mockUsePathname.mockReturnValue('/app/company/c1');
		render(<AppSidebar hasOrg={true} hasCompany={true} companyId="c1" />);
		const active = activeLinks();
		expect(active).toHaveLength(1);
		expect(active[0]).toHaveTextContent('Company');
	});

	it('highlights Team (not Settings) on /app/settings/team', () => {
		mockUsePathname.mockReturnValue('/app/settings/team');
		render(<AppSidebar hasOrg={true} hasCompany={false} />);
		const active = activeLinks();
		expect(active).toHaveLength(1);
		expect(active[0]).toHaveTextContent('Team');
	});

	it('highlights Settings on /app/settings/background-checks', () => {
		mockUsePathname.mockReturnValue('/app/settings/background-checks');
		render(<AppSidebar hasOrg={true} hasCompany={false} />);
		const active = activeLinks();
		expect(active).toHaveLength(1);
		expect(active[0]).toHaveTextContent('Settings');
	});

	it('highlights only Dashboard on /app', () => {
		mockUsePathname.mockReturnValue('/app');
		render(<AppSidebar hasOrg={true} hasCompany={false} />);
		const active = activeLinks();
		expect(active).toHaveLength(1);
		expect(active[0]).toHaveTextContent('Dashboard');
	});

	it('falls back to the generic /app/company link when hasCompany but no companyId', () => {
		render(<AppSidebar hasOrg={false} hasCompany={true} companyId={null} />);
		const company = screen.getByRole('link', { name: 'Company' });
		expect(company).toHaveAttribute('href', '/app/company');
		expect(screen.queryByText('ESG Report')).not.toBeInTheDocument();
	});

	it('builds company nav from the URL companyId when it differs from the session (multi-company)', () => {
		mockUsePathname.mockReturnValue('/app/company/other-co/esg');
		render(<AppSidebar hasOrg={false} hasCompany={true} companyId="c1" />);
		expect(screen.getByText('ESG Report').closest('a')).toHaveAttribute(
			'href',
			'/app/company/other-co/esg',
		);
		const active = activeLinks();
		expect(active).toHaveLength(1);
		expect(active[0]).toHaveTextContent('ESG Report');
	});
});
