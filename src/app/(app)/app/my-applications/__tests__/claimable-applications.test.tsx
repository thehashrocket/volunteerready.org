// @vitest-environment jsdom

/**
 * UI coverage for the `ClaimableApplications` card on /app/my-applications.
 *
 * The card is the consent surface for a security fix: `screener.submit` is a
 * publicProcedure taking an arbitrary `submittedByEmail`, so an orphan
 * application is attacker-controllable. The old `linkApplicationsToUser()` bound
 * any matching orphan silently on page load, minting an `APPLICATION` edge that
 * `requireOrgVolunteerRelationship()` accepts as authorization for
 * `profile.getOrgVisibleProfile` and `credentials.issue`. The whole point of
 * this card is that the *user* decides — so its copy (which org, when, what
 * granting it means) and its refusal to render on a failed/empty query are load
 * bearing, not cosmetic.
 *
 * The component is module-private, so it is exercised through the page.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const {
	mockMyApplications,
	mockClaimableApplications,
	mockClaimMutation,
	mockUseUtils,
} = vi.hoisted(() => ({
	mockMyApplications: vi.fn(),
	mockClaimableApplications: vi.fn(),
	mockClaimMutation: vi.fn(),
	mockUseUtils: vi.fn(),
}));

vi.mock('@/lib/trpc/client', () => ({
	trpc: {
		screener: {
			myApplications: { useQuery: mockMyApplications },
			claimableApplications: { useQuery: mockClaimableApplications },
			claimApplication: { useMutation: mockClaimMutation },
		},
		useUtils: mockUseUtils,
	},
}));

import MyApplicationsPage from '../page';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeClaimable(overrides: Record<string, unknown> = {}) {
	return {
		id: 'app-1',
		submittedAt: new Date('2026-01-15T10:00:00Z'),
		organization: { id: 'org-1', name: 'Riverside Animal Shelter' },
		...overrides,
	};
}

type ClaimState = {
	isPending?: boolean;
	isError?: boolean;
	error?: { message: string } | null;
};

function setup({
	claimable = [makeClaimable()] as ReturnType<typeof makeClaimable>[] | null,
	claimableLoading = false,
	claimableError = false,
	claim = {} as ClaimState,
	applications = [] as unknown[],
}: {
	claimable?: ReturnType<typeof makeClaimable>[] | null;
	claimableLoading?: boolean;
	claimableError?: boolean;
	claim?: ClaimState;
	applications?: unknown[];
} = {}) {
	// The parent page's own query must resolve, or the card never mounts.
	mockMyApplications.mockReturnValue({
		isLoading: false,
		isError: false,
		error: null,
		data: applications,
		refetch: vi.fn(),
	});

	mockClaimableApplications.mockReturnValue({
		isLoading: claimableLoading,
		isError: claimableError,
		error: claimableError ? { message: 'boom' } : null,
		// NOTE: on error we deliberately keep `data` populated. react-query
		// retains the last successful payload when a refetch fails, so this is
		// the real shape — and it is what makes the `query.isError` guard
		// load-bearing. Blanking data here made the error test vacuous: the
		// `claimable.length === 0` term alone short-circuited, so the test
		// passed with `query.isError ||` deleted from the component.
		// Populated in EVERY state, including loading and error. react-query keeps
		// the last successful payload across a background refetch, so this is the
		// real shape — and it is what makes the `isLoading` and `isError` terms of
		// the render guard load-bearing. Blanking it made both tests vacuous: the
		// `claimable.length === 0` term alone short-circuited, so each passed with
		// its own guard term deleted from the component.
		data: claimable,
	});

	const mutate = vi.fn();
	const invalidateClaimable = vi.fn().mockResolvedValue(undefined);
	const invalidateMine = vi.fn().mockResolvedValue(undefined);

	mockUseUtils.mockReturnValue({
		screener: {
			claimableApplications: { invalidate: invalidateClaimable },
			myApplications: { invalidate: invalidateMine },
		},
	});

	// Capture the options object so tests can drive onSuccess directly.
	let options: { onSuccess?: () => Promise<void> | void } = {};
	mockClaimMutation.mockImplementation(
		(opts: { onSuccess?: () => Promise<void> | void }) => {
			options = opts ?? {};
			return {
				mutate,
				isPending: claim.isPending ?? false,
				isError: claim.isError ?? false,
				error: claim.error ?? null,
			};
		},
	);

	return {
		mutate,
		invalidateClaimable,
		invalidateMine,
		getOptions: () => options,
	};
}

beforeEach(() => {
	vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Empty / boundary states
// ---------------------------------------------------------------------------

describe('ClaimableApplications — non-rendering states', () => {
	it('renders nothing while a refetch is in flight, even with stale data present', () => {
		// The setup keeps `data` populated (react-query's real background-refetch
		// shape), so `query.isLoading` is the ONLY thing suppressing the card.
		// Mutation-verified: deleting `query.isLoading ||` from the guard turns
		// this red. Without stale data the assertion was satisfied by the
		// zero-length term instead, and the test proved nothing.
		setup({ claimableLoading: true });
		render(<MyApplicationsPage />);

		expect(screen.queryByText(/is this you\?/i)).not.toBeInTheDocument();
		expect(
			screen.queryByText('Riverside Animal Shelter'),
		).not.toBeInTheDocument();
	});

	it('renders nothing — and leaks no error text — when the query errors', () => {
		// Deliberate: a failed candidate lookup is not actionable by the user, and
		// the card is the only thing on the page that names other orgs.
		//
		// The setup keeps stale `data` populated alongside the error (react-query's
		// real failed-refetch shape), so `query.isError` is the ONLY thing
		// suppressing the card here. Mutation-verified: deleting `query.isError ||`
		// from the component turns this test red.
		setup({ claimableError: true });
		render(<MyApplicationsPage />);

		expect(screen.queryByText(/is this you\?/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/boom/i)).not.toBeInTheDocument();
		// Stale candidate rows must not survive the error either.
		expect(
			screen.queryByText('Riverside Animal Shelter'),
		).not.toBeInTheDocument();
	});

	it('renders nothing when there are zero claimable applications', () => {
		setup({ claimable: [] });
		render(<MyApplicationsPage />);

		expect(screen.queryByText(/is this you\?/i)).not.toBeInTheDocument();
	});

	it('renders nothing when the query resolves to undefined data', () => {
		setup({ claimable: null });
		render(<MyApplicationsPage />);

		expect(screen.queryByText(/is this you\?/i)).not.toBeInTheDocument();
	});
});

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe('ClaimableApplications — rendering', () => {
	it('names the organization and submission date for a single candidate', () => {
		// The org name IS the decision input: "do I recognize this?" is
		// unanswerable without it.
		setup();
		render(<MyApplicationsPage />);

		expect(screen.getByText('Is this you?')).toBeInTheDocument();
		expect(screen.getByText('Riverside Animal Shelter')).toBeInTheDocument();
		expect(screen.getByText(/^Submitted .*2026/)).toBeInTheDocument();
	});

	it('SECURITY: warns that claiming exposes the volunteer profile to the org', async () => {
		// Informed consent is the entire security control here. If this sentence
		// disappears the card becomes a meaningless "OK" button.
		setup();
		render(<MyApplicationsPage />);

		expect(
			screen.getByText(/will be able to see your volunteer profile/i),
		).toBeInTheDocument();
	});

	it('uses singular copy for one candidate', () => {
		setup();
		render(<MyApplicationsPage />);

		expect(screen.getByText(/we found an application/i)).toBeInTheDocument();
	});

	it('uses plural copy and one row per candidate for many', () => {
		setup({
			claimable: [
				makeClaimable({
					id: 'app-1',
					organization: { id: 'o1', name: 'Alpha' },
				}),
				makeClaimable({
					id: 'app-2',
					organization: { id: 'o2', name: 'Beta' },
				}),
				makeClaimable({
					id: 'app-3',
					organization: { id: 'o3', name: 'Gamma' },
				}),
			],
		});
		render(<MyApplicationsPage />);

		expect(screen.getByText(/we found applications/i)).toBeInTheDocument();
		expect(
			screen.getAllByRole('button', { name: /add to my account/i }),
		).toHaveLength(3);
	});

	it('falls back to "Unknown organization" when the org relation is missing', () => {
		setup({ claimable: [makeClaimable({ organization: null })] });
		render(<MyApplicationsPage />);

		expect(screen.getByText('Unknown organization')).toBeInTheDocument();
	});
});

// ---------------------------------------------------------------------------
// Page empty state — the `onCountChange` contract
// ---------------------------------------------------------------------------

describe('page empty state vs. pending candidates', () => {
	it('suppresses "No applications yet" while a candidate is offered', () => {
		// This is the feature's PRIMARY first-run state: a volunteer applied
		// anonymously, then signed up. Rendering "No applications yet" directly
		// under "We found an application submitted with your email address" is a
		// flat contradiction, and the contradiction is what pushes the user to
		// ignore the consent card.
		setup({ applications: [], claimable: [makeClaimable()] });
		render(<MyApplicationsPage />);

		expect(screen.getByText('Is this you?')).toBeInTheDocument();
		expect(screen.queryByText('No applications yet')).not.toBeInTheDocument();
	});

	it('renders "No applications yet" when there are no applications and no candidates', () => {
		// The other half of the contract. Without this the suppression could be
		// unconditional — a genuinely empty account would lose its call to action.
		setup({ applications: [], claimable: [] });
		render(<MyApplicationsPage />);

		expect(screen.getByText('No applications yet')).toBeInTheDocument();
	});

	it('still renders the empty state when the candidate query errors', () => {
		// `visibleCount` must report 0 on error, not the stale `data.length`.
		// A failed candidate lookup is not evidence that an application exists, and
		// suppressing the empty state off it would leave the page showing nothing
		// at all — no list, no card, no call to action.
		setup({ applications: [], claimableError: true });
		render(<MyApplicationsPage />);

		expect(screen.getByText('No applications yet')).toBeInTheDocument();
		expect(screen.queryByText('Is this you?')).not.toBeInTheDocument();
	});

	it('still renders the empty state while the candidate query is loading', () => {
		setup({ applications: [], claimableLoading: true });
		render(<MyApplicationsPage />);

		expect(screen.getByText('No applications yet')).toBeInTheDocument();
	});
});

// ---------------------------------------------------------------------------
// Interaction
// ---------------------------------------------------------------------------

describe('ClaimableApplications — claiming', () => {
	it('claims the id of the row that was clicked, not the first row', async () => {
		// A row/id mismatch would attach the wrong org's application — the exact
		// unwanted relationship edge this fix exists to prevent.
		const { mutate } = setup({
			claimable: [
				makeClaimable({
					id: 'app-1',
					organization: { id: 'o1', name: 'Alpha' },
				}),
				makeClaimable({
					id: 'app-2',
					organization: { id: 'o2', name: 'Beta' },
				}),
			],
		});
		render(<MyApplicationsPage />);

		const buttons = screen.getAllByRole('button', {
			name: /add to my account/i,
		});
		await userEvent.click(buttons[1]);

		expect(mutate).toHaveBeenCalledTimes(1);
		expect(mutate).toHaveBeenCalledWith({ id: 'app-2' });
	});

	it('disables EVERY claim button while a claim is in flight', async () => {
		// Double-click / claim-two-at-once guard. The server is idempotent (a
		// second claim matches zero rows), but a second in-flight mutation would
		// surface a spurious "Application not found." to the user.
		setup({
			claimable: [
				makeClaimable({
					id: 'app-1',
					organization: { id: 'o1', name: 'Alpha' },
				}),
				makeClaimable({
					id: 'app-2',
					organization: { id: 'o2', name: 'Beta' },
				}),
			],
			claim: { isPending: true },
		});
		render(<MyApplicationsPage />);

		for (const button of screen.getAllByRole('button', {
			name: /add to my account/i,
		})) {
			expect(button).toBeDisabled();
		}
	});

	it('surfaces an allowlisted mutation error message inline', () => {
		// "Application not found." is what a lost double-claim race produces; the
		// user must see it rather than watch the button do nothing. NOT_FOUND is
		// on the client-safe allowlist, so it passes through verbatim.
		setup({
			claim: {
				isError: true,
				error: {
					message: 'Application not found.',
					data: { code: 'NOT_FOUND' },
				},
			},
		});
		render(<MyApplicationsPage />);

		expect(screen.getByText('Application not found.')).toBeInTheDocument();
	});

	it('SECURITY: does not render an internal error string verbatim', () => {
		// An INTERNAL_SERVER_ERROR carries raw Prisma/database detail. This card
		// is shown to volunteers, so it must fall back to generic copy — matching
		// every other error surface in the app (safeErrorMessage allowlist).
		setup({
			claim: {
				isError: true,
				error: {
					message:
						'Invalid `prisma.volunteerApplication.updateMany()` invocation',
					data: { code: 'INTERNAL_SERVER_ERROR' },
				},
			},
		});
		render(<MyApplicationsPage />);

		expect(screen.queryByText(/prisma/i)).not.toBeInTheDocument();
		expect(
			screen.getByText("We couldn't add that application. Try again."),
		).toBeInTheDocument();
	});

	it('shows no error paragraph on the happy path', () => {
		setup();
		render(<MyApplicationsPage />);

		expect(screen.queryByText(/not found/i)).not.toBeInTheDocument();
	});

	it('announces a claim failure through a live region', () => {
		// The button stays in place and its label is unchanged on failure, so a
		// screen-reader user gets no signal at all unless the message is announced.
		// role="alert" is the only thing that moves focus-free announcement here.
		setup({
			claim: {
				isError: true,
				error: {
					message: 'Application not found.',
					data: { code: 'NOT_FOUND' },
				},
			},
		});
		render(<MyApplicationsPage />);

		expect(screen.getByRole('alert')).toHaveTextContent(
			'Application not found.',
		);
	});

	it('gives each row a distinct accessible name naming its own organization', () => {
		// Every row's VISIBLE label is the same string, so a screen-reader user
		// hears "Add to my account" N times with nothing to tell them which org
		// each grants a relationship edge to — on the one control in the app whose
		// entire purpose is informed consent about a specific org.
		setup({
			claimable: [
				makeClaimable({
					id: 'app-1',
					organization: { id: 'o1', name: 'Alpha' },
				}),
				makeClaimable({
					id: 'app-2',
					organization: { id: 'o2', name: 'Beta' },
				}),
			],
		});
		render(<MyApplicationsPage />);

		// Each org name resolves to exactly one button — proving the labels are
		// per-row, not a shared constant.
		expect(screen.getByRole('button', { name: /Alpha/ })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /Beta/ })).toBeInTheDocument();
		// Leads with the visible label verbatim so voice control still matches what
		// the user reads (WCAG 2.5.3 Label in Name).
		expect(
			screen.getByRole('button', { name: /^Add to my account: Alpha/ }),
		).toBeInTheDocument();
	});

	it('invalidates BOTH the candidate list and the applications list on success', async () => {
		// Only invalidating one leaves the card offering an application the user
		// already claimed — which re-prompts them to consent to something already
		// granted, or hides a row that is now theirs.
		const { invalidateClaimable, invalidateMine, getOptions } = setup();
		render(<MyApplicationsPage />);

		await getOptions().onSuccess?.();

		expect(invalidateClaimable).toHaveBeenCalledTimes(1);
		expect(invalidateMine).toHaveBeenCalledTimes(1);
	});
});
