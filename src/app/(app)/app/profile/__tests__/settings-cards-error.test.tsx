// @vitest-environment jsdom
/**
 * The Credentials and Notifications tabs of /app/profile.
 *
 * Both had a loading branch and no error branch, so a failed query fell through
 * to `data ?? []` / an empty Map and rendered as CONTENT — which is worse than a
 * blank card, because the content asserts something false:
 *
 *   - CredentialWallet showed "No credentials yet" to a volunteer whose
 *     background check is verified and in the database, and
 *   - NotificationPreferences showed every toggle at its DEFAULT, so someone who
 *     had muted a notification saw it switched back on.
 *
 * These live in their own file because `page.test.tsx` deliberately mocks only
 * the `profile` router and never mounts these tabs.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	credentials: vi.fn(),
	prefs: vi.fn(),
	digest: vi.fn(),
}));

const ok = (data: unknown) => ({
	data,
	isLoading: false,
	isError: false,
	isFetching: false,
	error: null,
	refetch: vi.fn(),
});

const failed = (code = 'INTERNAL_SERVER_ERROR') => ({
	data: undefined,
	isLoading: false,
	isError: true,
	isFetching: false,
	error: {
		message:
			'Invalid `prisma.volunteerCredential.findMany()` invocation: relation does not exist',
		data: { code },
	},
	refetch: vi.fn(),
});

vi.mock('@tanstack/react-query', () => ({
	useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('@/lib/trpc/client', () => {
	const inertMutation = () => ({ mutate: vi.fn(), isPending: false });
	return {
		trpc: {
			profile: {
				getMyProfile: {
					useQuery: () => ok({ profile: null, completeness: null }),
				},
				getMyStats: { useQuery: () => ({ data: undefined }) },
				getMyUserId: { useQuery: () => ok({ userId: 'u-1' }) },
				updateMyProfile: { useMutation: inertMutation },
				listMyOrgMemberships: { useQuery: () => ok([]) },
				leaveOrgRoster: { useMutation: inertMutation },
			},
			credentials: {
				getMyCredentials: { useQuery: () => mocks.credentials() },
			},
			credentialSharing: {
				listMyTokens: { useQuery: () => ok([]) },
				generate: { useMutation: inertMutation },
				revoke: { useMutation: inertMutation },
			},
			notifications: {
				getPreferences: { useQuery: () => mocks.prefs() },
				getDigestPreference: { useQuery: () => mocks.digest() },
				updatePreference: { useMutation: inertMutation },
				updateDigestPreference: { useMutation: inertMutation },
			},
			useUtils: () => ({
				profile: { listMyOrgMemberships: { invalidate: vi.fn() } },
				notifications: {
					getPreferences: { invalidate: vi.fn() },
					getDigestPreference: { invalidate: vi.fn() },
				},
			}),
		},
	};
});

vi.mock('sonner', () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

import ProfilePage from '../page';

beforeEach(() => {
	vi.clearAllMocks();
	mocks.credentials.mockReturnValue(ok([]));
	mocks.prefs.mockReturnValue(ok([]));
	mocks.digest.mockReturnValue(ok({ frequency: 'WEEKLY' }));
});

describe('CredentialWallet error state', () => {
	it('shows an error, NOT "No credentials yet"', async () => {
		mocks.credentials.mockReturnValue(failed());
		render(<ProfilePage />);

		await userEvent.click(screen.getByRole('tab', { name: /credentials/i }));

		expect(
			screen.getByText("Couldn't load your credentials"),
		).toBeInTheDocument();
		// The lie this branch exists to prevent.
		expect(screen.queryByText('No credentials yet')).not.toBeInTheDocument();
	});

	it('SECURITY: never renders the raw server text', async () => {
		mocks.credentials.mockReturnValue(failed());
		render(<ProfilePage />);

		await userEvent.click(screen.getByRole('tab', { name: /credentials/i }));

		expect(screen.queryByText(/prisma\./i)).not.toBeInTheDocument();
		expect(screen.getByRole('alert')).toHaveTextContent(
			'Something went wrong. Please try again.',
		);
	});
});

describe('NotificationPreferences error state', () => {
	it('shows an error rather than every toggle at its default', async () => {
		mocks.prefs.mockReturnValue(failed());
		render(<ProfilePage />);

		await userEvent.click(screen.getByRole('tab', { name: /notifications/i }));

		expect(
			screen.getByText("Couldn't load your notification preferences"),
		).toBeInTheDocument();
		expect(screen.queryAllByRole('switch')).toHaveLength(0);
	});

	it('treats a failed DIGEST query as a failure too, not just the prefs one', async () => {
		// Two independent queries feed one card. Guarding only the first leaves
		// the digest control defaulting silently — the same bug, one query over.
		mocks.digest.mockReturnValue(failed());
		render(<ProfilePage />);

		await userEvent.click(screen.getByRole('tab', { name: /notifications/i }));

		expect(
			screen.getByText("Couldn't load your notification preferences"),
		).toBeInTheDocument();
	});
});
