// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	pendingIds: new Set<string>(),
	useListQuery: vi.fn(),
	// `org.getCurrentOrg` feeds MarketplaceCard and TimezoneCard, which sit
	// BELOW the members table and so only render once `members.list` succeeds.
	useOrgQuery: vi.fn(),
	// Which member the session belongs to. `isOwner` and `isCurrentUser` are both
	// derived from this address, so a fixed value pins the caller at one role and
	// leaves the other branches unrenderable — which is how the OWNER-only ADMIN
	// option went untested.
	sessionEmail: { value: 'staff@example.org' },
	// Keyed BY PROCEDURE, not one shared object. `isMemberPending` ORs two
	// independent mutations, and a shared mock makes both clauses copies of one
	// expression — either is deletable with every test still green, which is
	// exactly the collapse the split exists to prevent.
	mutations: {
		removeMember: { mutate: vi.fn(), isPending: false, variables: undefined },
		updateRole: { mutate: vi.fn(), isPending: false, variables: undefined },
		other: { mutate: vi.fn(), isPending: false, variables: undefined },
	} as Record<
		string,
		{
			mutate: ReturnType<typeof vi.fn>;
			isPending: boolean;
			variables: { memberId: string } | undefined;
		}
	>,
}));

// Only `members.list` drives the branch under test; a Proxy keeps the rest
// inert so this file does not break when the page gains another query.
vi.mock('@/lib/trpc/client', () => {
	const inert = new Proxy(
		{},
		{
			get: (_t, prop) => {
				if (prop === 'useMutation') return () => mocks.mutations.other;
				if (prop === 'useQuery')
					return () => ({ data: undefined, isLoading: false, isError: false });
				return undefined;
			},
		},
	);
	return {
		trpc: new Proxy(
			{},
			{
				get: (_t, router) => {
					if (router === 'useUtils') return () => ({});
					return new Proxy(
						{},
						{
							get: (_r, proc) => {
								if (router === 'org' && proc === 'getCurrentOrg')
									return { useQuery: mocks.useOrgQuery };
								if (router !== 'members') return inert;
								if (proc === 'list') return { useQuery: mocks.useListQuery };
								if (proc === 'removeMember' || proc === 'updateRole')
									return {
										useMutation: () => mocks.mutations[proc as string],
									};
								return inert;
							},
						},
					);
				},
			},
		),
	};
});

// `usePendingIds` owns which ROWS are mid-request. Mocked here so a test can
// declare a set directly; the hook's own semantics — including the concurrency
// property this replaced `mutation.variables` to get — are covered in
// `src/lib/hooks/use-pending-ids.test.ts`.
vi.mock('@/lib/hooks/use-pending-ids', () => ({
	usePendingIds: () => ({
		has: (id: string) => mocks.pendingIds.has(id),
		start: vi.fn(),
		finish: vi.fn(),
	}),
}));

