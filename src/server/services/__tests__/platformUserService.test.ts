import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
	mockTransaction,
	mockFindUnique,
	mockUpdatePlatformAdminTx,
	mockDeleteSessionsTx,
	mockListUsersPage,
	mockGetUserDetail,
	mockCountSubmittedApplications,
	mockListSubmittedApplications,
	mockWriteAuditLogTx,
} = vi.hoisted(() => ({
	mockTransaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
		fn({}),
	),
	mockFindUnique: vi.fn(),
	mockUpdatePlatformAdminTx: vi.fn(),
	mockDeleteSessionsTx: vi.fn(),
	mockListUsersPage: vi.fn(),
	mockGetUserDetail: vi.fn(),
	mockCountSubmittedApplications: vi.fn(),
	mockListSubmittedApplications: vi.fn().mockResolvedValue([]),
	mockWriteAuditLogTx: vi.fn().mockResolvedValue({ id: 'audit-1' }),
}));

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		user: { findUnique: mockFindUnique },
		$transaction: mockTransaction,
	},
}));

vi.mock('@/server/repositories/platformUserRepo', () => ({
	listUsersPage: mockListUsersPage,
	getUserDetail: mockGetUserDetail,
	countSubmittedApplications: mockCountSubmittedApplications,
	listSubmittedApplications: mockListSubmittedApplications,
	updateUserPlatformAdminTx: mockUpdatePlatformAdminTx,
	deleteUserSessionsTx: mockDeleteSessionsTx,
}));

vi.mock('@/server/repositories/auditRepo', () => ({
	writeAuditLogTx: mockWriteAuditLogTx,
}));

import {
	getUser,
	revokeAllSessions,
	setPlatformAdmin,
} from '../platformUserService';

describe('platformUserService.setPlatformAdmin', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('rejects when reason is missing or too short', async () => {
		await expect(
			setPlatformAdmin({ id: 'u1', value: true, reason: '', actorId: 'a1' }),
		).rejects.toMatchObject({ code: 'BAD_REQUEST' });

		await expect(
			setPlatformAdmin({ id: 'u1', value: true, reason: '   ', actorId: 'a1' }),
		).rejects.toMatchObject({ code: 'BAD_REQUEST' });

		await expect(
			setPlatformAdmin({ id: 'u1', value: true, reason: 'abc', actorId: 'a1' }),
		).rejects.toThrow(TRPCError);
	});

	it('rejects when target user does not exist', async () => {
		mockFindUnique.mockResolvedValueOnce(null);

		await expect(
			setPlatformAdmin({
				id: 'missing',
				value: true,
				reason: 'promote for support',
				actorId: 'a1',
			}),
		).rejects.toMatchObject({ code: 'NOT_FOUND' });
	});

	it('is a no-op when value matches current flag', async () => {
		mockFindUnique.mockResolvedValueOnce({
			id: 'u1',
			isPlatformAdmin: true,
			email: 'u@example.com',
		});

		const result = await setPlatformAdmin({
			id: 'u1',
			value: true,
			reason: 'already promoted',
			actorId: 'a1',
		});

		expect(result).toEqual({ ok: true, noChange: true });
		expect(mockTransaction).not.toHaveBeenCalled();
		expect(mockWriteAuditLogTx).not.toHaveBeenCalled();
	});

	it('grants admin with PLATFORM_ADMIN_GRANTED audit', async () => {
		mockFindUnique.mockResolvedValueOnce({
			id: 'u1',
			isPlatformAdmin: false,
			email: 'u@example.com',
		});
		mockUpdatePlatformAdminTx.mockResolvedValueOnce({
			id: 'u1',
			isPlatformAdmin: true,
			email: 'u@example.com',
		});

		const result = await setPlatformAdmin({
			id: 'u1',
			value: true,
			reason: 'support escalation',
			actorId: 'a1',
		});

		expect(result).toEqual({ ok: true, noChange: false, value: true });
		expect(mockUpdatePlatformAdminTx).toHaveBeenCalledWith(
			expect.anything(),
			'u1',
			true,
		);
		expect(mockWriteAuditLogTx).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				actorId: 'a1',
				action: 'PLATFORM_ADMIN_GRANTED',
				entityType: 'User',
				entityId: 'u1',
				metadata: expect.objectContaining({
					reason: 'support escalation',
					targetEmail: 'u@example.com',
					previousValue: false,
					newValue: true,
					selfAction: false,
				}),
			}),
		);
	});

	it('revokes admin with PLATFORM_ADMIN_REVOKED audit', async () => {
		mockFindUnique.mockResolvedValueOnce({
			id: 'u1',
			isPlatformAdmin: true,
			email: 'u@example.com',
		});
		mockUpdatePlatformAdminTx.mockResolvedValueOnce({
			id: 'u1',
			isPlatformAdmin: false,
			email: 'u@example.com',
		});

		await setPlatformAdmin({
			id: 'u1',
			value: false,
			reason: 'offboarding',
			actorId: 'a1',
		});

		expect(mockWriteAuditLogTx).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ action: 'PLATFORM_ADMIN_REVOKED' }),
		);
	});

	it('rejects when actor attempts to revoke their own admin status', async () => {
		await expect(
			setPlatformAdmin({
				id: 'a1',
				value: false,
				reason: 'stepping down',
				actorId: 'a1',
			}),
		).rejects.toMatchObject({
			code: 'BAD_REQUEST',
			message: 'Platform admins cannot revoke their own admin status.',
		});

		expect(mockTransaction).not.toHaveBeenCalled();
		expect(mockWriteAuditLogTx).not.toHaveBeenCalled();
	});
});

