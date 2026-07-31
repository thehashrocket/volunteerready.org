// @vitest-environment jsdom
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	useListQuery: vi.fn(),
	useCountQuery: vi.fn(),
	useRemoveMutation: vi.fn(),
	useRestoreMutation: vi.fn(),
	useCurrentOrgQuery: vi.fn(),
	invalidate: vi.fn(),
	removeMutate: vi.fn(),
	restoreMutate: vi.fn(),
	toastSuccess: vi.fn(),
	toastError: vi.fn(),
	// Captured from useMutation({...}) so tests can drive the handlers directly,
	// the same way AddVolunteerDialog.test.tsx does.
	onRemoveSuccess: null as
		| ((data: unknown, variables: { volunteerId: string }) => void)
		| null,
	onRestoreSuccess: null as
		| ((data: unknown, variables: { volunteerId: string }) => void)
		| null,
	// Captured too — the restore error branch is the OrgVolunteerBlock refusal,
	// which the design doc calls "not optional". Without capturing onError the
	// whole handler could be deleted and every test would stay green.
	onRemoveError: null as ((e: unknown) => void) | null,
	onRestoreError: null as ((e: unknown) => void) | null,
}));

vi.mock('@/lib/trpc/client', () => ({
	trpc: {
		volunteers: {
			list: { useQuery: mocks.useListQuery },
			count: { useQuery: mocks.useCountQuery },
			remove: { useMutation: mocks.useRemoveMutation },
			restore: { useMutation: mocks.useRestoreMutation },
			add: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
		},
		org: { getCurrentOrg: { useQuery: mocks.useCurrentOrgQuery } },
		useUtils: () => ({ volunteers: { invalidate: mocks.invalidate } }),
	},
}));

