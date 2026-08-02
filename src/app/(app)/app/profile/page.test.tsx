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
import { act, render, screen, within } from '@testing-library/react';
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
	orgId: 'org-staff',
	reason: 'STAFF_ADDED' as const,
	since: new Date('2026-03-01T12:00:00Z'),
	onRoster: true,
	isStaff: false,
	organization: { name: 'Riverside Animal Shelter', slug: 'riverside' },
};

const APPLIED_ROW = {
	orgId: 'org-applied',
	reason: 'APPLIED' as const,
	since: new Date('2026-02-01T12:00:00Z'),
	onRoster: true,
	isStaff: false,
	organization: { name: 'Helping Hands', slug: 'helping-hands' },
};

/**
 * An org with NO roster row — it holds only an application. Under the id-keyed
 * version this org was invisible here and had no Leave button, which is how an
 * org could deny the remedy by removing the volunteer first.
 */
const APPLICATION_ONLY_ROW = {
	orgId: 'org-app-only',
	reason: 'APPLICATION_ONLY' as const,
	since: new Date('2026-01-15T12:00:00Z'),
	onRoster: false,
	isStaff: false,
	organization: { name: 'Coastal Food Bank', slug: 'coastal-food-bank' },
};

/** Staff at their own org: ORG_MEMBER is exempt from the block (D3). */
const STAFF_MEMBER_ROW = {
	orgId: 'org-i-work-at',
	reason: 'STAFF_ADDED' as const,
	since: new Date('2026-01-01T12:00:00Z'),
	onRoster: true,
	isStaff: true,
	organization: { name: 'My Own Shelter', slug: 'my-own-shelter' },
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
			screen.getByText(
				'No organizations have access to your volunteer profile.',
			),
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

	it('lists an org that has NO roster row, and says why it is there', () => {
		// The reason D1 exists. Under the roster-row-only listing this org was
		// invisible and had no Leave button, so an org could deny the remedy by
		// removing the volunteer first — while the application it still holds kept
		// satisfying requireOrgVolunteerRelationship, and with it credentials.issue
		// and backgroundChecks.initiate.
		mocks.useMemberships.mockReturnValue(
			membershipsResult({ data: [APPLICATION_ONLY_ROW] }),
		);
		render(<ProfilePage />);

		expect(screen.getByText('Coastal Food Bank')).toBeInTheDocument();
		expect(
			screen.getByRole('button', { name: 'Leave: Coastal Food Bank' }),
		).toBeInTheDocument();
		// Deliberately does NOT claim a roster membership that does not exist.
		expect(
			screen.getByText(/You applied to this organization/),
		).toBeInTheDocument();
		expect(screen.queryByText(/roster/i)).not.toBeInTheDocument();
	});
});

