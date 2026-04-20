import { beforeEach, describe, expect, it, vi } from 'vitest';

// PrismaClientKnownRequestError stand-in — must be defined via vi.hoisted()
// so vi.mock factories (which are hoisted) can reference it.
const { MockPrismaClientKnownRequestError } = vi.hoisted(() => {
	class MockPrismaClientKnownRequestError extends Error {
		code: string;
		clientVersion: string;
		meta?: Record<string, unknown>;
		constructor(
			message: string,
			{ code, clientVersion }: { code: string; clientVersion: string },
		) {
			super(message);
			this.name = 'PrismaClientKnownRequestError';
			this.code = code;
			this.clientVersion = clientVersion;
		}
	}
	return { MockPrismaClientKnownRequestError };
});

vi.mock('@/prisma/generated/client', () => ({
	Prisma: {
		PrismaClientKnownRequestError: MockPrismaClientKnownRequestError,
	},
	ApplicationStatus: {
		SUBMITTED: 'SUBMITTED',
		REVIEW: 'REVIEW',
		APPROVED: 'APPROVED',
		REJECTED: 'REJECTED',
	},
	OpportunityStatus: {
		PUBLISHED: 'PUBLISHED',
		DRAFT: 'DRAFT',
		CLOSED: 'CLOSED',
	},
}));

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		volunteerOpportunity: {
			findFirst: vi.fn(),
			findUnique: vi.fn(),
		},
		volunteerApplication: {
			create: vi.fn(),
			findFirst: vi.fn(),
			findUniqueOrThrow: vi.fn(),
			update: vi.fn(),
		},
		volunteerAnswer: {
			createMany: vi.fn(),
		},
		organization: {
			updateMany: vi.fn(),
			findUnique: vi.fn(),
		},
		// By default, $transaction executes the callback with a fake tx object.
		// Individual tests can override this with mockImplementationOnce.
		$transaction: vi.fn((cb: (tx: unknown) => Promise<unknown>) =>
			cb({
				volunteerApplication: { update: vi.fn() },
			}),
		),
	},
}));

vi.mock('@/server/repositories/volunteer-applications', () => ({
	getActiveQuestions: vi.fn().mockResolvedValue([]),
	findActiveApplicationByUserAndOpportunity: vi.fn(),
	listUserAppliedOpportunities: vi.fn(),
	listUserAppliedOpportunitiesCrossOrg: vi.fn(),
	updateApplicationStatusTx: vi.fn(),
}));
vi.mock('@/server/repositories/auditRepo', () => ({
	writeAuditLogTx: vi.fn(),
}));
vi.mock('@/server/services/notificationService', () => ({
	tryNotify: vi.fn(),
}));
vi.mock('@/server/services/tenureBadgeService', () => ({
	checkAndIssueTenureBadges: vi.fn(),
}));
vi.mock('@/server/repositories/reengagement-repo', () => ({
	findMemberByUserAndOrg: vi.fn().mockResolvedValue(null),
	touchMemberActivity: vi.fn(),
}));
vi.mock('@/server/lib/email', () => ({
	sendEmail: vi.fn().mockResolvedValue(true),
}));
vi.mock('@/server/lib/email-template', () => ({
	buildEmailHtml: vi.fn((content: string) => `<branded>${content}</branded>`),
}));
vi.mock('@/server/repositories/publicApplyRepo', () => ({
	getPublicFormByOrgSlug: vi.fn(),
}));

// Use the hoisted mock class directly — the real runtime library can't be resolved in tests
const PrismaClientKnownRequestError = MockPrismaClientKnownRequestError;

import type { ApplicationStatus } from '@/prisma/generated/client';
import { sendEmail } from '@/server/lib/email';
import { prisma } from '@/server/repositories/prisma';
import {
	findActiveApplicationByUserAndOpportunity,
	listUserAppliedOpportunities,
} from '@/server/repositories/volunteer-applications';
import { submitVolunteerApplication } from '../volunteer-screening';

const mockFindActive = findActiveApplicationByUserAndOpportunity as ReturnType<
	typeof vi.fn
>;
const mockListApplied = listUserAppliedOpportunities as ReturnType<
	typeof vi.fn
>;
const mockSendEmail = sendEmail as ReturnType<typeof vi.fn>;
const mockPrisma = prisma as unknown as {
	volunteerOpportunity: {
		findFirst: ReturnType<typeof vi.fn>;
		findUnique: ReturnType<typeof vi.fn>;
	};
	volunteerApplication: {
		findFirst: ReturnType<typeof vi.fn>;
	};
	$transaction: ReturnType<typeof vi.fn>;
};

