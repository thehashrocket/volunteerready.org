// @vitest-environment jsdom
/**
 * Component tests for the "Organizations you volunteer with" section (T32).
 *
 * This is a CONSENT surface. An org can put any address it knows on its roster
 * without asking, `sendRosterAddedEmail` tells the recipient they can leave from
 * here, and this section is the only place that promise is kept. Every state it
 * can be in is therefore load-bearing:
 *
 *   - a failed load must NOT read as "you are on nobody's roster"
 *   - a genuinely empty list must NOT grow a card explaining a concept the user
 *     has no instance of
 *   - the destructive action must be confirmed, cancellable, and honest about
 *     what leaving does not do
 *
 * `OrgMemberships` is not exported, so these drive it through `ProfilePage`.
 * Only the `profile` tab mounts by default, which is where the section lives —
 * the credentials and notifications tabs stay unmounted and their queries are
 * never reached.
 */
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	useMemberships: vi.fn(),
	leaveMutate: vi.fn(),
	leavePending: false,
	onSuccess: null as (() => void | Promise<void>) | null,
	onError: null as ((e: { message: string }) => void) | null,
	invalidate: vi.fn(),
	toastSuccess: vi.fn(),
	toastError: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
	useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('@/lib/trpc/client', () => ({
	trpc: {
		profile: {
			getMyProfile: {
				useQuery: () => ({
					data: { profile: null, completeness: null },
					isLoading: false,
					isError: false,
					error: null,
					refetch: vi.fn(),
				}),
			},
			// Undefined keeps the stat-card row (and its next/link Links) out of
			// the tree; this suite is about the roster section below it.
			getMyStats: { useQuery: () => ({ data: undefined }) },
			updateMyProfile: {
				useMutation: () => ({ mutate: vi.fn(), isPending: false }),
			},
			listMyOrgMemberships: { useQuery: () => mocks.useMemberships() },
			leaveOrgRoster: {
				useMutation: (opts: {
					onSuccess: () => void | Promise<void>;
					onError: (e: { message: string }) => void;
				}) => {
					mocks.onSuccess = opts.onSuccess;
					mocks.onError = opts.onError;
					return { mutate: mocks.leaveMutate, isPending: mocks.leavePending };
				},
			},
		},
		useUtils: () => ({
			profile: { listMyOrgMemberships: { invalidate: mocks.invalidate } },
		}),
	},
}));

