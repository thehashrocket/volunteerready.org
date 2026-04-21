import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const {
	mockGetForWithdrawal,
	mockSetWithdrawn,
	mockCreateAuditLog,
	mockSendEmail,
	mockTryNotify,
	mockFindOrg,
} = vi.hoisted(() => ({
	mockGetForWithdrawal: vi.fn(),
	mockSetWithdrawn: vi.fn(),
	mockCreateAuditLog: vi.fn().mockResolvedValue({}),
	mockSendEmail: vi.fn().mockResolvedValue({ success: true }),
	mockTryNotify: vi.fn().mockResolvedValue(undefined),
	mockFindOrg: vi.fn(),
}));

vi.mock('@/server/repositories/volunteer-applications', () => ({
	withdrawApplication: mockGetForWithdrawal,
	setApplicationWithdrawn: mockSetWithdrawn,
}));

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		auditLog: { create: mockCreateAuditLog },
		organization: { findUnique: mockFindOrg },
		volunteerOpportunity: { findUnique: vi.fn() },
	},
}));

vi.mock('@/server/lib/email', () => ({ sendEmail: mockSendEmail }));

vi.mock('@/server/services/notificationService', () => ({
	tryNotify: mockTryNotify,
}));

import { withdrawVolunteerApplication } from '../volunteerApplicationService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeApplication(
	overrides: Partial<{
		id: string;
		orgId: string;
		status: string;
		opportunityId: string | null;
		submittedByEmail: string;
		opportunity: { title: string } | null;
	}> = {},
) {
	return {
		id: 'app-1',
		orgId: 'org-1',
		status: 'SUBMITTED',
		opportunityId: 'opp-1',
		submittedByEmail: 'vol@example.com',
		opportunity: { title: 'Beach Cleanup' },
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('withdrawVolunteerApplication', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockSetWithdrawn.mockResolvedValue({ id: 'app-1', status: 'WITHDRAWN' });
		mockFindOrg.mockResolvedValue({
			name: 'Test Org',
			members: [{ userId: 'admin-1' }],
		});
	});

	it('throws NOT_FOUND when application does not exist', async () => {
		mockGetForWithdrawal.mockResolvedValue(null);

		await expect(
			withdrawVolunteerApplication('user-1', 'app-1'),
		).rejects.toMatchObject({ code: 'NOT_FOUND' });
	});

	it('throws NOT_FOUND when application belongs to a different user', async () => {
		// The repo query already scopes by userId, so null = not found for this user.
		mockGetForWithdrawal.mockResolvedValue(null);

		await expect(
			withdrawVolunteerApplication('other-user', 'app-1'),
		).rejects.toMatchObject({ code: 'NOT_FOUND' });
	});

	it('throws FORBIDDEN when application is APPROVED', async () => {
		mockGetForWithdrawal.mockResolvedValue(
			makeApplication({ status: 'APPROVED' }),
		);

		await expect(
			withdrawVolunteerApplication('user-1', 'app-1'),
		).rejects.toMatchObject({ code: 'FORBIDDEN' });
	});

	it('throws FORBIDDEN when application is REJECTED', async () => {
		mockGetForWithdrawal.mockResolvedValue(
			makeApplication({ status: 'REJECTED' }),
		);

		await expect(
			withdrawVolunteerApplication('user-1', 'app-1'),
		).rejects.toMatchObject({ code: 'FORBIDDEN' });
	});

	it('withdraws a SUBMITTED application successfully', async () => {
		mockGetForWithdrawal.mockResolvedValue(
			makeApplication({ status: 'SUBMITTED' }),
		);

		const result = await withdrawVolunteerApplication('user-1', 'app-1');

		expect(mockSetWithdrawn).toHaveBeenCalledWith('app-1');
		expect(result).toMatchObject({ status: 'WITHDRAWN' });
	});

	it('withdraws a REVIEW application successfully', async () => {
		mockGetForWithdrawal.mockResolvedValue(
			makeApplication({ status: 'REVIEW' }),
		);

		const result = await withdrawVolunteerApplication('user-1', 'app-1');

		expect(mockSetWithdrawn).toHaveBeenCalledWith('app-1');
		expect(result).toMatchObject({ status: 'WITHDRAWN' });
	});

	it('writes an audit log entry on success', async () => {
		mockGetForWithdrawal.mockResolvedValue(
			makeApplication({ status: 'SUBMITTED' }),
		);

		await withdrawVolunteerApplication('user-1', 'app-1');

		expect(mockCreateAuditLog).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					action: 'STATUS_CHANGED',
					metadata: expect.objectContaining({
						from: 'SUBMITTED',
						to: 'WITHDRAWN',
					}),
				}),
			}),
		);
	});
});