describe('platformUserService.revokeAllSessions', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('rejects when reason is missing', async () => {
		await expect(
			revokeAllSessions({ id: 'u1', reason: '', actorId: 'a1' }),
		).rejects.toMatchObject({ code: 'BAD_REQUEST' });
	});

	it('rejects when target does not exist', async () => {
		mockFindUnique.mockResolvedValueOnce(null);

		await expect(
			revokeAllSessions({
				id: 'missing',
				reason: 'suspected phishing',
				actorId: 'a1',
			}),
		).rejects.toMatchObject({ code: 'NOT_FOUND' });
	});

	it('writes SESSIONS_REVOKED audit with deleted count', async () => {
		mockFindUnique.mockResolvedValueOnce({
			id: 'u1',
			email: 'u@example.com',
		});
		mockDeleteSessionsTx.mockResolvedValueOnce({ count: 3 });

		const result = await revokeAllSessions({
			id: 'u1',
			reason: 'suspected phishing',
			actorId: 'a1',
		});

		expect(result).toEqual({ ok: true, count: 3 });
		expect(mockWriteAuditLogTx).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				actorId: 'a1',
				action: 'SESSIONS_REVOKED',
				entityType: 'User',
				entityId: 'u1',
				metadata: expect.objectContaining({
					reason: 'suspected phishing',
					targetEmail: 'u@example.com',
					deletedCount: 3,
				}),
			}),
		);
	});
});

describe('platformUserService.getUser', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('rejects when user is missing', async () => {
		mockGetUserDetail.mockResolvedValueOnce(null);

		await expect(getUser('missing')).rejects.toMatchObject({
			code: 'NOT_FOUND',
		});
	});

	it('merges applicationCount and applications into the detail payload', async () => {
		mockGetUserDetail.mockResolvedValueOnce({
			id: 'u1',
			email: 'u@example.com',
		});
		mockCountSubmittedApplications.mockResolvedValueOnce(7);
		const sampleApps = [
			{
				id: 'app-1',
				status: 'SUBMITTED',
				screeningStatus: 'REVIEW',
				submittedAt: new Date('2026-04-01T00:00:00Z'),
				organization: { id: 'org-1', slug: 'helping', name: 'Helping Hands' },
				opportunity: { id: 'opp-1', title: 'Food drive' },
			},
		];
		mockListSubmittedApplications.mockResolvedValueOnce(sampleApps);

		const result = await getUser('u1');

		expect(result).toEqual({
			id: 'u1',
			email: 'u@example.com',
			applicationCount: 7,
			applications: sampleApps,
		});
		expect(mockListSubmittedApplications).toHaveBeenCalledWith('u1');
	});
});
