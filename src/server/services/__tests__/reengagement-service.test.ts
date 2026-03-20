import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFindInactiveMembers = vi.fn(async () => []);
const mockMarkReengagementSent = vi.fn(async () => {});
const mockFindManyOpps = vi.fn(async () => []);
const mockFindFirstCronJobRun = vi.fn(async () => null);

vi.mock('@/server/repositories/reengagement-repo', () => ({
	findInactiveMembers: (...args: unknown[]) => mockFindInactiveMembers(...args),
	markReengagementSent: (...args: unknown[]) =>
		mockMarkReengagementSent(...args),
}));

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		volunteerOpportunity: {
			findMany: (...args: unknown[]) => mockFindManyOpps(...args),
		},
		cronJobRun: {
			findFirst: (...args: unknown[]) => mockFindFirstCronJobRun(...args),
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

import { sendReengagementEmails } from '../reengagement-service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMember(
	overrides: Partial<{
		id: string;
		userId: string;
		organizationId: string;
		lastActivityAt: Date | null;
		lastReengagementSegment: string | null;
		user: { email: string | null; name: string | null };
		organization: { name: string };
	}> = {},
) {
	return {
		id: overrides.id ?? 'member-1',
		userId: overrides.userId ?? 'user-1',
		organizationId: overrides.organizationId ?? 'org-1',
		lastActivityAt: overrides.lastActivityAt ?? null,
		lastReengagementSegment: overrides.lastReengagementSegment ?? null,
		user: overrides.user ?? { email: 'vol@test.com', name: 'Test Vol' },
		organization: overrides.organization ?? { name: 'Test Org' },
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('sendReengagementEmails', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockFindFirstCronJobRun.mockResolvedValue(null);
	});

	it('sends 30-day nudge email and marks segment', async () => {
		// Only return member for 30d segment (last call)
		mockFindInactiveMembers
			.mockResolvedValueOnce([]) // 90d
			.mockResolvedValueOnce([]) // 60d
			.mockResolvedValueOnce([makeMember()]); // 30d

		const result = await sendReengagementEmails();

		expect(result.emailsSent).toBe(1);
		expect(mockSendEmail).toHaveBeenCalledTimes(1);
		expect(mockSendEmail).toHaveBeenCalledWith(
			'vol@test.com',
			expect.stringContaining('love to see you'),
			expect.any(String),
		);
		expect(mockMarkReengagementSent).toHaveBeenCalledWith('member-1', '30d');
	});

	it('includes org-scoped opportunities in 60-day email', async () => {
		mockFindInactiveMembers
			.mockResolvedValueOnce([]) // 90d
			.mockResolvedValueOnce([makeMember()]) // 60d
			.mockResolvedValueOnce([]); // 30d

		mockFindManyOpps.mockResolvedValueOnce([
			{ title: 'Beach Cleanup' },
			{ title: 'Food Drive' },
		]);

		const result = await sendReengagementEmails();

		expect(result.emailsSent).toBe(1);
		expect(mockFindManyOpps).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { orgId: 'org-1', status: 'PUBLISHED' },
				take: 3,
			}),
		);
		expect(mockSendEmail).toHaveBeenCalledWith(
			'vol@test.com',
			expect.stringContaining('New opportunities'),
			expect.stringContaining('Beach Cleanup'),
		);
		expect(mockMarkReengagementSent).toHaveBeenCalledWith('member-1', '60d');
	});

	it('sends "we miss you" for 90-day segment', async () => {
		mockFindInactiveMembers
			.mockResolvedValueOnce([makeMember()]) // 90d
			.mockResolvedValueOnce([]) // 60d
			.mockResolvedValueOnce([]); // 30d

		const result = await sendReengagementEmails();

		expect(result.emailsSent).toBe(1);
		expect(mockSendEmail).toHaveBeenCalledWith(
			'vol@test.com',
			expect.stringContaining('miss you'),
			expect.any(String),
		);
		expect(mockMarkReengagementSent).toHaveBeenCalledWith('member-1', '90d');
	});

	it('stops after 90-day segment (no duplicate sends)', async () => {
		// findInactiveMembers excludes already-sent segments via repo query
		mockFindInactiveMembers.mockResolvedValue([]);

		const result = await sendReengagementEmails();

		expect(result.emailsSent).toBe(0);
		expect(mockSendEmail).not.toHaveBeenCalled();
	});

	it('skips members with no email', async () => {
		mockFindInactiveMembers
			.mockResolvedValueOnce([]) // 90d
			.mockResolvedValueOnce([]) // 60d
			.mockResolvedValueOnce([
				makeMember({ user: { email: null, name: null } }),
			]); // 30d

		const result = await sendReengagementEmails();

		expect(result.membersProcessed).toBe(1);
		expect(result.emailsSent).toBe(0);
		expect(mockSendEmail).not.toHaveBeenCalled();
	});

	it('handles P2025 race condition gracefully', async () => {
		mockFindInactiveMembers
			.mockResolvedValueOnce([makeMember()]) // 90d
			.mockResolvedValueOnce([]) // 60d
			.mockResolvedValueOnce([]); // 30d
		mockSendEmail.mockResolvedValueOnce(true);
		mockMarkReengagementSent.mockRejectedValueOnce({ code: 'P2025' });

		const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		const result = await sendReengagementEmails();

		expect(result.membersProcessed).toBe(1);
		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining('already modified'),
		);
		consoleSpy.mockRestore();
	});

	it('resumes from cursor when previous run has nextCursor', async () => {
		mockFindFirstCronJobRun.mockResolvedValueOnce({
			resultSummary: { nextCursor: 'member-50' },
		});
		mockFindInactiveMembers.mockResolvedValue([]);

		await sendReengagementEmails();

		// All 3 segment calls should pass the cursor
		for (const call of mockFindInactiveMembers.mock.calls) {
			expect((call[0] as { cursor: string }).cursor).toBe('member-50');
		}
	});
});