const basePayload = {
	submittedByEmail: 'test@example.com',
	profile: {
		firstName: 'Jane',
		lastName: 'Doe',
		phone: '555-0100',
		zip: '60601',
	},
	responses: [] as [],
};

beforeEach(() => {
	vi.clearAllMocks();
});

describe('submitVolunteerApplication dedup guard', () => {
	it('returns duplicate response when active application exists', async () => {
		mockPrisma.volunteerOpportunity.findFirst.mockResolvedValueOnce({
			id: 'opp-1',
		});
		mockFindActive.mockResolvedValueOnce({
			id: 'app-123',
			status: 'SUBMITTED',
			submittedAt: new Date('2026-03-15'),
		});

		const result = await submitVolunteerApplication('org-1', {
			...basePayload,
			submittedByUserId: 'user-1',
			opportunityId: 'opp-1',
		});

		expect(result).toMatchObject({
			applicationId: 'app-123',
			duplicate: true,
		});
		expect(mockPrisma.$transaction).not.toHaveBeenCalled();
	});

	it('returns status field on duplicate response', async () => {
		mockPrisma.volunteerOpportunity.findFirst.mockResolvedValueOnce({
			id: 'opp-2',
		});
		mockFindActive.mockResolvedValueOnce({
			id: 'app-456',
			status: 'APPROVED',
			submittedAt: new Date('2026-03-10'),
		});

		const result = await submitVolunteerApplication('org-1', {
			...basePayload,
			submittedByUserId: 'user-2',
			opportunityId: 'opp-2',
		});

		expect(result.status).toBe('APPROVED');
		expect(result.duplicate).toBe(true);
	});

	it('passes orgId to findActiveApplicationByUserAndOpportunity', async () => {
		mockPrisma.volunteerOpportunity.findFirst.mockResolvedValueOnce({
			id: 'opp-1',
		});
		mockFindActive.mockResolvedValueOnce({
			id: 'app-1',
			status: 'SUBMITTED',
			submittedAt: new Date(),
		});

		await submitVolunteerApplication('org-99', {
			...basePayload,
			submittedByUserId: 'user-1',
			opportunityId: 'opp-1',
		});

		expect(mockFindActive).toHaveBeenCalledWith('org-99', 'user-1', 'opp-1');
	});

	it('skips dedup guard when no userId is provided', async () => {
		mockPrisma.volunteerOpportunity.findFirst.mockResolvedValueOnce({
			id: 'opp-3',
		});
		mockPrisma.$transaction.mockResolvedValueOnce({
			id: 'new-app',
			orgId: 'org-1',
		});

		await submitVolunteerApplication('org-1', {
			...basePayload,
			submittedByUserId: null,
			opportunityId: 'opp-3',
		});

		expect(mockFindActive).not.toHaveBeenCalled();
	});

	it('skips dedup guard when no opportunityId is provided', async () => {
		mockPrisma.$transaction.mockResolvedValueOnce({
			id: 'new-app-2',
			orgId: 'org-1',
		});

		await submitVolunteerApplication('org-1', {
			...basePayload,
			submittedByUserId: 'user-3',
			opportunityId: null,
		});

		expect(mockFindActive).not.toHaveBeenCalled();
	});

	it('handles P2002 race condition by returning duplicate', async () => {
		mockPrisma.volunteerOpportunity.findFirst.mockResolvedValueOnce({
			id: 'opp-race',
		});
		// Pre-check returns null (no existing application)
		mockFindActive.mockResolvedValueOnce(null);
		// Transaction throws P2002 (concurrent insert won)
		mockPrisma.$transaction.mockRejectedValueOnce(
			new PrismaClientKnownRequestError('Unique constraint failed', {
				code: 'P2002',
				clientVersion: '7.0.0',
			}),
		);
		// Re-check after P2002 finds the concurrent insert
		mockFindActive.mockResolvedValueOnce({
			id: 'app-concurrent',
			status: 'SUBMITTED',
			submittedAt: new Date('2026-03-22'),
		});

		const result = await submitVolunteerApplication('org-1', {
			...basePayload,
			submittedByUserId: 'user-race',
			opportunityId: 'opp-race',
		});

		expect(result).toMatchObject({
			applicationId: 'app-concurrent',
			duplicate: true,
		});
		// findActive called twice: once for pre-check, once after P2002
		expect(mockFindActive).toHaveBeenCalledTimes(2);
	});

	it('rethrows non-P2002 errors from transaction', async () => {
		mockPrisma.volunteerOpportunity.findFirst.mockResolvedValueOnce({
			id: 'opp-err',
		});
		mockFindActive.mockResolvedValueOnce(null);
		mockPrisma.$transaction.mockRejectedValueOnce(new Error('DB down'));

		await expect(
			submitVolunteerApplication('org-1', {
				...basePayload,
				submittedByUserId: 'user-err',
				opportunityId: 'opp-err',
			}),
		).rejects.toThrow('DB down');
	});
});

