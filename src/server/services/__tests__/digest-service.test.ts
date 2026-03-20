import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFindManyCronJobRun = vi.fn(async () => null);
const mockFindManyPref = vi.fn(async () => []);
const mockFindManyNotification = vi.fn(async () => []);
const mockFindManyNotifPref = vi.fn(async () => []);
const mockUpdatePref = vi.fn(async () => ({}));
const mockUpdateManyNotification = vi.fn(async () => ({ count: 0 }));
const mockFindManyOrgs = vi.fn(async () => [{ timezone: null }]);

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		cronJobRun: {
			findFirst: (...args: unknown[]) => mockFindManyCronJobRun(...args),
		},
		userDigestPreference: {
			findMany: (...args: unknown[]) => mockFindManyPref(...args),
			update: (...args: unknown[]) => mockUpdatePref(...args),
		},
		notification: {
			findMany: (...args: unknown[]) => mockFindManyNotification(...args),
			updateMany: (...args: unknown[]) => mockUpdateManyNotification(...args),
		},
		notificationPreference: {
			findMany: (...args: unknown[]) => mockFindManyNotifPref(...args),
		},
		organization: {
			findMany: (...args: unknown[]) => mockFindManyOrgs(...args),
		},
	},
}));

// Mock timezone module — default: all timezones match
const mockGetTimezonesMatchingHour = vi.fn((tzs: (string | null)[]) => tzs);
vi.mock('@/server/lib/timezone', () => ({
	getTimezonesMatchingHour: (...args: unknown[]) =>
		mockGetTimezonesMatchingHour(...(args as [(string | null)[], number])),
}));