vi.mock('next-auth/react', () => ({
	useSession: () => ({ data: { user: { email: mocks.sessionEmail.value } } }),
}));
vi.mock('@tanstack/react-query', async () => {
	const actual = await vi.importActual<typeof import('@tanstack/react-query')>(
		'@tanstack/react-query',
	);
	return { ...actual, useQueryClient: () => ({ invalidateQueries: vi.fn() }) };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import TeamPage from './page';

beforeEach(() => {
	vi.clearAllMocks();
	mocks.pendingIds.clear();
	mocks.sessionEmail.value = 'staff@example.org';
	mocks.useOrgQuery.mockReturnValue({
		data: { marketplaceVisible: false, timezone: 'America/Los_Angeles' },
		isLoading: false,
		isError: false,
		isFetching: false,
		refetch: vi.fn(),
	});
	for (const m of Object.values(mocks.mutations)) {
		m.isPending = false;
		m.variables = undefined;
	}
});

/**
 * This page had no test file at all when it was migrated from rendering
 * `{query.error.message}` raw to `QueryErrorCard` + `safeErrorMessage`. The
 * helper's own contract is covered in `query-error-card.test.tsx`; what these
 * assert is that THIS page actually calls it — without them, reverting the
 * migration reddens nothing.
 */
describe('TeamPage error state', () => {
	it('SECURITY: does not render an internal error string verbatim', () => {
		mocks.useListQuery.mockReturnValue({
			data: undefined,
			isLoading: false,
			isError: true,
			isFetching: false,
			error: {
				message: 'Invalid `prisma.organizationMember.findMany()` invocation',
				data: { code: 'INTERNAL_SERVER_ERROR' },
			},
			refetch: vi.fn(),
		});

		render(<TeamPage />);

		expect(screen.queryByText(/prisma\./i)).not.toBeInTheDocument();
		expect(screen.getByRole('alert')).toHaveTextContent(
			'Something went wrong. Please try again.',
		);
	});

	it('shows an allowlisted message and never the empty state', () => {
		mocks.useListQuery.mockReturnValue({
			data: undefined,
			isLoading: false,
			isError: true,
			isFetching: false,
			error: {
				message: 'You do not have access to this organisation.',
				data: { code: 'FORBIDDEN' },
			},
			refetch: vi.fn(),
		});

		render(<TeamPage />);

		expect(screen.getByRole('alert')).toHaveTextContent(
			'You do not have access to this organisation.',
		);
		expect(screen.queryByText('No members yet')).not.toBeInTheDocument();
	});
});

// ---------------------------------------------------------------------------
// T36 — the mobile card list
// ---------------------------------------------------------------------------

const MEMBERS = [
	{
		id: 'mem-owner',
		role: 'OWNER',
		user: { id: 'u-1', name: 'Ada Owner', email: 'owner@example.org' },
	},
	{
		id: 'mem-self',
		role: 'ADMIN',
		// Matches the mocked session above, so this is the "You" row.
		user: { id: 'u-2', name: null, email: 'staff@example.org' },
	},
	{
		id: 'mem-other',
		role: 'STAFF',
		user: { id: 'u-3', name: 'Bo Helper', email: 'bo@example.org' },
	},
	{
		// A SECOND manageable row. Owner and self render no controls, so with one
		// manageable member it is impossible to show two rows disabled at once —
		// which is the whole property the pending SET exists to provide.
		id: 'mem-third',
		role: 'READONLY',
		user: { id: 'u-4', name: 'Cy Reader', email: 'cy@example.org' },
	},
];

function renderWithMembers() {
	mocks.useListQuery.mockReturnValue({
		data: MEMBERS,
		isLoading: false,
		isError: false,
		isFetching: false,
		error: null,
		refetch: vi.fn(),
	});
	render(<TeamPage />);
}

/**
 * Both trees are always mounted — the switch is pure CSS — so every name, role
 * badge and control matches TWICE and an unscoped query throws. Scope through
 * the wrapper testids, exactly as `volunteers/page.test.tsx` does.
 *
 * jsdom has no layout engine and evaluates no media query, so nothing here can
 * prove WHICH tree a human sees; that is the 375px e2e's job.
 */
const cardList = () => within(screen.getByTestId('team-card-list'));

describe('TeamPage mobile card list (T36)', () => {
	it('renders both trees, switched by CSS rather than by a hook', () => {
		renderWithMembers();

		expect(screen.getByTestId('team-table')).toHaveClass('hidden', 'lg:block');
		expect(screen.getByTestId('team-card-list')).toHaveClass('lg:hidden');
	});

	it('keeps both controls on the card — there is no detail view to move them to', () => {
		renderWithMembers();

		expect(
			cardList().getByRole('button', {
				name: 'Remove Bo Helper from this organization',
			}),
		).toBeInTheDocument();
		expect(
			cardList().getByRole('combobox', { name: 'Role for Bo Helper' }),
		).toBeInTheDocument();
	});

	it('SECURITY: offers no controls for the OWNER row or for yourself', () => {
		renderWithMembers();

		// Three members, one manageable. Counting rather than naming: a rule that
		// leaks controls onto the owner row is the failure this guards, and an
		// assertion on Bo alone would still pass while it did.
		// Four members, two manageable: the OWNER row and the caller's own row
		// render "You"/"—" instead of controls.
		expect(cardList().getAllByRole('button')).toHaveLength(2);
		expect(cardList().getAllByRole('combobox')).toHaveLength(2);
		expect(cardList().getByText('You')).toBeInTheDocument();
	});

	it('disables only the row being changed, not every row', () => {
		// The pre-T36 shape was a shared
		// `removeMutation.isPending || updateRoleMutation.isPending`, which greyed
		// out every row's controls on any single click.
		mocks.pendingIds.add('mem-other');
		renderWithMembers();

		expect(
			cardList().getByRole('button', {
				name: 'Remove Bo Helper from this organization',
			}),
		).toBeDisabled();
	});

	it('leaves a row enabled while a DIFFERENT one is in flight', () => {
		// The half that actually fails under the old shared-`isPending` shape:
		// asserting only that the in-flight row goes disabled passes either way.
		mocks.pendingIds.add('mem-owner');
		renderWithMembers();

		expect(
			cardList().getByRole('button', {
				name: 'Remove Bo Helper from this organization',
			}),
		).toBeEnabled();
	});

	it('fires removal for its OWN row', () => {
		renderWithMembers();

		fireEvent.click(
			cardList().getByRole('button', {
				name: 'Remove Bo Helper from this organization',
			}),
		);

		expect(mocks.mutations.removeMember.mutate).toHaveBeenCalledWith({
			memberId: 'mem-other',
		});
	});
});

describe('TeamPage concurrent pending rows (T36)', () => {
	// A role change and a removal are independent requests that overlap freely:
	// remove member B, then re-role member C before B settles. The shape this
	// replaced keyed off `mutation.variables`, which query-core only tracks for
	// the MOST RECENT call — so B's controls re-enabled mid-flight and a second
	// write for B could be issued, landing an unordered pair of role writes.
	it('keeps every mid-request row disabled, not just the latest', () => {
		mocks.pendingIds.add('mem-other');
		mocks.pendingIds.add('mem-third');
		renderWithMembers();

		expect(
			cardList().getByRole('button', {
				name: 'Remove Bo Helper from this organization',
			}),
		).toBeDisabled();
		expect(
			cardList().getByRole('button', {
				name: 'Remove Cy Reader from this organization',
			}),
		).toBeDisabled();
	});
});

const table = () => within(screen.getByTestId('team-table'));

describe('TeamPage desktop tree (T36)', () => {
	// The desktop cell was rewritten to go through `MemberRowActions`, and this
	// file had no `table()` helper at all — every assertion was scoped to the
	// card tree, so the whole desktop rewrite was unverified.
	it('still renders both controls on the desktop row', () => {
		renderWithMembers();

		expect(
			table().getByRole('button', {
				name: 'Remove Bo Helper from this organization',
			}),
		).toBeInTheDocument();
		expect(
			table().getByRole('combobox', { name: 'Role for Bo Helper' }),
		).toBeInTheDocument();
	});

	it('SECURITY: withholds controls from the OWNER row and from yourself on desktop too', () => {
		// The card tree has this assertion; without the desktop counterpart the
		// permissions rule was only half covered, on a shared component.
		renderWithMembers();

		expect(table().getAllByRole('button')).toHaveLength(2);
		expect(table().getAllByRole('combobox')).toHaveLength(2);
	});

	it('keeps the table compact and gives the card 44px targets', () => {
		// `compact` is the only visual difference between the two renders of the
		// shared component. Flipping it for the card would silently hand a phone
		// 32px targets, which is the thing the card layout exists to fix.
		renderWithMembers();

		expect(
			table().getByRole('combobox', { name: 'Role for Bo Helper' }),
		).toHaveClass('h-8');
		expect(
			cardList().getByRole('combobox', { name: 'Role for Bo Helper' }),
		).toHaveClass('h-11');
		expect(
			cardList().getByRole('button', {
				name: 'Remove Bo Helper from this organization',
			}),
		).toHaveClass('h-11');
	});
});

// ---------------------------------------------------------------------------
// The ADMIN tier is OWNER-granted only
// ---------------------------------------------------------------------------

/**
 * These cover the one rule `MemberRowActions`' docstring names that had no test:
 * `ADMIN` is offered only to an OWNER. It went uncovered because the mocked
 * caller was always the ADMIN row, so the branch never rendered — and because
 * Radix does not mount `SelectContent`'s items until the trigger is opened, so
 * even the right caller sees nothing without a `fireEvent`.
 *
 * This is the AFFORDANCE half only. The control is `assertMayGrantRole()` in
 * `memberService.ts`; see `memberService.audit.test.ts`, where the same rule is
 * asserted against the server and mutation-verified in both directions. A test
 * here alone would be exactly the mistake this pairing was written to fix — the
 * client gate looked like enforcement for months while the mutation was open.
 */
describe('TeamPage: ADMIN is offered only to an OWNER', () => {
	function openRoleSelect() {
		fireEvent.click(
			cardList().getByRole('combobox', { name: 'Role for Bo Helper' }),
		);
	}

	it('offers ADMIN when the caller is the OWNER', () => {
		mocks.sessionEmail.value = 'owner@example.org';
		renderWithMembers();
		openRoleSelect();

		// Scoped to the listbox: "Admin" also appears as a role badge on the
		// caller's own row, in both trees.
		const options = within(screen.getByRole('listbox'));
		expect(options.getByRole('option', { name: 'Admin' })).toBeInTheDocument();
		expect(options.getByRole('option', { name: 'Staff' })).toBeInTheDocument();
	});

	it('withholds ADMIN when the caller is an ADMIN', () => {
		// The default session — `mem-self`, role ADMIN.
		renderWithMembers();
		openRoleSelect();

		const options = within(screen.getByRole('listbox'));
		expect(options.queryByRole('option', { name: 'Admin' })).toBeNull();
		// Contrast: the select still works, so the assertion above is about the
		// ADMIN option specifically and not about an unopened dropdown.
		expect(options.getByRole('option', { name: 'Staff' })).toBeInTheDocument();
		expect(
			options.getByRole('option', { name: 'Read-only' }),
		).toBeInTheDocument();
	});
});

/**
 * MarketplaceCard and TimezoneCard read `org.getCurrentOrg` and, until T37, had
 * no `isError` branch at all — so a failed load did not fail visibly. Both
 * defaulted, and defaulting is what makes this worse than a blank card: the
 * page stated a setting the org does not hold, and offered a control to
 * "correct" it.
 */
describe('org-settings cards: a failed load must not read as a setting', () => {
	function failOrgQuery(code = 'INTERNAL_SERVER_ERROR') {
		mocks.useListQuery.mockReturnValue({
			data: [],
			isLoading: false,
			isError: false,
			isFetching: false,
			refetch: vi.fn(),
		});
		mocks.useOrgQuery.mockReturnValue({
			data: undefined,
			isLoading: false,
			isError: true,
			isFetching: false,
			error: {
				message:
					'Invalid `prisma.organization.findUnique()` invocation: relation does not exist',
				data: { code },
			},
			refetch: vi.fn(),
		});
	}

	it('renders ONE error, not one per card, for the shared query', () => {
		// MarketplaceCard and TimezoneCard read the same `org.getCurrentOrg`,
		// which React Query dedupes into one request. Two error branches meant
		// the coordinator saw the same failure twice, with two `role="alert"`
		// regions announced back to back and two retries for one refetch.
		failOrgQuery();
		render(<TeamPage />);

		expect(
			screen.getAllByText("Couldn't load your organization settings"),
		).toHaveLength(1);
		expect(screen.getAllByRole('button', { name: /try again/i })).toHaveLength(
			1,
		);
	});

	it('shows an error instead of a FALSE default from either card', () => {
		// The two lies this branch replaces: an unchecked marketplace switch
		// (implying "not listed") and "UTC (default)" (implying the org never
		// set a timezone). Both are statements the failed query cannot support.
		failOrgQuery();
		render(<TeamPage />);

		expect(
			screen.queryByRole('switch', { name: /marketplace/i }),
		).not.toBeInTheDocument();
		expect(screen.queryByText('UTC (default)')).not.toBeInTheDocument();
	});

	it('SECURITY: neither card renders the raw server text', () => {
		failOrgQuery();
		render(<TeamPage />);

		expect(screen.queryByText(/prisma\./i)).not.toBeInTheDocument();
	});
});
