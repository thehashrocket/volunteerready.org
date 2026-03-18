/**
 * Unit tests for volunteerDiscoveryService.inviteToApply
 *
 * Mocks: prisma, volunteerDiscoveryRepo, sendInviteToApplyEmail, auditRepo
 */

import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		volunteerInvitation: {
			count: vi.fn(),
			create: vi.fn(),
		},
		volunteerApplication: {
			findFirst: vi.fn(),
		},
		user: {
			findUnique: vi.fn(),
		},
		volunteerOpportunity: {
			findUnique: vi.fn(),
		},
	},
}));

vi.mock('@/server/repositories/volunteerDiscoveryRepo', () => ({
	searchPublicProfiles: vi.fn(),
}));

vi.mock('@/server/repositories/sendInviteToApplyEmail', () => ({
	sendInviteToApplyEmail: vi.fn(),
}));

vi.mock('@/server/repositories/auditRepo', () => ({
	writeAuditLog: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { writeAuditLog } from '@/server/repositories/auditRepo';
import { prisma } from '@/server/repositories/prisma';
import { sendInviteToApplyEmail } from '@/server/repositories/sendInviteToApplyEmail';
import { inviteToApply } from './volunteerDiscoveryService';

const mockCount = vi.mocked(prisma.volunteerInvitation.count);
const mockCreate = vi.mocked(prisma.volunteerInvitation.create);
const mockFindFirst = vi.mocked(prisma.volunteerApplication.findFirst);
const mockUserFindUnique = vi.mocked(prisma.user.findUnique);
const mockOpportunityFindUnique = vi.mocked(
	prisma.volunteerOpportunity.findUnique,
);
const mockSendEmail = vi.mocked(sendInviteToApplyEmail);
const mockWriteAuditLog = vi.mocked(writeAuditLog);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_INPUT = {
	volunteerId: 'volunteer-1',
	opportunityId: 'opp-1',
	orgId: 'org-1',
	actorId: 'actor-1',
};

function setupHappyPath() {
	mockCount.mockResolvedValue(5);
	mockFindFirst.mockResolvedValue(null);
	mockCreate.mockResolvedValue({ id: 'invitation-1' } as never);
	mockUserFindUnique.mockResolvedValue({
		email: 'vol@example.com',
		name: 'Test Volunteer',
	} as never);
	mockOpportunityFindUnique.mockResolvedValue({
		title: 'Beach Cleanup',
		organization: { name: 'Helping Hands Org' },
	} as never);
	mockSendEmail.mockResolvedValue(undefined);
	mockWriteAuditLog.mockResolvedValue({ id: 'audit-1' } as never);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('inviteToApply', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	describe('rate limit', () => {
		it('throws FORBIDDEN when org has hit 10 invitations in 24h', async () => {
			mockCount.mockResolvedValue(10);

			await expect(inviteToApply(BASE_INPUT)).rejects.toThrow(TRPCError);

			try {
				await inviteToApply(BASE_INPUT);
			} catch (err) {
				expect(err).toBeInstanceOf(TRPCError);
				expect((err as TRPCError).code).toBe('FORBIDDEN');
				expect((err as TRPCError).message).toMatch(/Rate limit/);
			}
		});

		it('proceeds when org has 9 invitations (below limit)', async () => {
			mockCount.mockResolvedValue(9);
			mockFindFirst.mockResolvedValue(null);
			mockCreate.mockResolvedValue({ id: 'inv-1' } as never);
			mockUserFindUnique.mockResolvedValue({
				email: 'v@test.com',
				name: 'Vol',
			} as never);
			mockOpportunityFindUnique.mockResolvedValue({
				title: 'Opp',
				organization: { name: 'Org' },
			} as never);
			mockSendEmail.mockResolvedValue(undefined);
			mockWriteAuditLog.mockResolvedValue({ id: 'a' } as never);

			const result = await inviteToApply(BASE_INPUT);
			expect(result.invitationId).toBe('inv-1');
		});
	});

	describe('already applied check', () => {
		it('throws BAD_REQUEST when volunteer has already applied', async () => {
			mockCount.mockResolvedValue(0);
			mockFindFirst.mockResolvedValue({ id: 'existing-app' } as never);

			try {
				await inviteToApply(BASE_INPUT);
				// Should not reach here
				expect(true).toBe(false);
			} catch (err) {
				expect(err).toBeInstanceOf(TRPCError);
				expect((err as TRPCError).code).toBe('BAD_REQUEST');
				expect((err as TRPCError).message).toMatch(/already applied/);
			}
		});
	});

	describe('duplicate invite check', () => {
		it('throws BAD_REQUEST "already invited" when P2002 unique constraint fires', async () => {
			mockCount.mockResolvedValue(0);
			mockFindFirst.mockResolvedValue(null);

			const p2002Error = Object.assign(new Error('Unique constraint failed'), {
				code: 'P2002',
			});
			mockCreate.mockRejectedValue(p2002Error);

			try {
				await inviteToApply(BASE_INPUT);
				expect(true).toBe(false);
			} catch (err) {
				expect(err).toBeInstanceOf(TRPCError);
				expect((err as TRPCError).code).toBe('BAD_REQUEST');
				expect((err as TRPCError).message).toMatch(/already been invited/);
			}
		});

		it('re-throws unknown errors from create', async () => {
			mockCount.mockResolvedValue(0);
			mockFindFirst.mockResolvedValue(null);
			mockCreate.mockRejectedValue(new Error('DB connection lost'));

			await expect(inviteToApply(BASE_INPUT)).rejects.toThrow(
				'DB connection lost',
			);
		});
	});

	describe('happy path', () => {
		it('creates invitation and returns invitationId', async () => {
			setupHappyPath();

			const result = await inviteToApply(BASE_INPUT);
			expect(result.invitationId).toBe('invitation-1');
		});

		it('sends email with correct arguments', async () => {
			setupHappyPath();

			await inviteToApply(BASE_INPUT);

			expect(mockSendEmail).toHaveBeenCalledOnce();
			const callArgs = mockSendEmail.mock.calls[0][0];
			expect(callArgs.to).toBe('vol@example.com');
			expect(callArgs.volunteerName).toBe('Test Volunteer');
			expect(callArgs.orgName).toBe('Helping Hands Org');
			expect(callArgs.opportunityTitle).toBe('Beach Cleanup');
		});

		it('writes audit log', async () => {
			setupHappyPath();

			await inviteToApply(BASE_INPUT);

			expect(mockWriteAuditLog).toHaveBeenCalledOnce();
			const auditArgs = mockWriteAuditLog.mock.calls[0][0];
			expect(auditArgs.action).toBe('INVITE_TO_APPLY');
			expect(auditArgs.entityType).toBe('VolunteerInvitation');
			expect(auditArgs.orgId).toBe('org-1');
		});

		it('does not throw if email sending fails (fire-and-forget)', async () => {
			setupHappyPath();
			mockSendEmail.mockRejectedValue(new Error('SMTP error'));

			// Should not throw — email is fire-and-forget
			await expect(inviteToApply(BASE_INPUT)).resolves.toEqual({
				invitationId: 'invitation-1',
			});
		});

		it('does not throw if audit log fails (fire-and-forget)', async () => {
			setupHappyPath();
			mockWriteAuditLog.mockRejectedValue(new Error('Audit DB error'));

			// Should not throw — audit log is fire-and-forget
			await expect(inviteToApply(BASE_INPUT)).resolves.toEqual({
				invitationId: 'invitation-1',
			});
		});
	});
});