vi.mock('sonner', () => ({
	toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

// The roster page renders a Dialog above lg and a Drawer below. Pin it to the
// desktop branch here so these tests exercise the page, not vaul.
vi.mock('@/lib/hooks/use-media-query', () => ({
	useMediaQuery: () => true,
}));

import VolunteersPage from './page';

/** The desktop table. Both trees are in the DOM; CSS alone hides one. */
function table() {
	return within(screen.getByTestId('roster-table'));
}

/** The below-`lg` card list. */
function cardList() {
	return within(screen.getByTestId('roster-card-list'));
}

function listResult(over: Record<string, unknown> = {}) {
	return {
		data: { volunteers: [], nextCursor: null },
		isLoading: false,
		isError: false,
		isFetching: false,
		error: null,
		refetch: vi.fn(),
		...over,
	};
}

const VOLUNTEER = {
	id: 'ov-1',
	displayName: 'Maria Garcia',
	email: 'maria@example.com',
	phone: null,
	accountState: 'UNCLAIMED' as const,
	source: 'STAFF_ADDED' as const,
	userId: 'u-1',
	addedAt: new Date('2026-03-01T00:00:00Z'),
	attendedShifts: 12,
};

beforeEach(() => {
	vi.clearAllMocks();
	mocks.onRemoveSuccess = null;
	mocks.onRestoreSuccess = null;
	mocks.useListQuery.mockReturnValue(listResult());
	mocks.useCountQuery.mockReturnValue({ data: 0 });
	mocks.useRemoveMutation.mockImplementation(
		(opts: {
			onSuccess: (d: unknown, v: { volunteerId: string }) => void;
			onError: (e: unknown) => void;
		}) => {
			mocks.onRemoveSuccess = opts.onSuccess;
			mocks.onRemoveError = opts.onError;
			return {
				mutate: mocks.removeMutate,
				isPending: false,
				variables: undefined,
			};
		},
	);
	mocks.useRestoreMutation.mockImplementation(
		(opts: {
			onSuccess: (d: unknown, v: { volunteerId: string }) => void;
			onError: (e: unknown) => void;
		}) => {
			mocks.onRestoreSuccess = opts.onSuccess;
			mocks.onRestoreError = opts.onError;
			return {
				mutate: mocks.restoreMutate,
				isPending: false,
				variables: undefined,
			};
		},
	);
	mocks.useCurrentOrgQuery.mockReturnValue({ data: { id: 'org-1' } });
});

/** Renders one volunteer and returns the options object of the remove toast. */
function removeAndReadToast() {
	mocks.useListQuery.mockReturnValue(
		listResult({ data: { volunteers: [VOLUNTEER], nextCursor: null } }),
	);
	render(<VolunteersPage />);
	mocks.onRemoveSuccess?.(undefined, { volunteerId: 'ov-1' });
	return mocks.toastSuccess.mock.calls[0][1] as {
		duration: number;
		action: { label: string; onClick: () => void };
	};
}

describe('Export CSV', () => {
	it('points at the org-scoped export route', () => {
		mocks.useCountQuery.mockReturnValue({ data: 3 });
		render(<VolunteersPage />);
		expect(screen.getByTestId('export-roster-csv')).toHaveAttribute(
			'href',
			'/api/org/org-1/roster/csv',
		);
	});

	it('is withheld until the org id resolves, rather than linking nowhere', () => {
		mocks.useCountQuery.mockReturnValue({ data: 3 });
		mocks.useCurrentOrgQuery.mockReturnValue({ data: undefined });
		render(<VolunteersPage />);
		expect(screen.queryByTestId('export-roster-csv')).not.toBeInTheDocument();
	});

	it('is withheld on an empty roster, per the approved spec', () => {
		// A header-only download offered beside "add your first volunteer" is an
		// offer with nothing behind it.
		mocks.useCountQuery.mockReturnValue({ data: 0 });
		render(<VolunteersPage />);
		expect(screen.queryByTestId('export-roster-csv')).not.toBeInTheDocument();
	});
});

describe('VolunteersPage states', () => {
	it('renders a table-shaped skeleton with the REAL column headers while loading', () => {
		// A skeleton carrying the real headers means nothing reflows when the
		// data lands. Five anonymous grey bars visibly jump.
		mocks.useListQuery.mockReturnValue(listResult({ isLoading: true }));
		render(<VolunteersPage />);

		expect(screen.getByText('Volunteer')).toBeInTheDocument();
		expect(screen.getByText('Added')).toBeInTheDocument();
		expect(screen.getByText('Shifts')).toBeInTheDocument();
		expect(screen.getByText('Status')).toBeInTheDocument();
	});

	it('renders QueryErrorCard on error, NOT an empty state', () => {
		// The failure this prevents: shifts/page.tsx never checks isError, so a
		// failed query renders as "you have no data" — a broken page that looks
		// correct. On a roster that is the worst possible confusion.
		mocks.useListQuery.mockReturnValue(
			listResult({ isError: true, error: { message: 'boom', data: null } }),
		);
		render(<VolunteersPage />);

		expect(screen.getByRole('alert')).toBeInTheDocument();
		expect(screen.queryByText('No volunteers yet')).not.toBeInTheDocument();
	});

	it('does not leak an internal error string to the user', () => {
		mocks.useListQuery.mockReturnValue(
			listResult({
				isError: true,
				error: {
					message: 'PrismaClientKnownRequestError: relation does not exist',
					data: { code: 'INTERNAL_SERVER_ERROR' },
				},
			}),
		);
		render(<VolunteersPage />);

		expect(screen.queryByText(/PrismaClient/)).not.toBeInTheDocument();
	});

	it('shows the true-empty state with the concierge offer', () => {
		render(<VolunteersPage />);

		expect(screen.getByText('No volunteers yet')).toBeInTheDocument();
		expect(screen.getByText(/Have a spreadsheet/)).toBeInTheDocument();
	});

	it('shows DIFFERENT copy for a filtered-empty result', async () => {
		// Conflating the two makes a working filter look like an empty roster.
		const { rerender } = render(<VolunteersPage />);
		const user = (await import('@testing-library/user-event')).default.setup();

		await user.type(screen.getByLabelText('Search volunteers'), 'zzz');
		rerender(<VolunteersPage />);

		expect(
			screen.getByText('No volunteers match that search.'),
		).toBeInTheDocument();
		expect(screen.queryByText('No volunteers yet')).not.toBeInTheDocument();
	});

	it('renders a roster row with name, email, shift count and status badge', () => {
		mocks.useListQuery.mockReturnValue(
			listResult({ data: { volunteers: [VOLUNTEER], nextCursor: null } }),
		);
		mocks.useCountQuery.mockReturnValue({ data: 1 });
		render(<VolunteersPage />);

		// Scoped to the desktop tree: the card list renders the same name, email
		// and badge, so an unscoped getByText matches twice and throws.
		expect(table().getByText('Maria Garcia')).toBeInTheDocument();
		expect(table().getByText('maria@example.com')).toBeInTheDocument();
		expect(table().getByText('12')).toBeInTheDocument();
		// The approved wording, not "Not activated" and not a raw enum.
		expect(table().getByText('No account yet')).toBeInTheDocument();
	});

	it('renders no avatars', () => {
		// No table in this app has them; adding them here would be net-new
		// vocabulary for no informational gain.
		mocks.useListQuery.mockReturnValue(
			listResult({ data: { volunteers: [VOLUNTEER], nextCursor: null } }),
		);
		const { container } = render(<VolunteersPage />);
		expect(container.querySelector('img')).toBeNull();
	});

	it('shows Load more only when there is a next cursor', () => {
		mocks.useListQuery.mockReturnValue(
			listResult({ data: { volunteers: [VOLUNTEER], nextCursor: null } }),
		);
		const { rerender } = render(<VolunteersPage />);
		expect(screen.queryByText('Load more')).not.toBeInTheDocument();

		mocks.useListQuery.mockReturnValue(
			listResult({ data: { volunteers: [VOLUNTEER], nextCursor: 'ov-9' } }),
		);
		rerender(<VolunteersPage />);
		// One per tree — each list carries its own, per the approved spec's
		// "centred Load more inside the card". Only one is ever visible.
		expect(table().getByText('Load more')).toBeInTheDocument();
		expect(cardList().getByText('Load more')).toBeInTheDocument();
	});

	it('never renders numbered pagination', () => {
		// Offset pages silently skip or duplicate rows while a concierge import
		// is writing to the same table.
		mocks.useListQuery.mockReturnValue(
			listResult({ data: { volunteers: [VOLUNTEER], nextCursor: 'ov-9' } }),
		);
		render(<VolunteersPage />);
		expect(screen.queryByLabelText(/page \d/i)).not.toBeInTheDocument();
	});
});

describe('VolunteersPage concierge threshold', () => {
	it('keeps the offer visible while the roster is below the threshold', () => {
		// The org that types 3 names and stalls is exactly the org that needs it.
		mocks.useListQuery.mockReturnValue(
			listResult({ data: { volunteers: [VOLUNTEER], nextCursor: null } }),
		);
		mocks.useCountQuery.mockReturnValue({ data: 3 });
		render(<VolunteersPage />);

		expect(screen.getByText(/Have a spreadsheet/)).toBeInTheDocument();
	});

	it('hides the offer once the roster reaches the threshold', () => {
		mocks.useListQuery.mockReturnValue(
			listResult({ data: { volunteers: [VOLUNTEER], nextCursor: null } }),
		);
		mocks.useCountQuery.mockReturnValue({ data: 10 });
		render(<VolunteersPage />);

		expect(screen.queryByText(/Have a spreadsheet/)).not.toBeInTheDocument();
	});

	it('does not show the offer over an error state', () => {
		mocks.useListQuery.mockReturnValue(
			listResult({ isError: true, error: { message: 'x', data: null } }),
		);
		mocks.useCountQuery.mockReturnValue({ data: 0 });
		render(<VolunteersPage />);

		expect(screen.queryByText(/Have a spreadsheet/)).not.toBeInTheDocument();
	});
});

describe('VolunteersPage mobile card list (T28)', () => {
	beforeEach(() => {
		mocks.useListQuery.mockReturnValue(
			listResult({ data: { volunteers: [VOLUNTEER], nextCursor: null } }),
		);
		mocks.useCountQuery.mockReturnValue({ data: 1 });
	});

	it('renders both trees from the same data, switched by CSS not by JS', () => {
		// The whole reason this is a class toggle rather than useMediaQuery: that
		// hook initialises to false and resolves in an effect, so a JS switch
		// paints the card shape to every desktop user and swaps after hydration.
		render(<VolunteersPage />);

		expect(screen.getByTestId('roster-table')).toHaveClass(
			'hidden',
			'lg:block',
		);
		expect(screen.getByTestId('roster-card-list')).toHaveClass('lg:hidden');
	});

	it('shows name, email and status on the card, and drops Added and Shifts', () => {
		// Reference data, deliberately omitted below lg — the coordinator on a
		// phone is scanning for a person, not auditing shift counts.
		render(<VolunteersPage />);

		expect(cardList().getByText('Maria Garcia')).toBeInTheDocument();
		expect(cardList().getByText('maria@example.com')).toBeInTheDocument();
		expect(cardList().getByText('No account yet')).toBeInTheDocument();
		expect(cardList().queryByText('12')).not.toBeInTheDocument();
		expect(
			cardList().queryByText(new Date(VOLUNTEER.addedAt).toLocaleDateString()),
		).not.toBeInTheDocument();
	});

	it('keeps exactly one interactive control per card row', () => {
		// The approved spec moves Remove into the T27 detail dialog because a
		// button inside a full-width TAPPABLE row is a nested interactive target.
		// T27 does not exist, so the row is not tappable and the hazard does not
		// arise — but the row must still never grow a second control, or the
		// hazard arrives without anyone re-reading the spec.
		render(<VolunteersPage />);

		expect(cardList().getAllByRole('button')).toHaveLength(1);
	});

	it('keeps Remove reachable on mobile while T27 is unbuilt', () => {
		// Deliberate deviation, recorded in the design doc: shipping the card list
		// without this would make a phone strictly less capable than it is today.
		render(<VolunteersPage />);

		expect(
			cardList().getByRole('button', {
				name: 'Remove Maria Garcia from your roster',
			}),
		).toBeInTheDocument();
	});

	it('wires each tree’s Remove to its OWN row', async () => {
		// This ship extracted Remove into a shared component and rendered it in
		// TWO trees from one map. That is exactly the refactor where a stale
		// closure sends the wrong id, and no test clicked the button before now —
		// every remove test drove onSuccess directly.
		const second = { ...VOLUNTEER, id: 'ov-2', displayName: 'Ada Lovelace' };
		mocks.useListQuery.mockReturnValue(
			listResult({
				data: { volunteers: [VOLUNTEER, second], nextCursor: null },
			}),
		);
		const user = userEvent.setup();
		render(<VolunteersPage />);

		await user.click(
			table().getByRole('button', {
				name: 'Remove Ada Lovelace from your roster',
			}),
		);
		expect(mocks.removeMutate).toHaveBeenLastCalledWith({
			volunteerId: 'ov-2',
		});

		await user.click(
			cardList().getByRole('button', {
				name: 'Remove Maria Garcia from your roster',
			}),
		);
		expect(mocks.removeMutate).toHaveBeenLastCalledWith({
			volunteerId: 'ov-1',
		});
	});

	it('advances the cursor from either tree’s Load more', async () => {
		// Same extraction hazard as Remove: two instances, one handler.
		mocks.useListQuery.mockReturnValue(
			listResult({ data: { volunteers: [VOLUNTEER], nextCursor: 'ov-9' } }),
		);
		const user = userEvent.setup();
		render(<VolunteersPage />);

		await user.click(cardList().getByRole('button', { name: 'Load more' }));

		// The cursor is internal state; the observable effect is that the list
		// query is re-issued with it.
		expect(mocks.useListQuery).toHaveBeenLastCalledWith(
			expect.objectContaining({ cursor: 'ov-9' }),
			expect.anything(),
		);
	});

	it('disables only the row being removed, not every row', () => {
		// Gating on the bare isPending greys out the whole list on one click —
		// worst on the card list, where Remove is half the row.
		const second = { ...VOLUNTEER, id: 'ov-2', displayName: 'Ada Lovelace' };
		mocks.useListQuery.mockReturnValue(
			listResult({
				data: { volunteers: [VOLUNTEER, second], nextCursor: null },
			}),
		);
		mocks.useRemoveMutation.mockImplementation(() => ({
			mutate: mocks.removeMutate,
			isPending: true,
			variables: { volunteerId: 'ov-2' },
		}));
		render(<VolunteersPage />);

		expect(
			table().getByRole('button', {
				name: 'Remove Ada Lovelace from your roster',
			}),
		).toBeDisabled();
		expect(
			table().getByRole('button', {
				name: 'Remove Maria Garcia from your roster',
			}),
		).toBeEnabled();
	});

	it('renders a card-shaped skeleton, not the table one, below lg', () => {
		// A table-shaped skeleton reserves the wrong height for a card row, so the
		// list reflows the moment data lands — the exact failure the desktop
		// skeleton exists to prevent.
		mocks.useListQuery.mockReturnValue(listResult({ isLoading: true }));
		render(<VolunteersPage />);

		expect(screen.getByTestId('roster-skeleton-cards')).toBeInTheDocument();
	});
});

describe('VolunteersPage accessibility (T29)', () => {
	beforeEach(() => {
		mocks.useListQuery.mockReturnValue(
			listResult({ data: { volunteers: [VOLUNTEER], nextCursor: null } }),
		);
		mocks.useCountQuery.mockReturnValue({ data: 1 });
	});

	it('names the target on every Remove button, in both trees', () => {
		// Without this a rotor lists N identical "Remove" buttons with nothing to
		// choose between them. The visible label stays "Remove" per the mockup.
		render(<VolunteersPage />);

		const name = 'Remove Maria Garcia from your roster';
		expect(table().getByRole('button', { name })).toHaveTextContent('Remove');
		expect(cardList().getByRole('button', { name })).toBeInTheDocument();
	});

	it('announces the removal in a live region, not only in a toast', () => {
		// A toast is transient and a screen-reader user may be reading elsewhere
		// when it fires. Mirrors the volunteer-side leave control on /app/profile.
		render(<VolunteersPage />);

		const live = screen.getByRole('status');
		expect(live).toHaveAttribute('aria-live', 'polite');
		expect(live).toHaveClass('sr-only');
		expect(live).toBeEmptyDOMElement();

		act(() => mocks.onRemoveSuccess?.(undefined, { volunteerId: 'ov-1' }));

		expect(screen.getByRole('status')).toHaveTextContent(
			'Maria Garcia removed from your roster.',
		);
	});

	it('announces the restore by name after an undo', () => {
		render(<VolunteersPage />);

		act(() => mocks.onRemoveSuccess?.(undefined, { volunteerId: 'ov-1' }));
		act(() => mocks.onRestoreSuccess?.(undefined, { volunteerId: 'ov-1' }));

		expect(screen.getByRole('status')).toHaveTextContent(
			'Maria Garcia is back on your roster.',
		);
	});
});

describe('VolunteersPage undo (T26 UI half)', () => {
	it('offers Undo and calls volunteers.restore with the same id', () => {
		const options = removeAndReadToast();

		expect(options.action.label).toBe('Undo');
		options.action.onClick();

		expect(mocks.restoreMutate).toHaveBeenCalledWith({ volunteerId: 'ov-1' });
	});

	it('holds the toast longer than sonner default so Undo is reachable', () => {
		// Sonner's default is ~4s. An Undo the coordinator has to notice, read and
		// reach for needs longer than a notice they only have to read.
		expect(removeAndReadToast().duration).toBeGreaterThan(4000);
	});

	it('surfaces a refused undo instead of pretending it worked', async () => {
		// The OrgVolunteerBlock case: the volunteer used the exit on /app/profile
		// between the removal and the Undo, so restore refuses with FORBIDDEN.
		// That refusal is the whole point of the block — it must reach the
		// coordinator, not vanish.
		mocks.useListQuery.mockReturnValue(
			listResult({ data: { volunteers: [VOLUNTEER], nextCursor: null } }),
		);
		render(<VolunteersPage />);

		act(() =>
			mocks.onRestoreError?.({
				message: 'They left your organisation.',
				data: { code: 'FORBIDDEN' },
			}),
		);

		expect(mocks.toastError).toHaveBeenCalledWith(
			'They left your organisation.',
		);
	});

	it('SECURITY: does not leak an internal error string on a failed undo', () => {
		mocks.useListQuery.mockReturnValue(
			listResult({ data: { volunteers: [VOLUNTEER], nextCursor: null } }),
		);
		render(<VolunteersPage />);

		act(() =>
			mocks.onRestoreError?.({
				message: 'Invalid `prisma.orgVolunteer.update()` invocation',
				data: { code: 'INTERNAL_SERVER_ERROR' },
			}),
		);

		expect(mocks.toastError).toHaveBeenCalledWith('Could not undo that.');
		expect(mocks.toastError).not.toHaveBeenCalledWith(
			expect.stringMatching(/prisma/i),
		);
	});

	it('SECURITY: does not leak an internal error string on a failed removal', () => {
		mocks.useListQuery.mockReturnValue(
			listResult({ data: { volunteers: [VOLUNTEER], nextCursor: null } }),
		);
		render(<VolunteersPage />);

		act(() =>
			mocks.onRemoveError?.({
				message: 'Invalid `prisma.orgVolunteer.update()` invocation',
				data: { code: 'INTERNAL_SERVER_ERROR' },
			}),
		);

		expect(mocks.toastError).toHaveBeenCalledWith(
			'Could not remove that volunteer.',
		);
	});

	it('names the right person when two removals are undone out of order', () => {
		// Why the removed-name store is keyed by id rather than holding one "last
		// removed" value: two undo toasts coexist, and a single slot would make
		// the older one confirm the newer one's name.
		const second = { ...VOLUNTEER, id: 'ov-2', displayName: 'Ada Lovelace' };
		mocks.useListQuery.mockReturnValue(
			listResult({
				data: { volunteers: [VOLUNTEER, second], nextCursor: null },
			}),
		);
		render(<VolunteersPage />);

		act(() => mocks.onRemoveSuccess?.(undefined, { volunteerId: 'ov-1' }));
		act(() => mocks.onRemoveSuccess?.(undefined, { volunteerId: 'ov-2' }));
		act(() => mocks.onRestoreSuccess?.(undefined, { volunteerId: 'ov-1' }));

		expect(screen.getByRole('status')).toHaveTextContent(
			'Maria Garcia is back on your roster.',
		);
	});
});
