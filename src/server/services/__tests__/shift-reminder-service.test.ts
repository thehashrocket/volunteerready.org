import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFindManySignups = vi.fn(async () => []);
const mockUpdateSignup = vi.fn(async () => ({}));
const mockFindManyOrgs = vi.fn(async () => []);

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		shiftSignup: {
			findMany: (...args: unknown[]) => mockFindManySignups(...args),
			update: (...args: unknown[]) => mockUpdateSignup(...args),
		},
		organization: {
			findMany: (...args: unknown[]) => mockFindManyOrgs(...args),
		},
	},
}));

const mockSendEmail = vi.fn(async () => true);
vi.mock('@/server/lib/email', () => ({
	sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

vi.mock('@/server/lib/html', () => ({
	escapeHtml: (s: string) => s,
}));

// Mock timezone module to control which timezones match
const mockGetTimezonesMatchingHour = vi.fn((tzs: (string | null)[]) => tzs);
vi.mock('@/server/lib/timezone', () => ({
	getTimezonesMatchingHour: (...args: unknown[]) =>
		mockGetTimezonesMatchingHour(...(args as [(string | null)[], number])),
}));

import { sendShiftReminders } from '../shift-reminder-service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSignup(
	overrides: Partial<{
		id: string;
		user: { email: string | null; name: string | null };
		shift: {
			title: string;
			startTime: Date;
			endTime: Date;
			location: string | null;
			isRemote: boolean;
			organization: { name: string; timezone: string | null };
		};
	}> = {},
) {
	return {
		id: overrides.id ?? 'signup-1',
		user: overrides.user ?? { email: 'vol@test.com', name: 'Volunteer' },
		shift: overrides.shift ?? {
			title: 'Morning Shift',
			startTime: new Date(),
			endTime: new Date(),
			location: '123 Main St',
			isRemote: false,
			organization: { name: 'Test Org', timezone: null },
		},
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('sendShiftReminders', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Default: all timezones match (passthrough)
		mockGetTimezonesMatchingHour.mockImplementation((tzs) => tzs);
		mockFindManyOrgs.mockResolvedValue([{ timezone: null }]);
	});

	it('only processes signups for orgs in matching timezone', async () => {
		// Simulate that timezone filter returns null (UTC) as matching
		mockFindManyOrgs.mockResolvedValueOnce([
			{ timezone: null },
			{ timezone: 'America/New_York' },
		]);
		mockGetTimezonesMatchingHour.mockReturnValueOnce([null]);
		mockFindManySignups.mockResolvedValueOnce([]);

		await sendShiftReminders();

		// The findMany call should include an organization filter
		const findManyCall = mockFindManySignups.mock.calls[0][0];
		expect(findManyCall.where.shift.organization).toBeDefined();
	});

	it('applies take:500 safety cap to the query', async () => {
		mockFindManySignups.mockResolvedValueOnce([]);

		await sendShiftReminders();

		const findManyCall = mockFindManySignups.mock.calls[0][0];
		expect(findManyCall.take).toBe(500);
	});

	it('processes null timezone orgs at UTC hour', async () => {
		mockFindManyOrgs.mockResolvedValueOnce([{ timezone: null }]);
		mockGetTimezonesMatchingHour.mockReturnValueOnce([null]);
		mockFindManySignups.mockResolvedValueOnce([makeSignup()]);

		const result = await sendShiftReminders();

		expect(result.remindersSent).toBe(1);
		expect(mockSendEmail).toHaveBeenCalledTimes(1);
		// SECURITY: the option must actually REACH sendEmail. The source scan in
		// unclaimed-guard-optin.test.ts proves which files mention it; only a
		// call-site assertion proves it is passed. Without this, commenting the
		// argument out leaves the whole suite green — proven by mutation.
		expect(mockSendEmail).toHaveBeenCalledWith(
			expect.any(String),
			expect.any(String),
			expect.any(String),
			{ suppressUnclaimed: true },
		);
	});

	it('sends email with org timezone in time formatting', async () => {
		const signup = makeSignup({
			shift: {
				title: 'Evening Shift',
				startTime: new Date('2026-03-20T22:00:00Z'),
				endTime: new Date('2026-03-21T02:00:00Z'),
				location: null,
				isRemote: false,
				organization: { name: 'NYC Org', timezone: 'America/New_York' },
			},
		});
		mockFindManySignups.mockResolvedValueOnce([signup]);

		await sendShiftReminders();

		// Email should have been sent
		expect(mockSendEmail).toHaveBeenCalledTimes(1);
		expect(mockUpdateSignup).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: 'signup-1' },
				data: { reminderSentAt: expect.any(Date) },
			}),
		);
	});
});