describe('getAppliedOpportunitiesForUser', () => {
	it('transforms repo results into a map keyed by opportunityId', async () => {
		mockListApplied.mockResolvedValueOnce([
			{
				id: 'app-1',
				opportunityId: 'opp-a',
				status: 'SUBMITTED',
				submittedAt: new Date('2026-03-01'),
			},
			{
				id: 'app-2',
				opportunityId: 'opp-b',
				status: 'APPROVED',
				submittedAt: new Date('2026-03-10'),
			},
		]);

		const { getAppliedOpportunitiesForUser } = await import(
			'../screener-queries'
		);
		const result = await getAppliedOpportunitiesForUser('org-1', 'user-1', [
			'opp-a',
			'opp-b',
		]);

		expect(result).toEqual({
			'opp-a': {
				applicationId: 'app-1',
				status: 'SUBMITTED',
				submittedAt: expect.any(Date),
			},
			'opp-b': {
				applicationId: 'app-2',
				status: 'APPROVED',
				submittedAt: expect.any(Date),
			},
		});
	});

	it('returns empty object when no applications found', async () => {
		mockListApplied.mockResolvedValueOnce([]);

		const { getAppliedOpportunitiesForUser } = await import(
			'../screener-queries'
		);
		const result = await getAppliedOpportunitiesForUser('org-1', 'user-1', [
			'opp-x',
		]);

		expect(result).toEqual({});
	});
});

describe('checkExistingApplicationForUser', () => {
	it('returns null if opportunity does not exist in org', async () => {
		mockPrisma.volunteerOpportunity.findFirst.mockResolvedValueOnce(null);

		const { checkExistingApplicationForUser } = await import(
			'../screener-queries'
		);
		const result = await checkExistingApplicationForUser(
			'org-1',
			'user-1',
			'bad-opp',
		);

		expect(result).toBeNull();
		expect(mockFindActive).not.toHaveBeenCalled();
	});

	it('delegates to repo when opportunity exists in org', async () => {
		mockPrisma.volunteerOpportunity.findFirst.mockResolvedValueOnce({
			id: 'opp-valid',
		});
		mockFindActive.mockResolvedValueOnce({
			id: 'app-existing',
			status: 'REVIEW',
			submittedAt: new Date(),
		});

		const { checkExistingApplicationForUser } = await import(
			'../screener-queries'
		);
		const result = await checkExistingApplicationForUser(
			'org-1',
			'user-1',
			'opp-valid',
		);

		expect(result).toMatchObject({ id: 'app-existing' });
		expect(mockFindActive).toHaveBeenCalledWith('org-1', 'user-1', 'opp-valid');
	});
});

describe('checkAnonymousEmailApplication', () => {
	it('returns null if opportunity does not belong to org', async () => {
		mockPrisma.volunteerOpportunity.findFirst.mockResolvedValueOnce(null);

		const { checkAnonymousEmailApplication } = await import(
			'../screener-queries'
		);
		const result = await checkAnonymousEmailApplication(
			'org-1',
			'test@example.com',
			'bad-opp',
		);

		expect(result).toBeNull();
	});

	it('returns { exists: true } when email+opportunity match found', async () => {
		mockPrisma.volunteerOpportunity.findFirst.mockResolvedValueOnce({
			id: 'opp-1',
		});
		mockPrisma.volunteerApplication.findFirst.mockResolvedValueOnce({
			id: 'app-anon',
		});

		const { checkAnonymousEmailApplication } = await import(
			'../screener-queries'
		);
		const result = await checkAnonymousEmailApplication(
			'org-1',
			'test@example.com',
			'opp-1',
		);

		expect(result).toEqual({ exists: true });
	});

	it('returns null when no email+opportunity match exists', async () => {
		mockPrisma.volunteerOpportunity.findFirst.mockResolvedValueOnce({
			id: 'opp-1',
		});
		mockPrisma.volunteerApplication.findFirst.mockResolvedValueOnce(null);

		const { checkAnonymousEmailApplication } = await import(
			'../screener-queries'
		);
		const result = await checkAnonymousEmailApplication(
			'org-1',
			'new@example.com',
			'opp-1',
		);

		expect(result).toBeNull();
	});
});