describe('OrgMemberships — confirm then leave', () => {
	async function openConfirm(
		rows = [STAFF_ROW, APPLIED_ROW],
		orgName = 'Riverside Animal Shelter',
	) {
		mocks.useMemberships.mockReturnValue(membershipsResult({ data: rows }));
		const user = userEvent.setup();
		render(<ProfilePage />);
		await user.click(screen.getByRole('button', { name: `Leave: ${orgName}` }));
		return user;
	}

	it('the first click confirms rather than leaving, and states what access is lost', async () => {
		// The confirm names what the org LOSES. Until OrgVolunteerBlock landed,
		// leaving revoked nothing durable, so this string could only list what
		// stayed the same and had to end on "they can add you again" — the
		// admission that the control did not work. The inverse clause is now the
		// load-bearing one, and is asserted separately below.
		await openConfirm();

		expect(mocks.leaveMutate).not.toHaveBeenCalled();
		expect(
			screen.getByRole('button', {
				name: 'Yes, leave: Riverside Animal Shelter',
			}),
		).toBeInTheDocument();
		expect(
			screen.getByText(
				"Leave and remove their access? They won't be able to add you back, schedule you, see your profile, or request a background check. Shifts you're already booked on stay booked, and hours you've volunteered stay recorded. You can rejoin any time by applying or signing up for a shift.",
			),
		).toBeInTheDocument();
	});

	it('the confirm discloses that upcoming shifts survive the departure', async () => {
		await openConfirm();

		// leaveOrgRoster writes nothing to ShiftSignup, and markAttendance
		// authorizes through requireAttendanceAccess, which is SHIFT-scoped rather
		// than org-scoped — so the org still has this person on next Saturday's
		// shift and can still mark them attended. "They won't be able to schedule
		// you" is true only of NEW assignments; without this clause a reader
		// reasonably assumes existing bookings were cancelled.
		expect(
			screen.getByText(/Shifts you're already booked on stay booked/),
		).toBeInTheDocument();
	});

	it('the confirm discloses that the block is reversible by the volunteer', async () => {
		await openConfirm();

		// Three ordinary volunteer actions call liftOrgVolunteerBlock — applying,
		// claiming an application, and signing up for a shift — and the
		// marketplace is cross-org, so someone could hand access back months later
		// without registering whose listing they answered. Promising an absolute
		// and letting them discover it was conditional is the failure this consent
		// surface exists to avoid.
		expect(
			screen.getByText(
				/You can rejoin any time by applying or signing up for a shift\./,
			),
		).toBeInTheDocument();
	});

	it('the confirm promises no re-add, and the card names every capability', async () => {
		// Two halves of one decision, so they are pinned together — splitting them
		// lets a future copy edit satisfy one and quietly break the other.
		await openConfirm();

		// (1) "add you back" is the clause that distinguishes this control from the
		// version that revoked nothing. If it goes, so has the guarantee. It leads
		// the list on purpose — a skimmer stops before a fourth item.
		expect(
			screen.getByText(/won't be able to add you back/),
		).toBeInTheDocument();

		// (2) The card names background checks too. It was omitted at first, to
		// avoid alarming people at rest, with the full list kept for the confirm —
		// but the card is the stay-or-go decision and the confirm is reachable only
		// by people already leaving, so that showed the most consent-material fact
		// only to those who had decided to go. The alarm concern is handled by
		// loss-framing ("Leaving removes all of it"), not by omission.
		expect(
			screen.getByText(
				/These organizations can schedule you for shifts, see your volunteer profile, and request a background check\. Leaving removes all of it\./,
			),
		).toBeInTheDocument();
	});

	it('does NOT promise revocation to staff at their own org', async () => {
		// D3. `findOrgVolunteerRelationship` exempts ORG_MEMBER from the block,
		// deliberately, so a coordinator does not lock themselves out of their own
		// org by leaving its volunteer roster. For that person the standard confirm
		// is simply false — they would press a destructive button, read that access
		// was removed, and nothing would have changed.
		await openConfirm([STAFF_MEMBER_ROW], 'My Own Shelter');

		expect(
			screen.getByText(
				/You're on their staff, so this does not change your staff access/,
			),
		).toBeInTheDocument();

		// Scoped to the ROW, not the document: the card description above
		// legitimately names background checks for everyone. What must not appear
		// is the standard confirm's promise, inside this row, for this person.
		const row = screen.getByRole('listitem');
		expect(within(row).queryByText(/add you back/)).not.toBeInTheDocument();
		expect(within(row).queryByText(/won't be able to/)).not.toBeInTheDocument();
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

	it('confirming sends the row own orgId, never a user or roster-row id', async () => {
		const user = await openConfirm();

		await user.click(
			screen.getByRole('button', {
				name: 'Yes, leave: Riverside Animal Shelter',
			}),
		);

		expect(mocks.leaveMutate).toHaveBeenCalledWith({ orgId: 'org-staff' });
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

		expect(mocks.toastSuccess).toHaveBeenCalledWith(
			'You left that organization.',
		);
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
		// The server's errorFormatter redacts this before it is serialized, so a
		// real browser would not receive the Prisma text at all. This test mocks
		// the hook directly and therefore bypasses that half deliberately — which
		// is the point: it pins the CLIENT guard on its own, so removing
		// safeErrorMessage here still goes red even though the server would have
		// covered for it. Both halves are tested where they live.
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
			screen.getByText(
				'No organizations have access to your volunteer profile.',
			),
		).toBeInTheDocument();
		expect(screen.queryAllByRole('listitem')).toHaveLength(0);
	});
});