vi.mock('sonner', () => ({
	toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

import ProfilePage from './page';

const SECTION = 'Organizations you volunteer with';

function membershipsResult(over: Record<string, unknown> = {}) {
	return {
		data: [],
		isLoading: false,
		isError: false,
		isFetching: false,
		error: null,
		refetch: vi.fn(),
		...over,
	};
}

const STAFF_ROW = {
	id: 'ov-staff',
	source: 'STAFF_ADDED' as const,
	createdAt: new Date('2026-03-01T12:00:00Z'),
	organization: { name: 'Riverside Animal Shelter', slug: 'riverside' },
};

const APPLIED_ROW = {
	id: 'ov-applied',
	source: 'APPLIED' as const,
	createdAt: new Date('2026-02-01T12:00:00Z'),
	organization: { name: 'Helping Hands', slug: 'helping-hands' },
};

beforeEach(() => {
	vi.clearAllMocks();
	mocks.leavePending = false;
	mocks.onSuccess = null;
	mocks.onError = null;
	mocks.useMemberships.mockReturnValue(membershipsResult());
});

describe('OrgMemberships — load states', () => {
	it('renders NOTHING while the memberships query is loading', () => {
		// A card that appears empty and then fills in reads, for the half-second
		// it is on screen, as "you are on nobody's roster".
		mocks.useMemberships.mockReturnValue(
			membershipsResult({ isLoading: true, data: undefined }),
		);
		render(<ProfilePage />);

		expect(screen.queryByText(SECTION)).not.toBeInTheDocument();
	});

	it('renders the card WITH an empty state when the volunteer is on no rosters', () => {
		// Deliberately not null. Someone following the roster-added email after
		// staff already removed them lands on a page that must still answer the
		// question, and a volunteer who just left their last roster must not watch
		// the card they were reading vanish — on a consent surface "gone" and
		// "failed to render" look identical.
		render(<ProfilePage />);

		expect(screen.getByText(SECTION)).toBeInTheDocument();
		expect(
			screen.getByText('No organizations have you on a volunteer roster.'),
		).toBeInTheDocument();
		expect(screen.queryAllByRole('listitem')).toHaveLength(0);
	});

	it('SECURITY/CONSENT: a failed load renders an error, NOT the silent empty state', async () => {
		// The one wrong answer this surface can give. `data` is undefined on
		// error, so an error branch placed after the empty check would return
		// null and tell the user nobody has them on a roster.
		mocks.useMemberships.mockReturnValue(
			membershipsResult({
				isError: true,
				data: undefined,
				error: { message: 'boom' },
			}),
		);
		render(<ProfilePage />);

		// QueryErrorCard, so the failure is announced rather than merely drawn:
		// role="alert" is the difference between a screen-reader user learning the
		// consent surface failed and being shown nothing at all.
		expect(screen.getByRole('alert')).toBeInTheDocument();
		expect(
			screen.getByText("Couldn't load your organizations"),
		).toBeInTheDocument();
		expect(
			screen.getByRole('button', { name: 'Try again' }),
		).toBeInTheDocument();
	});

	it('Try again refetches, and is disabled while that refetch is in flight', async () => {
		const refetch = vi.fn();
		mocks.useMemberships.mockReturnValue(
			membershipsResult({ isError: true, data: undefined, refetch }),
		);
		const user = userEvent.setup();
		const { rerender } = render(<ProfilePage />);

		await user.click(screen.getByRole('button', { name: 'Try again' }));
		expect(refetch).toHaveBeenCalledOnce();

		mocks.useMemberships.mockReturnValue(
			membershipsResult({
				isError: true,
				data: undefined,
				isFetching: true,
				refetch,
			}),
		);
		rerender(<ProfilePage />);
		expect(screen.getByRole('button', { name: 'Try again' })).toBeDisabled();
	});
});

describe('OrgMemberships — rows', () => {
	it('lists one row per live membership, each with an org-specific Leave button', () => {
		// Two identically-named "Leave" buttons is an unusable screen reader
		// experience on the one control that destroys something.
		mocks.useMemberships.mockReturnValue(
			membershipsResult({ data: [STAFF_ROW, APPLIED_ROW] }),
		);
		render(<ProfilePage />);

		expect(screen.getByText('Riverside Animal Shelter')).toBeInTheDocument();
		expect(screen.getByText('Helping Hands')).toBeInTheDocument();
		expect(screen.getAllByRole('listitem')).toHaveLength(2);
		expect(
			screen.getByRole('button', {
				name: 'Leave: Riverside Animal Shelter',
			}),
		).toBeInTheDocument();
		expect(
			screen.getByRole('button', {
				name: 'Leave: Helping Hands',
			}),
		).toBeInTheDocument();
	});

	it('explains a STAFF_ADDED row differently from an APPLIED one', () => {
		// "why am I on this list?" is the whole question a staff-added volunteer
		// opens this page with; collapsing the two provenances answers it wrongly
		// for the person who never applied.
		mocks.useMemberships.mockReturnValue(
			membershipsResult({ data: [STAFF_ROW, APPLIED_ROW] }),
		);
		render(<ProfilePage />);

		expect(screen.getByText(/Added by their staff/)).toBeInTheDocument();
		expect(
			screen.getByText(/Added when they approved your application/),
		).toBeInTheDocument();
	});
});

describe('OrgMemberships — confirm then leave', () => {
	async function openConfirm(rows = [STAFF_ROW, APPLIED_ROW]) {
		mocks.useMemberships.mockReturnValue(membershipsResult({ data: rows }));
		const user = userEvent.setup();
		render(<ProfilePage />);
		await user.click(
			screen.getByRole('button', {
				name: 'Leave: Riverside Animal Shelter',
			}),
		);
		return user;
	}

	it('the first click confirms rather than leaving, and is honest about what leaving does NOT do', async () => {
		// Same correction the claim flow's decline row took in v0.34.0.0: do not
		// imply a door that stays shut, and do not imply recorded hours vanish.
		await openConfirm();

		expect(mocks.leaveMutate).not.toHaveBeenCalled();
		expect(
			screen.getByRole('button', {
				name: 'Yes, leave: Riverside Animal Shelter',
			}),
		).toBeInTheDocument();
		expect(
			screen.getByText(
				'Leave this roster? Your recorded hours stay recorded, and they can add you again.',
			),
		).toBeInTheDocument();
	});

	it('confirms only the row that was clicked', async () => {
		await openConfirm();

		// The other row is untouched and still shows its resting affordance.
		expect(
			screen.getByRole('button', {
				name: 'Leave: Helping Hands',
			}),
		).toBeInTheDocument();
		expect(
			screen.queryByRole('button', {
				name: 'Yes, leave: Helping Hands',
			}),
		).not.toBeInTheDocument();
	});

	it('Cancel returns to the resting state without mutating anything', async () => {
		const user = await openConfirm();

		await user.click(
			screen.getByRole('button', {
				name: 'Cancel: stay on the roster for Riverside Animal Shelter',
			}),
		);

		expect(mocks.leaveMutate).not.toHaveBeenCalled();
		expect(
			screen.getByRole('button', {
				name: 'Leave: Riverside Animal Shelter',
			}),
		).toBeInTheDocument();
	});

	it('confirming sends the row own OrgVolunteer id, never a user or org id', async () => {
		const user = await openConfirm();

		await user.click(
			screen.getByRole('button', {
				name: 'Yes, leave: Riverside Animal Shelter',
			}),
		);

		expect(mocks.leaveMutate).toHaveBeenCalledWith({ volunteerId: 'ov-staff' });
	});

	it('a pending leave disables the confirm button, so a double-click cannot double-submit', async () => {
		mocks.useMemberships.mockReturnValue(
			membershipsResult({ data: [STAFF_ROW] }),
		);
		const user = userEvent.setup();
		const { rerender } = render(<ProfilePage />);
		await user.click(
			screen.getByRole('button', {
				name: 'Leave: Riverside Animal Shelter',
			}),
		);

		mocks.leavePending = true;
		rerender(<ProfilePage />);

		const confirm = screen.getByRole('button', {
			name: 'Yes, leave: Riverside Animal Shelter',
		});
		expect(confirm).toBeDisabled();
		expect(confirm).toHaveTextContent('Leaving…');

		await user.click(confirm);
		expect(mocks.leaveMutate).not.toHaveBeenCalled();
	});
});

describe('OrgMemberships — mutation outcomes', () => {
	beforeEach(() => {
		mocks.useMemberships.mockReturnValue(
			membershipsResult({ data: [STAFF_ROW] }),
		);
	});

	it('success closes the confirm, confirms in words, and refetches the list', async () => {
		const user = userEvent.setup();
		render(<ProfilePage />);
		await user.click(
			screen.getByRole('button', {
				name: 'Leave: Riverside Animal Shelter',
			}),
		);

		// The handler is what react-query would call; act() flushes the
		// setConfirmingId(null) it performs.
		await act(async () => {
			await mocks.onSuccess?.();
		});

		expect(mocks.toastSuccess).toHaveBeenCalledWith('You left that roster.');
		// Without the invalidate the row stays on screen and the user cannot tell
		// whether anything happened.
		expect(mocks.invalidate).toHaveBeenCalledOnce();
		expect(
			screen.queryByRole('button', {
				name: 'Yes, leave: Riverside Animal Shelter',
			}),
		).not.toBeInTheDocument();
	});

	it('failure reports it and drops out of the confirm rather than leaving it armed', async () => {
		// A failed leave that stays mid-confirm invites a second click the user
		// thinks is the first.
		const user = userEvent.setup();
		render(<ProfilePage />);
		await user.click(
			screen.getByRole('button', {
				name: 'Leave: Riverside Animal Shelter',
			}),
		);

		await act(async () => {
			mocks.onError?.({
				message: "You're not on that organization's roster.",
				data: { code: 'NOT_FOUND' },
			});
		});

		expect(mocks.toastError).toHaveBeenCalledWith(
			"You're not on that organization's roster.",
		);
		expect(mocks.invalidate).not.toHaveBeenCalled();
		expect(
			screen.queryByRole('button', {
				name: 'Yes, leave: Riverside Animal Shelter',
			}),
		).not.toBeInTheDocument();
	});

	it('SECURITY: an internal error shows generic copy, never the raw server text', async () => {
		// There is no errorFormatter on this tRPC instance, so an unexpected throw
		// inside the service's $transaction arrives carrying the raw Prisma message
		// — constraint and column names — and this surface is shown to volunteers.
		// safeErrorMessage allowlists client-safe codes and drops everything else.
		// Delete the safeErrorMessage call and this test goes red.
		const user = userEvent.setup();
		render(<ProfilePage />);
		await user.click(
			screen.getByRole('button', {
				name: 'Leave: Riverside Animal Shelter',
			}),
		);

		await act(async () => {
			mocks.onError?.({
				message:
					'Invalid `prisma.orgVolunteer.updateMany()` invocation: column "deletedAt" …',
				data: { code: 'INTERNAL_SERVER_ERROR' },
			});
		});

		expect(mocks.toastError).toHaveBeenCalledWith(
			'Could not leave that roster.',
		);
		expect(mocks.toastError).not.toHaveBeenCalledWith(
			expect.stringContaining('prisma.orgVolunteer'),
		);
	});

	it('the section STAYS and states the result once the last membership is gone', async () => {
		// The last-row case. The row goes, the card does not: a card that vanishes
		// under the user leaves a transient toast as the only evidence the leave
		// worked, and that is indistinguishable from a render failure. The rows are
		// what is empty, not the answer.
		const { rerender } = render(<ProfilePage />);
		expect(screen.getAllByRole('listitem')).toHaveLength(1);

		mocks.useMemberships.mockReturnValue(membershipsResult({ data: [] }));
		rerender(<ProfilePage />);

		expect(screen.getByText(SECTION)).toBeInTheDocument();
		expect(
			screen.getByText('No organizations have you on a volunteer roster.'),
		).toBeInTheDocument();
		expect(screen.queryAllByRole('listitem')).toHaveLength(0);
	});
});