describe('notifyApplicationStatusChange', () => {
	// The function is not exported directly — it's called internally by
	// updateOrgApplicationStatus. We test through that path.

	it('does not send email when status has not changed', async () => {
		const { updateApplicationStatusTx } = await import(
			'@/server/repositories/volunteer-applications'
		);
		const mockUpdateTx = updateApplicationStatusTx as ReturnType<typeof vi.fn>;
		mockUpdateTx.mockResolvedValueOnce({
			updated: {
				id: 'app-1',
				submittedByEmail: 'v@example.com',
				opportunityId: 'opp-1',
			},
			previousStatus: 'REVIEW',
		});

		const { updateOrgApplicationStatus } = await import('../screener-queries');
		// Status change REVIEW -> REVIEW (no actual change)
		await updateOrgApplicationStatus(
			'org-1',
			'app-1',
			'REVIEW' as ApplicationStatus,
		);

		expect(mockSendEmail).not.toHaveBeenCalled();
	});

	it('sends branded email when status changes to APPROVED', async () => {
		const { updateApplicationStatusTx } = await import(
			'@/server/repositories/volunteer-applications'
		);
		const mockUpdateTx = updateApplicationStatusTx as ReturnType<typeof vi.fn>;
		mockUpdateTx.mockResolvedValueOnce({
			updated: {
				id: 'app-1',
				submittedByEmail: 'v@example.com',
				opportunityId: 'opp-1',
			},
			previousStatus: 'REVIEW',
		});
		mockPrisma.volunteerOpportunity.findUnique.mockResolvedValueOnce({
			title: 'Garden Cleanup',
		});

		const { updateOrgApplicationStatus } = await import('../screener-queries');
		await updateOrgApplicationStatus(
			'org-1',
			'app-1',
			'APPROVED' as ApplicationStatus,
			'actor-1',
		);

		// Wait for fire-and-forget notification
		await vi.waitFor(() => {
			expect(mockSendEmail).toHaveBeenCalledTimes(1);
		});

		expect(mockSendEmail).toHaveBeenCalledWith(
			'v@example.com',
			expect.stringContaining('Garden Cleanup'),
			expect.stringContaining('View My Application'),
		);
	});

	it('sends email when status changes to REJECTED', async () => {
		const { updateApplicationStatusTx } = await import(
			'@/server/repositories/volunteer-applications'
		);
		const mockUpdateTx = updateApplicationStatusTx as ReturnType<typeof vi.fn>;
		mockUpdateTx.mockResolvedValueOnce({
			updated: {
				id: 'app-2',
				submittedByEmail: 'v2@example.com',
				opportunityId: null,
			},
			previousStatus: 'SUBMITTED',
		});

		const { updateOrgApplicationStatus } = await import('../screener-queries');
		await updateOrgApplicationStatus(
			'org-1',
			'app-2',
			'REJECTED' as ApplicationStatus,
		);

		await vi.waitFor(() => {
			expect(mockSendEmail).toHaveBeenCalledTimes(1);
		});

		expect(mockSendEmail).toHaveBeenCalledWith(
			'v2@example.com',
			expect.stringContaining('Update on your application'),
			expect.any(String),
		);
	});

	it('does not send email for SUBMITTED status (no config)', async () => {
		const { updateApplicationStatusTx } = await import(
			'@/server/repositories/volunteer-applications'
		);
		const mockUpdateTx = updateApplicationStatusTx as ReturnType<typeof vi.fn>;
		mockUpdateTx.mockResolvedValueOnce({
			updated: {
				id: 'app-3',
				submittedByEmail: 'v3@example.com',
				opportunityId: 'opp-1',
			},
			previousStatus: 'REVIEW',
		});

		const { updateOrgApplicationStatus } = await import('../screener-queries');
		await updateOrgApplicationStatus(
			'org-1',
			'app-3',
			'SUBMITTED' as ApplicationStatus,
		);

		// Give fire-and-forget a tick
		await new Promise((r) => setTimeout(r, 50));
		expect(mockSendEmail).not.toHaveBeenCalled();
	});

	it('swallows email send errors without throwing', async () => {
		const { updateApplicationStatusTx } = await import(
			'@/server/repositories/volunteer-applications'
		);
		const mockUpdateTx = updateApplicationStatusTx as ReturnType<typeof vi.fn>;
		mockUpdateTx.mockResolvedValueOnce({
			updated: {
				id: 'app-4',
				submittedByEmail: 'v4@example.com',
				opportunityId: 'opp-1',
			},
			previousStatus: 'SUBMITTED',
		});
		mockPrisma.volunteerOpportunity.findUnique.mockResolvedValueOnce({
			title: 'Test Opp',
		});
		mockSendEmail.mockRejectedValueOnce(new Error('SMTP down'));

		const { updateOrgApplicationStatus } = await import('../screener-queries');

		// Should not throw even though email fails
		await expect(
			updateOrgApplicationStatus(
				'org-1',
				'app-4',
				'APPROVED' as ApplicationStatus,
				'actor-1',
			),
		).resolves.not.toThrow();
	});
});