const mockSendEmail = vi.fn(async () => true);
vi.mock('@/server/lib/email', () => ({
	sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

import { sendDigestEmails } from '../digest-service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePref(
	overrides: Partial<{
		id: string;
		userId: string;
		orgId: string;
		digestFrequency: string;
		lastDigestSentAt: Date | null;
		user: { email: string | null; name: string | null };
		organization: { name: string };
	}> = {},
) {
	return {
		id: overrides.id ?? 'pref-1',
		userId: overrides.userId ?? 'user-1',
		orgId: overrides.orgId ?? 'org-1',
		digestFrequency: overrides.digestFrequency ?? 'DAILY',
		lastDigestSentAt: overrides.lastDigestSentAt ?? null,
		user: overrides.user ?? { email: 'test@example.com', name: 'Test User' },
		organization: overrides.organization ?? { name: 'Test Org' },
	};
}

function makeNotification(
	overrides: Partial<{
		id: string;
		type: string;
		title: string;
		body: string;
		createdAt: Date;
	}> = {},
) {
	return {
		id: overrides.id ?? 'notif-1',
		type: overrides.type ?? 'SHIFT_REMINDER',
		title: overrides.title ?? 'Test notification',
		body: overrides.body ?? 'Body',
		createdAt: overrides.createdAt ?? new Date(),
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('sendDigestEmails', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Default: all timezones match (passthrough)
		mockGetTimezonesMatchingHour.mockImplementation((tzs) => tzs);
		mockFindManyOrgs.mockResolvedValue([{ timezone: null }]);
	});

	it('starts from top when no previous CronJobRun exists', async () => {
		mockFindManyCronJobRun.mockResolvedValueOnce(null);
		mockFindManyPref.mockResolvedValueOnce([]);

		await sendDigestEmails();

		// Verify no cursor was passed to findMany
		expect(mockFindManyPref).toHaveBeenCalledWith(
			expect.not.objectContaining({ cursor: expect.anything() }),
		);
	});

	it('resumes from cursor when previous run has nextCursor', async () => {
		mockFindManyCronJobRun.mockResolvedValueOnce({
			resultSummary: { nextCursor: 'pref-50' },
		});
		mockFindManyPref.mockResolvedValueOnce([]);

		await sendDigestEmails();

		expect(mockFindManyPref).toHaveBeenCalledWith(
			expect.objectContaining({
				cursor: { id: 'pref-50' },
				skip: 1,
			}),
		);
	});

	it('returns nextCursor: null when batch < 100', async () => {
		mockFindManyCronJobRun.mockResolvedValueOnce(null);
		mockFindManyPref.mockResolvedValueOnce([
			makePref({ id: 'pref-1' }),
			makePref({ id: 'pref-2', userId: 'user-2' }),
		]);
		mockFindManyNotification.mockResolvedValue([makeNotification()]);
		mockFindManyNotifPref.mockResolvedValue([]);

		const result = await sendDigestEmails();

		expect(result.nextCursor).toBeNull();
	});

	it('returns nextCursor = last preference id when batch = 100', async () => {
		mockFindManyCronJobRun.mockResolvedValueOnce(null);

		// Generate exactly 100 preferences
		const prefs = Array.from({ length: 100 }, (_, i) =>
			makePref({
				id: `pref-${i}`,
				userId: `user-${i}`,
				user: { email: `u${i}@test.com`, name: `U${i}` },
			}),
		);
		mockFindManyPref.mockResolvedValueOnce(prefs);
		mockFindManyNotification.mockResolvedValue([]);
		mockFindManyNotifPref.mockResolvedValue([]);

		const result = await sendDigestEmails();

		expect(result.nextCursor).toBe('pref-99');
	});

	it('excludes notification types where user opted out of email', async () => {
		mockFindManyCronJobRun.mockResolvedValueOnce(null);
		mockFindManyPref.mockResolvedValueOnce([makePref()]);
		mockFindManyNotifPref.mockResolvedValueOnce([
			{ type: 'APPLICATION_STATUS' },
		]);
		mockFindManyNotification.mockResolvedValueOnce([
			makeNotification({ type: 'SHIFT_REMINDER' }),
		]);

		await sendDigestEmails();

		// Notification query should exclude APPLICATION_STATUS
		expect(mockFindManyNotification).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					type: { notIn: ['APPLICATION_STATUS'] },
				}),
			}),
		);
	});

	it('includes all types when user has no opt-outs (default opt-in)', async () => {
		mockFindManyCronJobRun.mockResolvedValueOnce(null);
		mockFindManyPref.mockResolvedValueOnce([makePref()]);
		mockFindManyNotifPref.mockResolvedValueOnce([]);
		mockFindManyNotification.mockResolvedValueOnce([makeNotification()]);

		await sendDigestEmails();

		// Notification query should NOT have a type filter
		const notifCall = mockFindManyNotification.mock.calls[0][0];
		expect(notifCall.where.type).toBeUndefined();
	});

	it('skips users with no notifications but updates lastDigestSentAt', async () => {
		mockFindManyCronJobRun.mockResolvedValueOnce(null);
		mockFindManyPref.mockResolvedValueOnce([makePref()]);
		mockFindManyNotifPref.mockResolvedValueOnce([]);
		mockFindManyNotification.mockResolvedValueOnce([]);

		const result = await sendDigestEmails();

		expect(result.digestsSent).toBe(0);
		expect(result.usersProcessed).toBe(1);
		expect(mockUpdatePref).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: 'pref-1' },
				data: { lastDigestSentAt: expect.any(Date) },
			}),
		);
		expect(mockSendEmail).not.toHaveBeenCalled();
	});

	it('handles P2025 race condition gracefully', async () => {
		mockFindManyCronJobRun.mockResolvedValueOnce(null);
		mockFindManyPref.mockResolvedValueOnce([makePref()]);
		mockFindManyNotifPref.mockResolvedValueOnce([]);
		mockFindManyNotification.mockResolvedValueOnce([makeNotification()]);
		mockSendEmail.mockResolvedValueOnce(true);
		mockUpdateManyNotification.mockResolvedValueOnce({ count: 1 });
		// P2025 = record was modified/deleted by another process
		mockUpdatePref.mockRejectedValueOnce({ code: 'P2025' });

		const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		const result = await sendDigestEmails();

		expect(result.usersProcessed).toBe(1);
		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining('already modified'),
		);
		consoleSpy.mockRestore();
	});

	it('only processes orgs in matching timezone window', async () => {
		mockFindManyCronJobRun.mockResolvedValueOnce(null);
		// Simulate timezone filter that returns no matching timezones
		mockFindManyOrgs.mockResolvedValueOnce([
			{ timezone: 'America/New_York' },
			{ timezone: 'Asia/Tokyo' },
		]);
		mockGetTimezonesMatchingHour.mockReturnValueOnce([]);

		// The preference query should include an impossible timezone filter
		mockFindManyPref.mockResolvedValueOnce([]);

		const result = await sendDigestEmails();

		expect(result.digestsSent).toBe(0);
		expect(result.usersProcessed).toBe(0);
		// Verify the organization filter was applied to the query
		const prefCall = mockFindManyPref.mock.calls[0][0];
		expect(prefCall.where.organization).toBeDefined();
	});
});
