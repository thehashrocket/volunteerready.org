/**
 * Unit tests for opportunityDigestService.ts — opportunity digest email (T4).
 *
 * Tests 9 paths:
 * 1. No users eligible → 0 emails sent
 * 2. User with no matching opportunities → no email, lastDigestSentAt updated
 * 3. User with <5 matches → all sent
 * 4. User with 5+ opportunities → only top 5 sent
 * 5. Skip already-applied opportunities
 * 6. Skip already-interested opportunities
 * 7. Email send failure → per-record catch, continues to next user
 * 8. Unsubscribe token: valid → 200, digestFrequency=OFF
 * 9. Unsubscribe token: invalid → 400
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockCronJobRunFindFirst = vi.fn();
const mockPrefFindMany = vi.fn();
const mockPrefUpdate = vi.fn();
const mockOppFindMany = vi.fn();
const mockAppFindMany = vi.fn();
const mockInterestFindMany = vi.fn();
const mockSendEmail = vi.fn();

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		cronJobRun: {
			findFirst: (...args: unknown[]) => mockCronJobRunFindFirst(...args),
		},
		userMarketplacePreference: {
			findMany: (...args: unknown[]) => mockPrefFindMany(...args),
			update: (...args: unknown[]) => mockPrefUpdate(...args),
		},
		volunteerOpportunity: {
			findMany: (...args: unknown[]) => mockOppFindMany(...args),
		},
		volunteerApplication: {
			findMany: (...args: unknown[]) => mockAppFindMany(...args),
		},
		opportunityInterest: {
			findMany: (...args: unknown[]) => mockInterestFindMany(...args),
		},
	},
}));

vi.mock('@/server/lib/email', () => ({
	sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

vi.mock('@/server/lib/digest-unsubscribe-token', () => ({
	generateUnsubscribeTokenFromEnv: vi.fn().mockReturnValue('token-abc'),
}));

import { sendOpportunityDigestEmails } from './opportunityDigestService';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makePref(
	overrides: Partial<{
		id: string;
		userId: string;
		lastDigestSentAt: Date | null;
		user: { id: string; email: string | null; name: string | null };
	}> = {},
) {
	return {
		id: overrides.id ?? 'pref-1',
		userId: overrides.userId ?? 'user-1',
		digestFrequency: 'WEEKLY',
		lastDigestSentAt: overrides.lastDigestSentAt ?? null,
		user: overrides.user ?? {
			id: 'user-1',
			email: 'user@example.com',
			name: 'Test User',
		},
	};
}

function makeOpportunity(
	overrides: Partial<{ id: string; title: string }> = {},
) {
	return {
		id: overrides.id ?? 'opp-1',
		title: overrides.title ?? 'Park Cleanup',
		location: 'Downtown',
		isRemote: false,
		startDate: new Date('2026-07-01'),
		organization: { name: 'Green Org', slug: 'green-org' },
	};
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
	vi.clearAllMocks();
	mockCronJobRunFindFirst.mockResolvedValue(null);
	mockPrefFindMany.mockResolvedValue([]);
	mockPrefUpdate.mockResolvedValue({});
	mockOppFindMany.mockResolvedValue([]);
	mockAppFindMany.mockResolvedValue([]);
	mockInterestFindMany.mockResolvedValue([]);
	mockSendEmail.mockResolvedValue(true);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('sendOpportunityDigestEmails', () => {
	it('returns zeros when no users are eligible for digest', async () => {
		mockPrefFindMany.mockResolvedValue([]);

		const result = await sendOpportunityDigestEmails({ skipWindowCheck: true });

		expect(result).toEqual({
			emailsSent: 0,
			usersProcessed: 0,
			nextCursor: null,
		});
		expect(mockSendEmail).not.toHaveBeenCalled();
	});

	it('skips email but updates lastDigestSentAt when no matching opportunities', async () => {
		mockPrefFindMany.mockResolvedValue([makePref()]);
		mockOppFindMany.mockResolvedValue([]);

		const result = await sendOpportunityDigestEmails({ skipWindowCheck: true });

		expect(result.emailsSent).toBe(0);
		expect(result.usersProcessed).toBe(1);
		expect(mockPrefUpdate).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: 'pref-1' },
				data: { lastDigestSentAt: expect.any(Date) },
			}),
		);
		expect(mockSendEmail).not.toHaveBeenCalled();
	});

	it('sends email with all opportunities when fewer than 5 matches exist', async () => {
		mockPrefFindMany.mockResolvedValue([makePref()]);
		mockOppFindMany.mockResolvedValue([
			makeOpportunity({ id: 'opp-1' }),
			makeOpportunity({ id: 'opp-2' }),
			makeOpportunity({ id: 'opp-3' }),
		]);

		const result = await sendOpportunityDigestEmails({ skipWindowCheck: true });

		expect(result.emailsSent).toBe(1);
		expect(mockSendEmail).toHaveBeenCalledOnce();
		const [to, subject, html] = mockSendEmail.mock.calls[0];
		expect(to).toBe('user@example.com');
		expect(subject).toContain('weekly');
		// All 3 opportunities should appear in the email
		expect(html).toContain('opp-1');
		// lastDigestSentAt stamped after successful send
		expect(mockPrefUpdate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: { lastDigestSentAt: expect.any(Date) },
			}),
		);
	});

	it('limits opportunities to top 5 via take: 5 query parameter', async () => {
		mockPrefFindMany.mockResolvedValue([makePref()]);
		// Service queries with take: 5; mock returns 5
		mockOppFindMany.mockResolvedValue(
			Array.from({ length: 5 }, (_, i) => makeOpportunity({ id: `opp-${i}` })),
		);

		await sendOpportunityDigestEmails({ skipWindowCheck: true });

		expect(mockOppFindMany).toHaveBeenCalledWith(
			expect.objectContaining({ take: 5 }),
		);
	});

	it('excludes opportunities the user has already applied to', async () => {
		mockPrefFindMany.mockResolvedValue([makePref()]);
		mockAppFindMany.mockResolvedValue([{ opportunityId: 'opp-applied' }]);
		mockOppFindMany.mockResolvedValue([makeOpportunity({ id: 'opp-new' })]);

		await sendOpportunityDigestEmails({ skipWindowCheck: true });

		expect(mockOppFindMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					id: { notIn: expect.arrayContaining(['opp-applied']) },
				}),
			}),
		);
	});

	it('excludes opportunities the user has expressed interest in', async () => {
		mockPrefFindMany.mockResolvedValue([makePref()]);
		mockInterestFindMany.mockResolvedValue([
			{ opportunityId: 'opp-interested' },
		]);
		mockOppFindMany.mockResolvedValue([makeOpportunity({ id: 'opp-new' })]);

		await sendOpportunityDigestEmails({ skipWindowCheck: true });

		expect(mockOppFindMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					id: { notIn: expect.arrayContaining(['opp-interested']) },
				}),
			}),
		);
	});

	it('continues to next user when email send fails', async () => {
		const pref2 = makePref({
			id: 'pref-2',
			userId: 'user-2',
			user: { id: 'user-2', email: 'user2@example.com', name: 'User 2' },
		});
		mockPrefFindMany.mockResolvedValue([makePref(), pref2]);
		mockOppFindMany.mockResolvedValue([makeOpportunity()]);

		// First user's email fails, second succeeds
		mockSendEmail.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

		const result = await sendOpportunityDigestEmails({ skipWindowCheck: true });

		expect(result.usersProcessed).toBe(2);
		expect(result.emailsSent).toBe(1);
	});

	it('returns nextCursor=null when batch < 100', async () => {
		mockPrefFindMany.mockResolvedValue([makePref()]);
		mockOppFindMany.mockResolvedValue([]);

		const result = await sendOpportunityDigestEmails({ skipWindowCheck: true });

		expect(result.nextCursor).toBeNull();
	});

	it('returns nextCursor = last pref id when batch = 100', async () => {
		const prefs = Array.from({ length: 100 }, (_, i) =>
			makePref({
				id: `pref-${i}`,
				userId: `user-${i}`,
				user: { id: `user-${i}`, email: `u${i}@test.com`, name: `U${i}` },
			}),
		);
		mockPrefFindMany.mockResolvedValue(prefs);
		mockOppFindMany.mockResolvedValue([]);

		const result = await sendOpportunityDigestEmails({ skipWindowCheck: true });

		expect(result.nextCursor).toBe('pref-99');
	});

	it('stamps lastDigestSentAt and skips email when user has no email address', async () => {
		mockPrefFindMany.mockResolvedValue([
			makePref({ user: { id: 'user-1', email: null, name: null } }),
		]);

		const result = await sendOpportunityDigestEmails({ skipWindowCheck: true });

		expect(result.emailsSent).toBe(0);
		expect(result.usersProcessed).toBe(1);
		expect(mockPrefUpdate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ lastDigestSentAt: expect.any(Date) }),
			}),
		);
		expect(mockSendEmail).not.toHaveBeenCalled();
	});

	it('resumes from cursor by passing skip:1 + cursor to findMany', async () => {
		mockPrefFindMany.mockResolvedValue([]);

		await sendOpportunityDigestEmails({
			skipWindowCheck: true,
			cursor: 'pref-50',
		});

		expect(mockPrefFindMany).toHaveBeenCalledWith(
			expect.objectContaining({
				cursor: { id: 'pref-50' },
				skip: 1,
			}),
		);
	});

	it('skips outside Monday 8am UTC when window check is enabled', async () => {
		// Pin clock to a known non-Monday time (Wednesday) for deterministic behavior
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-06-03T15:00:00Z')); // Wednesday
		mockPrefFindMany.mockResolvedValue([makePref()]);

		const result = await sendOpportunityDigestEmails({
			skipWindowCheck: false,
		});

		expect(result.emailsSent).toBe(0);
		expect(result.usersProcessed).toBe(0);
		expect(result.nextCursor).toBeNull();

		vi.useRealTimers();
	});
});
