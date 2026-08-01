// @vitest-environment jsdom
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	useListQuery: vi.fn(),
	useCountQuery: vi.fn(),
	useDetailQuery: vi.fn(),
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
	onAddSuccess: null as (() => void) | null,
	onRemoveError: null as ((e: unknown) => void) | null,
	onRestoreError: null as ((e: unknown) => void) | null,
}));

vi.mock('@/lib/trpc/client', () => ({
	trpc: {
		volunteers: {
			list: { useQuery: mocks.useListQuery },
			count: { useQuery: mocks.useCountQuery },
			getById: { useQuery: mocks.useDetailQuery },
			remove: { useMutation: mocks.useRemoveMutation },
			restore: { useMutation: mocks.useRestoreMutation },
			add: {
				useMutation: (opts: { onSuccess: (r: unknown) => void }) => {
					// Captured so these tests can land an add without a server. The
					// DIALOG owns this mutation, so driving it exercises both halves:
					// the dialog's own running count and the page's batch bookkeeping.
					mocks.onAddSuccess = () =>
						opts.onSuccess({ notified: false, displayName: 'Ada Lovelace' });
					return { mutate: vi.fn(), isPending: false };
				},
			},
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
	mocks.useDetailQuery.mockReturnValue(detailResult());
});

/**
 * The detail dialog fetches its own data — the page hands it only an id and a
 * name. These tests drive the query mock directly rather than through the page,
 * which is the point: nothing the roster list does can reach into the dialog.
 */
function detailResult(over: Record<string, unknown> = {}) {
	return {
		data: {
			id: VOLUNTEER.id,
			displayName: VOLUNTEER.displayName,
			email: VOLUNTEER.email,
			phone: '555-0100',
			accountState: VOLUNTEER.accountState,
			source: VOLUNTEER.source,
			addedAt: VOLUNTEER.addedAt,
			totalHours: 7.5,
			shiftCount: 1,
			shifts: [
				{
					shiftId: 'sh-1',
					title: 'Saturday morning',
					startTime: new Date('2026-03-07T09:00:00Z'),
					endTime: new Date('2026-03-07T12:00:00Z'),
					hours: 3,
				},
			],
		},
		isLoading: false,
		isError: false,
		isFetching: false,
		error: null,
		refetch: vi.fn(),
		...over,
	};
}

/** The detail dialog, once open. Its content duplicates every row's text. */
function dialog() {
	return within(screen.getByRole('dialog'));
}

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

	it("the empty state's action opens the page's ONE add form (T25)", async () => {
		// The empty state used to mount its own `AddVolunteerDialog`. That was
		// harmless while the form closed on every success, and a live bug once it
		// stayed open: this branch unmounts on the first add and would take the
		// half-typed second volunteer with it. `open` now lives on the page.
		//
		// Reached by testid, not by role: this button and the header's share the
		// accessible name `Add volunteer`, so a role query silently opens the
		// header's instead and the test passes against the very design it exists
		// to rule out.
		const user = userEvent.setup();
		render(<VolunteersPage />);

		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

		await user.click(screen.getByTestId('empty-roster-add-volunteer'));

		expect(screen.getByRole('dialog')).toBeInTheDocument();
		expect(screen.getByLabelText('Name')).toBeInTheDocument();
	});

	it('carries the batch result out of the form that produced it', async () => {
		// Everything confirming a batch landed dies when the form closes: the
		// toasts have expired and the running count unmounts with the dialog. The
		// notice is the only thing left, and it is what stops "3 added" being
		// followed by a list that looks empty.
		const user = userEvent.setup();
		render(<VolunteersPage />);

		await user.click(screen.getByTestId('empty-roster-add-volunteer'));
		act(() => {
			mocks.onAddSuccess?.();
			mocks.onAddSuccess?.();
		});
		await user.click(screen.getByRole('button', { name: 'Done' }));

		// TWICE, deliberately: the visible notice and the page's `sr-only`
		// announcer. A screen-reader user gets it spoken; everyone else gets it on
		// screen after the count that said it has gone.
		expect(
			screen.getAllByText('2 volunteers added to your roster.'),
		).toHaveLength(2);
		expect(screen.getByRole('status')).toHaveTextContent(
			'2 volunteers added to your roster.',
		);
	});

	it('offers a way out when a search filter is hiding the new rows', async () => {
		// The dead end this exists for: `refresh()` keeps `search`, so rows just
		// added may not match it and the list reads as "No volunteers match that
		// search." — an empty state that renders no add button.
		const user = userEvent.setup();
		const { rerender } = render(<VolunteersPage />);

		await user.type(screen.getByLabelText('Search volunteers'), 'zzz');
		rerender(<VolunteersPage />);

		await user.click(screen.getByRole('button', { name: /add volunteer/i }));
		act(() => {
			mocks.onAddSuccess?.();
		});
		await user.click(screen.getByRole('button', { name: 'Done' }));

		expect(
			screen.getAllByText('1 volunteer added to your roster.').length,
		).toBeGreaterThan(0);
		await user.click(
			screen.getByRole('button', { name: 'Clear search to see them' }),
		);
		rerender(<VolunteersPage />);

		expect(screen.getByLabelText('Search volunteers')).toHaveValue('');
	});

	it('starts a fresh batch count on the next open', async () => {
		const user = userEvent.setup();
		render(<VolunteersPage />);

		await user.click(screen.getByTestId('empty-roster-add-volunteer'));
		act(() => {
			mocks.onAddSuccess?.();
		});
		await user.click(screen.getByRole('button', { name: 'Done' }));
		expect(
			screen.getAllByText('1 volunteer added to your roster.').length,
		).toBeGreaterThan(0);

		// Reopening clears the previous batch's VISIBLE notice, so a second session
		// cannot inherit the first one's number. Down from two matches to one: the
		// `sr-only` announcer deliberately keeps its last message. A live region
		// only speaks on CHANGE, so stale text there is never re-announced — and
		// clearing it would wipe an unrelated remove/undo announcement, which
		// shares the same element.
		await user.click(screen.getByTestId('empty-roster-add-volunteer'));
		const remaining = screen.queryAllByText(
			'1 volunteer added to your roster.',
		);
		expect(remaining).toHaveLength(1);
		expect(remaining[0]).toHaveClass('sr-only');
	});

	it('keeps that form mounted once the first add empties the empty state', async () => {
		// The actual regression. Opening from the empty state and then having the
		// roster go non-empty is the sequence that unmounted the old instance.
		const user = userEvent.setup();
		const { rerender } = render(<VolunteersPage />);

		await user.click(screen.getByTestId('empty-roster-add-volunteer'));
		await user.type(screen.getByLabelText('Name'), 'Grace Hopper');

		// The add lands: the list now returns a row, so the empty-state branch —
		// and with it the button that opened this form — is gone.
		mocks.useListQuery.mockReturnValue(
			listResult({ data: { volunteers: [VOLUNTEER], nextCursor: null } }),
		);
		mocks.useCountQuery.mockReturnValue({ data: 1 });
		rerender(<VolunteersPage />);

		expect(
			screen.queryByTestId('empty-roster-add-volunteer'),
		).not.toBeInTheDocument();
		// The form, and the name already typed into it, survive.
		expect(screen.getByRole('dialog')).toBeInTheDocument();
		expect(screen.getByLabelText('Name')).toHaveValue('Grace Hopper');
	});

	it('shows DIFFERENT copy for a filtered-empty result', async () => {
		// Conflating the two makes a working filter look like an empty roster.
		const { rerender } = render(<VolunteersPage />);
		const user = userEvent.setup();

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

	it('keeps exactly one interactive control per card row, and it is the row', () => {
		// The count alone is a weak assertion — it stayed at 1 across T27, which
		// deleted one button and added another. Naming the survivor is what makes
		// it catch either regression: a reintroduced Remove (2) and a lost
		// trigger (0) both fail, and so does swapping which one is there.
		render(<VolunteersPage />);

		const buttons = cardList().getAllByRole('button');
		expect(buttons).toHaveLength(1);
		expect(buttons[0]).toHaveAccessibleName('View Maria Garcia');
	});

	it('moves Remove off the card and into the dialog', () => {
		// T28 shipped `Remove` on the card as a tracked deviation, because until
		// T27 existed the spec's placement would have left a phone unable to
		// remove anyone at all. T27 undoes it: the row is the tap target, and a
		// nested <button> inside a <button> is invalid markup besides.
		render(<VolunteersPage />);

		expect(
			cardList().queryByRole('button', {
				name: 'Remove Maria Garcia from your roster',
			}),
		).not.toBeInTheDocument();
		expect(
			cardList().getByRole('button', { name: 'View Maria Garcia' }),
		).toBeInTheDocument();
	});

	it('wires each tree’s control to its OWN row', async () => {
		// Remove is a shared component rendered from one map, and the card's
		// trigger is now a second such control. That is exactly the shape where a
		// stale closure sends the wrong id.
		//
		// Every click targets the SECOND row on purpose: clicking the first would
		// pass even if the handler closed over `volunteers[0]`, which is the bug
		// this test exists to catch.
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

		// The card tree no longer has a Remove; its one control opens the dialog,
		// so the id it carries is asserted through the query the dialog issues.
		await user.click(
			cardList().getByRole('button', { name: 'View Ada Lovelace' }),
		);
		expect(mocks.useDetailQuery).toHaveBeenLastCalledWith({
			volunteerId: 'ov-2',
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

	it('names the volunteer on each tree’s row control', () => {
		// Without this a rotor lists N identical "Remove" buttons — or, on the
		// card tree, N buttons whose name is the row's three facts run together
		// with no indication of what pressing one does.
		render(<VolunteersPage />);

		expect(
			table().getByRole('button', {
				name: 'Remove Maria Garcia from your roster',
			}),
			// The visible label stays "Remove" per the mockup; only the accessible
			// name carries the target.
		).toHaveTextContent('Remove');
		expect(
			cardList().getByRole('button', { name: 'View Maria Garcia' }),
		).toBeInTheDocument();
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

describe('VolunteersPage detail dialog (T27)', () => {
	beforeEach(() => {
		mocks.useListQuery.mockReturnValue(
			listResult({ data: { volunteers: [VOLUNTEER], nextCursor: null } }),
		);
		mocks.useCountQuery.mockReturnValue({ data: 1 });
	});

	it('opens from the desktop name button', async () => {
		// A real <button>, not just a click handler on the <tr>: the row handler
		// is mouse-only, and this is the roster's keyboard path to the dialog.
		const user = userEvent.setup();
		render(<VolunteersPage />);

		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		await user.click(table().getByRole('button', { name: 'Maria Garcia' }));

		expect(screen.getByRole('dialog')).toBeInTheDocument();
		expect(mocks.useDetailQuery).toHaveBeenLastCalledWith({
			volunteerId: 'ov-1',
		});
	});

	it('opens from a click anywhere else in the desktop row', async () => {
		const user = userEvent.setup();
		render(<VolunteersPage />);

		await user.click(table().getByText('maria@example.com'));

		expect(screen.getByRole('dialog')).toBeInTheDocument();
	});

	it('opens from the mobile card', async () => {
		const user = userEvent.setup();
		render(<VolunteersPage />);

		await user.click(
			cardList().getByRole('button', { name: 'View Maria Garcia' }),
		);

		expect(screen.getByRole('dialog')).toBeInTheDocument();
	});

	it('does NOT open when Remove is clicked in the row', async () => {
		// The row opens the dialog, so Remove has to stop the event propagating.
		// Without it, removing someone opens their detail on the way out — over a
		// row that is already gone.
		const user = userEvent.setup();
		render(<VolunteersPage />);

		await user.click(
			table().getByRole('button', {
				name: 'Remove Maria Garcia from your roster',
			}),
		);

		expect(mocks.removeMutate).toHaveBeenCalledWith({ volunteerId: 'ov-1' });
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
	});

	it('shows the org-scoped shift history and hours', async () => {
		const user = userEvent.setup();
		render(<VolunteersPage />);
		await user.click(table().getByRole('button', { name: 'Maria Garcia' }));

		expect(dialog().getByText('Saturday morning')).toBeInTheDocument();
		// The header figure and the row figure come from the same rows, which is
		// the whole reason the query is uncapped.
		expect(dialog().getByText('1 attended · 7.5 hours')).toBeInTheDocument();
		expect(dialog().getByText('3 hours')).toBeInTheDocument();
		// The STAFF-voiced Record. The volunteer-voiced one ('Added by their
		// staff' / 'Added when they approved your application') is second-person
		// TO THE VOLUNTEER and reads inverted on this surface — it shipped here
		// once and was caught in review.
		expect(dialog().getByText('Added by your team')).toBeInTheDocument();
		expect(
			dialog().queryByText('Added by their staff'),
		).not.toBeInTheDocument();
	});

	it('distinguishes an empty history from a failed load', async () => {
		// Ordering matters more than either branch: without an error branch this
		// falls through to "No shifts recorded here yet", which is a broken
		// dialog that reads as a fact about the volunteer.
		mocks.useDetailQuery.mockReturnValue(
			detailResult({
				data: undefined,
				isError: true,
				error: { message: 'boom', data: { code: 'INTERNAL_SERVER_ERROR' } },
			}),
		);
		const user = userEvent.setup();
		render(<VolunteersPage />);
		await user.click(table().getByRole('button', { name: 'Maria Garcia' }));

		expect(
			dialog().getByText(/Couldn.t load this volunteer/),
		).toBeInTheDocument();
		expect(dialog().queryByText(/No shifts recorded/)).not.toBeInTheDocument();
	});

	it('SECURITY: never renders an internal error message verbatim', async () => {
		// A tRPC error can carry database text. safeErrorMessage allowlists the
		// client-safe codes; INTERNAL_SERVER_ERROR is not one.
		mocks.useDetailQuery.mockReturnValue(
			detailResult({
				data: undefined,
				isError: true,
				error: {
					message: 'relation "OrgVolunteer" does not exist',
					data: { code: 'INTERNAL_SERVER_ERROR' },
				},
			}),
		);
		const user = userEvent.setup();
		render(<VolunteersPage />);
		await user.click(table().getByRole('button', { name: 'Maria Garcia' }));

		expect(
			screen.queryByText(/relation "OrgVolunteer"/),
		).not.toBeInTheDocument();
		expect(dialog().getByText('Please try again.')).toBeInTheDocument();
	});

	it('removes from the dialog through the page’s one mutation', async () => {
		// Not its own useMutation: the Undo toast, the live announcement and the
		// removedNames bookkeeping all hang off the page's onSuccess, and a
		// second mutation would have to duplicate every one of them.
		const user = userEvent.setup();
		render(<VolunteersPage />);
		await user.click(table().getByRole('button', { name: 'Maria Garcia' }));

		await user.click(
			dialog().getByRole('button', {
				name: 'Remove Maria Garcia from your roster',
			}),
		);

		expect(mocks.removeMutate).toHaveBeenCalledWith({ volunteerId: 'ov-1' });

		// The response lands AFTER the dialog would have closed on its own in a
		// per-dialog-mutation design. Driving it here proves the callback is not
		// orphaned: the toast and the announcement still fire.
		act(() => mocks.onRemoveSuccess?.(undefined, { volunteerId: 'ov-1' }));
		expect(mocks.toastSuccess).toHaveBeenCalledWith(
			'Removed from your roster.',
			expect.objectContaining({ duration: 10_000 }),
		);
		expect(screen.getByRole('status')).toHaveTextContent(
			'Maria Garcia removed from your roster.',
		);
	});

	it('closes when the OPEN volunteer is removed', async () => {
		const user = userEvent.setup();
		render(<VolunteersPage />);
		await user.click(table().getByRole('button', { name: 'Maria Garcia' }));
		expect(screen.getByRole('dialog')).toBeInTheDocument();

		act(() => mocks.onRemoveSuccess?.(undefined, { volunteerId: 'ov-1' }));

		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
	});

	it('stays open when a DIFFERENT volunteer is removed', async () => {
		// Closing unconditionally would be a non-sequitur: a removal can land for
		// a row other than the one on screen (a second tab, or a slow request
		// whose dialog was closed and another opened).
		const second = { ...VOLUNTEER, id: 'ov-2', displayName: 'Ada Lovelace' };
		mocks.useListQuery.mockReturnValue(
			listResult({
				data: { volunteers: [VOLUNTEER, second], nextCursor: null },
			}),
		);
		const user = userEvent.setup();
		render(<VolunteersPage />);
		await user.click(table().getByRole('button', { name: 'Maria Garcia' }));

		act(() => mocks.onRemoveSuccess?.(undefined, { volunteerId: 'ov-2' }));

		expect(screen.getByRole('dialog')).toBeInTheDocument();
	});

	it('says "none yet" when the volunteer has no shifts here', async () => {
		// The empty-history copy is otherwise only ever asserted ABSENT (in the
		// error-ordering test), so nothing proved it renders at all — and it is
		// what most staff-added volunteers will see on day one.
		mocks.useDetailQuery.mockReturnValue(
			detailResult({
				data: {
					...detailResult().data,
					totalHours: 0,
					shiftCount: 0,
					shifts: [],
				},
			}),
		);
		const user = userEvent.setup();
		render(<VolunteersPage />);
		await user.click(table().getByRole('button', { name: 'Maria Garcia' }));

		expect(dialog().getByText('None yet')).toBeInTheDocument();
		expect(
			dialog().getByText(/No shifts recorded here yet/),
		).toBeInTheDocument();
	});

	it('caps the rendered history at 50 and says so, without capping the total', async () => {
		// The whole reason the QUERY is uncapped. If a future edit adds a `take`
		// server-side, the total silently stops matching the roster row's Shifts
		// count — so this asserts the two figures disagree with the RENDERED row
		// count on purpose.
		// The SERVER caps now, so the payload holds 50 while shiftCount says 51 —
		// that gap is the thing under test. A fixture sending 51 rows would be
		// testing a client-side slice that no longer exists.
		const shifts = Array.from({ length: 50 }, (_, i) => ({
			shiftId: `sh-${i}`,
			title: `Shift ${i}`,
			startTime: new Date('2026-03-07T09:00:00Z'),
			endTime: new Date('2026-03-07T10:00:00Z'),
			hours: 1,
		}));
		mocks.useDetailQuery.mockReturnValue(
			detailResult({
				data: {
					...detailResult().data,
					totalHours: 51,
					shiftCount: 51,
					shifts,
				},
			}),
		);
		const user = userEvent.setup();
		render(<VolunteersPage />);
		await user.click(table().getByRole('button', { name: 'Maria Garcia' }));

		// 50 rendered...
		expect(dialog().getAllByRole('listitem')).toHaveLength(50);
		// ...but the header counts all 51, and the notice says the totals do.
		// If a future change caps the QUERY instead, this reads 50 and the
		// dialog silently contradicts the roster row that opened it.
		expect(dialog().getByText('51 attended · 51 hours')).toBeInTheDocument();
		expect(
			dialog().getByText(/Showing the 50 most recent of 51/),
		).toBeInTheDocument();
	});

	it('renders an em dash for a volunteer with no phone or email on file', async () => {
		mocks.useDetailQuery.mockReturnValue(
			detailResult({
				data: { ...detailResult().data, email: null, phone: null },
			}),
		);
		const user = userEvent.setup();
		render(<VolunteersPage />);
		await user.click(table().getByRole('button', { name: 'Maria Garcia' }));

		expect(dialog().getAllByText('\u2014')).toHaveLength(2);
	});

	it('disables the dialog’s Remove while that volunteer’s removal is in flight', async () => {
		mocks.useRemoveMutation.mockImplementation(
			(opts: {
				onSuccess: (d: unknown, v: { volunteerId: string }) => void;
				onError: (e: unknown) => void;
			}) => {
				mocks.onRemoveSuccess = opts.onSuccess;
				mocks.onRemoveError = opts.onError;
				return {
					mutate: mocks.removeMutate,
					isPending: true,
					variables: { volunteerId: 'ov-1' },
				};
			},
		);
		const user = userEvent.setup();
		render(<VolunteersPage />);
		await user.click(table().getByRole('button', { name: 'Maria Garcia' }));

		expect(
			dialog().getByRole('button', {
				name: 'Remove Maria Garcia from your roster',
			}),
		).toBeDisabled();
	});

	it('shows a skeleton while loading, not an empty history', async () => {
		// Without the loading branch this falls through to `if (!data) return null`
		// — a titled dialog with an empty body — and the suite stays green. The
		// loading→error→content ordering is only half-pinned otherwise.
		mocks.useDetailQuery.mockReturnValue(
			detailResult({ data: undefined, isLoading: true }),
		);
		const user = userEvent.setup();
		render(<VolunteersPage />);
		await user.click(table().getByRole('button', { name: 'Maria Garcia' }));

		expect(
			dialog().getByTestId('volunteer-detail-skeleton'),
		).toBeInTheDocument();
		expect(dialog().queryByText(/No shifts recorded/)).not.toBeInTheDocument();
		expect(
			dialog().queryByText(/Couldn.t load this volunteer/),
		).not.toBeInTheDocument();
	});

	it('retries the detail query from the error state', async () => {
		// The only recovery inside the dialog. Unwiring it leaves closing and
		// reopening as the sole way out, and no assertion would notice.
		const refetch = vi.fn();
		mocks.useDetailQuery.mockReturnValue(
			detailResult({
				data: undefined,
				isError: true,
				error: { message: 'boom', data: { code: 'INTERNAL_SERVER_ERROR' } },
				refetch,
			}),
		);
		const user = userEvent.setup();
		render(<VolunteersPage />);
		await user.click(table().getByRole('button', { name: 'Maria Garcia' }));

		await user.click(dialog().getByRole('button', { name: 'Try again' }));

		expect(refetch).toHaveBeenCalled();
	});

	it('leaves the dialog’s Remove enabled while a DIFFERENT volunteer is removed', async () => {
		// The contrast the desktop table already has ('disables only the row being
		// removed'). Without it, dropping the id comparison from `removePending`
		// — so ANY in-flight removal greys out the open dialog — stays green.
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
		const user = userEvent.setup();
		render(<VolunteersPage />);
		await user.click(table().getByRole('button', { name: 'Maria Garcia' }));

		expect(
			dialog().getByRole('button', {
				name: 'Remove Maria Garcia from your roster',
			}),
		).toBeEnabled();
	});

	it('offers exactly one way to dismiss on desktop', () => {
		// DialogContent renders its own X. A footer Close on top of it is a rotor
		// reading "Close, Close" — so the footer Close exists only in the Drawer,
		// where vaul provides no dismiss at all.
		render(<VolunteersPage />);
		act(() => {
			table().getByRole('button', { name: 'Maria Garcia' }).click();
		});

		expect(dialog().getAllByRole('button', { name: 'Close' })).toHaveLength(1);
	});

	it('returns focus to the row that opened it', async () => {
		// There is no DialogTrigger — one dialog serves two trees of rows — so
		// Radix has no node to restore focus to and the page has to. Without
		// this a keyboard user is dropped at the top of the document on every
		// row they open.
		const user = userEvent.setup();
		render(<VolunteersPage />);
		const trigger = table().getByRole('button', { name: 'Maria Garcia' });
		await user.click(trigger);

		await user.click(dialog().getByRole('button', { name: 'Close' }));

		expect(trigger).toHaveFocus();
	});

	it('returns focus to the row’s name button when the ROW was clicked', async () => {
		// A <tr> cannot hold focus, so recording the clicked element verbatim
		// sends focus to <body>. It also went wrong the other way: a click on the
		// name button bubbles to the row, whose handler then ran second and
		// overwrote the button with the <tr>. Both are why the row hands over its
		// [data-row-trigger] instead of itself.
		const user = userEvent.setup();
		render(<VolunteersPage />);
		await user.click(table().getByText('maria@example.com'));

		await user.click(dialog().getByRole('button', { name: 'Close' }));

		expect(table().getByRole('button', { name: 'Maria Garcia' })).toHaveFocus();
	});

	it('returns focus to the mobile card that opened it', async () => {
		const user = userEvent.setup();
		render(<VolunteersPage />);
		const card = cardList().getByRole('button', { name: 'View Maria Garcia' });
		await user.click(card);

		await user.click(dialog().getByRole('button', { name: 'Close' }));

		expect(card).toHaveFocus();
	});
});
