// @vitest-environment jsdom

// ---------------------------------------------------------------------------
// OrgSwitcher width discipline (app-shell overflow fix).
//
// This component had no test file at all. It is one of the two widest things in
// the authenticated top bar, and every width cap on it was revertible with the
// whole suite green — removing them does not overflow the DOCUMENT (the left
// cluster shrinks now), it squeezes the org name to a bare ellipsis, which
// nothing was watching.
//
// jsdom evaluates no media query and has no layout, so these assert the CLASS
// STRINGS rather than rendered widths — the same technique the roster's
// dual-tree tests use, and the only evidence available here. The rendered
// consequence is covered by the 800px e2e in `staff-tables-mobile.spec.ts`,
// which is the band where the shell was 126px over.
// ---------------------------------------------------------------------------

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockUseRouter, mockUseSession, mockListOrgs, mockGetCurrentOrg } =
	vi.hoisted(() => ({
		mockUseRouter: vi.fn(),
		mockUseSession: vi.fn(),
		mockListOrgs: vi.fn(),
		mockGetCurrentOrg: vi.fn(),
	}));

vi.mock('next/navigation', () => ({ useRouter: mockUseRouter }));
vi.mock('next-auth/react', () => ({ useSession: mockUseSession }));
vi.mock('@tanstack/react-query', () => ({
	useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/trpc/client', () => ({
	trpc: {
		org: {
			listOrgs: { useQuery: mockListOrgs },
			getCurrentOrg: { useQuery: mockGetCurrentOrg },
			switchOrg: {
				useMutation: () => ({ mutate: vi.fn(), isPending: false }),
			},
		},
	},
}));

import { OrgSwitcher } from '../OrgSwitcher';

const ORGS = [
	{ id: 'org-A', name: 'Riverside Animal Shelter', slug: 'riverside' },
	{ id: 'org-B', name: 'Helping Hands', slug: 'helping-hands' },
];

beforeEach(() => {
	vi.clearAllMocks();
	mockUseRouter.mockReturnValue({ refresh: vi.fn() });
	mockUseSession.mockReturnValue({ data: { currentOrgId: 'org-A' } });
	mockGetCurrentOrg.mockReturnValue({ data: ORGS[0] });
	mockListOrgs.mockReturnValue({ data: ORGS, isLoading: false });
});

describe('OrgSwitcher — width discipline', () => {
	it('caps and truncates the single-org name, tightest at the base width', () => {
		// A real seeded org is "Riverside Animal Shelter" — long enough that an
		// uncapped label alone pushed the account button off a 375px viewport.
		mockListOrgs.mockReturnValue({ data: [ORGS[0]], isLoading: false });
		render(<OrgSwitcher />);

		const label = screen.getByText('Riverside Animal Shelter');
		expect(label).toHaveClass('truncate', 'max-w-24', 'sm:max-w-40');
	});

	it('lets the multi-org trigger SHRINK, overriding Button’s base shrink-0', () => {
		// `Button` is `shrink-0` by default, so without the explicit `shrink` this
		// trigger cannot give up width and `min-w-0` on the parent cluster buys
		// nothing — in the 768-1023px band, where this and the company switcher
		// both render beside a toggle that is still `lg:hidden`.
		render(<OrgSwitcher />);

		expect(screen.getByRole('button')).toHaveClass('shrink', 'max-w-[120px]');
	});

	it('renders nothing while the org list is loading', () => {
		// Guards the zero-width state the header depends on: a placeholder here
		// would occupy the tightest part of the row on first paint.
		mockListOrgs.mockReturnValue({ data: undefined, isLoading: true });
		const { container } = render(<OrgSwitcher />);

		expect(container).toBeEmptyDOMElement();
	});
});
