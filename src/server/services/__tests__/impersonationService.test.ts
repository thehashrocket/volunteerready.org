import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — vi.hoisted so they're available inside vi.mock factories.
// ---------------------------------------------------------------------------

const {
	mockTransaction,
	mockFindUnique,
	mockIsPlatformAdmin,
	mockCreateSessionTx,
	mockFindActiveSession,
	mockEndSession,
	mockGetHistory,
	mockWriteAuditLog,
	mockWriteAuditLogTx,
} = vi.hoisted(() => {
	const mockCreateSessionTx = vi.fn();
	const mockFindActiveSession = vi.fn();
	const mockEndSession = vi.fn();
	const mockGetHistory = vi.fn();
	const mockWriteAuditLog = vi.fn().mockResolvedValue({ id: 'audit-1' });
	const mockWriteAuditLogTx = vi.fn().mockResolvedValue({ id: 'audit-1' });
	const mockFindUnique = vi.fn();
	const mockIsPlatformAdmin = vi.fn();
	const mockTransaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
		fn({}),
	);
	return {
		mockTransaction,
		mockFindUnique,
		mockIsPlatformAdmin,
		mockCreateSessionTx,
		mockFindActiveSession,
		mockEndSession,
		mockGetHistory,
		mockWriteAuditLog,
		mockWriteAuditLogTx,
	};
});

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		user: { findUnique: mockFindUnique },
		$transaction: mockTransaction,
	},
}));

vi.mock('@/server/domain/platform-admin', () => ({
	isPlatformAdmin: mockIsPlatformAdmin,
}));

vi.mock('@/server/repositories/impersonationRepo', () => ({
	createImpersonationSessionTx: mockCreateSessionTx,
	findActiveImpersonationSession: mockFindActiveSession,
	endImpersonationSession: mockEndSession,
	getImpersonationHistory: mockGetHistory,
}));

vi.mock('@/server/repositories/auditRepo', () => ({
	writeAuditLog: mockWriteAuditLog,
	writeAuditLogTx: mockWriteAuditLogTx,
}));

import {
	endImpersonation,
	resolveImpersonation,
	startImpersonation,
} from '../impersonationService';

describe('impersonationService.startImpersonation', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockIsPlatformAdmin.mockReset();
		mockFindUnique.mockReset();
		mockCreateSessionTx.mockReset();
	});

	it('rejects self-impersonation before any DB call', async () => {
		await expect(
			startImpersonation('admin-1', 'admin-1', 'debugging volunteer flow'),
		).rejects.toThrow(TRPCError);

		expect(mockIsPlatformAdmin).not.toHaveBeenCalled();
		expect(mockFindUnique).not.toHaveBeenCalled();
	});

	it('rejects non-admin callers (FORBIDDEN)', async () => {
		mockIsPlatformAdmin.mockResolvedValueOnce(false);

		await expect(
			startImpersonation('not-admin', 'target-1', 'debugging volunteer flow'),
		).rejects.toMatchObject({ code: 'FORBIDDEN' });

		expect(mockFindUnique).not.toHaveBeenCalled();
	});

	it('rejects when target user does not exist', async () => {
		mockIsPlatformAdmin.mockResolvedValueOnce(true);
		mockFindUnique.mockResolvedValueOnce(null);

		await expect(
			startImpersonation('admin-1', 'missing-id', 'debugging volunteer flow'),
		).rejects.toMatchObject({ code: 'NOT_FOUND' });
	});

	it('rejects targeting another platform admin (no privilege chains)', async () => {
		mockIsPlatformAdmin.mockResolvedValueOnce(true); // caller
		mockFindUnique.mockResolvedValueOnce({
			id: 'target-1',
			isPlatformAdmin: true,
			email: 't@example.com',
		});
		mockIsPlatformAdmin.mockResolvedValueOnce(true); // target

		await expect(
			startImpersonation('admin-1', 'target-1', 'debugging volunteer flow'),
		).rejects.toMatchObject({ code: 'FORBIDDEN' });
	});

	it('creates session + audit row in the same transaction on happy path', async () => {
		mockIsPlatformAdmin.mockResolvedValueOnce(true); // caller
		mockFindUnique.mockResolvedValueOnce({
			id: 'target-1',
			isPlatformAdmin: false,
			email: 't@example.com',
		});
		mockIsPlatformAdmin.mockResolvedValueOnce(false); // target
		mockCreateSessionTx.mockResolvedValueOnce({ id: 'session-1' });

		const result = await startImpersonation(
			'admin-1',
			'target-1',
			'debugging volunteer flow',
		);

		expect(mockTransaction).toHaveBeenCalledOnce();
		expect(mockCreateSessionTx).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				adminUserId: 'admin-1',
				targetUserId: 'target-1',
				reason: 'debugging volunteer flow',
			}),
		);
		expect(mockWriteAuditLogTx).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				actorId: 'admin-1',
				action: 'IMPERSONATION_START',
				entityType: 'ImpersonationSession',
				entityId: 'session-1',
				metadata: expect.objectContaining({
					targetUserId: 'target-1',
					targetEmail: 't@example.com',
					reason: 'debugging volunteer flow',
				}),
			}),
		);
		expect(result.sessionId).toBe('session-1');
		expect(result.targetUserId).toBe('target-1');
	});
});

describe('impersonationService.endImpersonation', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockFindActiveSession.mockReset();
		mockEndSession.mockReset();
	});

	it('is a no-op when the session does not exist', async () => {
		mockFindActiveSession.mockResolvedValueOnce(null);

		const result = await endImpersonation('session-1', 'admin-1', 'manual');

		expect(result).toEqual({ ok: true, alreadyEnded: true });
		expect(mockEndSession).not.toHaveBeenCalled();
		expect(mockWriteAuditLog).not.toHaveBeenCalled();
	});

	it('is a no-op when the session is already ended', async () => {
		mockFindActiveSession.mockResolvedValueOnce({
			id: 'session-1',
			adminUserId: 'admin-1',
			targetUserId: 'target-1',
			startedAt: new Date(),
			endedAt: new Date(),
		});

		const result = await endImpersonation('session-1', 'admin-1', 'manual');

		expect(result).toEqual({ ok: true, alreadyEnded: true });
		expect(mockEndSession).not.toHaveBeenCalled();
	});

	it('is idempotent when the concurrent update touches zero rows', async () => {
		mockFindActiveSession.mockResolvedValueOnce({
			id: 'session-1',
			adminUserId: 'admin-1',
			targetUserId: 'target-1',
			startedAt: new Date(),
			endedAt: null,
		});
		mockEndSession.mockResolvedValueOnce({ count: 0 });

		const result = await endImpersonation('session-1', 'admin-1', 'manual');

		expect(result).toEqual({ ok: true, alreadyEnded: true });
		expect(mockWriteAuditLog).not.toHaveBeenCalled();
	});

	it('writes an END audit row with duration on success', async () => {
		const startedAt = new Date(Date.now() - 60_000);
		mockFindActiveSession.mockResolvedValueOnce({
			id: 'session-1',
			adminUserId: 'admin-1',
			targetUserId: 'target-1',
			startedAt,
			endedAt: null,
		});
		mockEndSession.mockResolvedValueOnce({ count: 1 });

		const result = await endImpersonation('session-1', 'admin-1', 'manual');

		expect(result).toEqual({ ok: true, alreadyEnded: false });
		expect(mockWriteAuditLog).toHaveBeenCalledWith(
			expect.objectContaining({
				actorId: 'admin-1',
				action: 'IMPERSONATION_END',
				entityType: 'ImpersonationSession',
				entityId: 'session-1',
				metadata: expect.objectContaining({
					targetUserId: 'target-1',
					endedReason: 'manual',
					durationMs: expect.any(Number),
				}),
			}),
		);
	});

	it('falls back to the session admin id when the caller is anonymous', async () => {
		mockFindActiveSession.mockResolvedValueOnce({
			id: 'session-1',
			adminUserId: 'admin-1',
			targetUserId: 'target-1',
			startedAt: new Date(),
			endedAt: null,
		});
		mockEndSession.mockResolvedValueOnce({ count: 1 });

		await endImpersonation('session-1', null, 'expired');

		expect(mockWriteAuditLog).toHaveBeenCalledWith(
			expect.objectContaining({ actorId: 'admin-1' }),
		);
	});

	it('SECURITY: rejects when a different admin tries to end the session', async () => {
		mockFindActiveSession.mockResolvedValueOnce({
			id: 'session-1',
			adminUserId: 'admin-1',
			targetUserId: 'target-1',
			startedAt: new Date(Date.now() - 60_000),
			expiresAt: new Date(Date.now() + 60_000),
			endedAt: null,
		});

		await expect(
			endImpersonation('session-1', 'admin-2', 'manual'),
		).rejects.toMatchObject({ code: 'FORBIDDEN' });

		expect(mockEndSession).not.toHaveBeenCalled();
		expect(mockWriteAuditLog).not.toHaveBeenCalled();
	});
});

describe('impersonationService.resolveImpersonation', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockFindActiveSession.mockReset();
		mockEndSession.mockReset();
	});

	it('returns null effective when no cookie is present', async () => {
		const result = await resolveImpersonation('admin-1', null);

		expect(result).toEqual({ effective: null, shouldClearCookie: false });
		expect(mockFindActiveSession).not.toHaveBeenCalled();
	});

	it('clears the cookie when the referenced session is missing', async () => {
		mockFindActiveSession.mockResolvedValueOnce(null);

		const result = await resolveImpersonation('admin-1', 'session-1');

		expect(result).toEqual({ effective: null, shouldClearCookie: true });
	});

	it('SECURITY: rejects when cookie adminId does not match caller (cross-admin theft)', async () => {
		// If this ever passes without rejection, it's a CVE.
		mockFindActiveSession.mockResolvedValueOnce({
			id: 'session-1',
			adminUserId: 'admin-other', // bound to a DIFFERENT admin
			targetUserId: 'target-1',
			startedAt: new Date(),
			expiresAt: new Date(Date.now() + 60_000),
			endedAt: null,
		});

		const result = await resolveImpersonation('admin-1', 'session-1');

		expect(result.effective).toBeNull();
		expect(result.shouldClearCookie).toBe(true);
		expect(mockEndSession).not.toHaveBeenCalled();
	});

	it('clears the cookie when the session has already ended', async () => {
		mockFindActiveSession.mockResolvedValueOnce({
			id: 'session-1',
			adminUserId: 'admin-1',
			targetUserId: 'target-1',
			startedAt: new Date(),
			expiresAt: new Date(Date.now() + 60_000),
			endedAt: new Date(),
		});

		const result = await resolveImpersonation('admin-1', 'session-1');

		expect(result).toEqual({ effective: null, shouldClearCookie: true });
	});

	it('completes the transition on an expired-but-not-yet-ended session', async () => {
		mockFindActiveSession
			.mockResolvedValueOnce({
				id: 'session-1',
				adminUserId: 'admin-1',
				targetUserId: 'target-1',
				startedAt: new Date(Date.now() - 60_000),
				expiresAt: new Date(Date.now() - 1_000),
				endedAt: null,
			})
			// endImpersonation() inside the fire-and-forget path re-reads the row.
			.mockResolvedValueOnce({
				id: 'session-1',
				adminUserId: 'admin-1',
				targetUserId: 'target-1',
				startedAt: new Date(Date.now() - 60_000),
				endedAt: null,
			});
		mockEndSession.mockResolvedValueOnce({ count: 1 });

		const result = await resolveImpersonation('admin-1', 'session-1');

		expect(result.effective).toBeNull();
		expect(result.shouldClearCookie).toBe(true);
		expect(mockEndSession).toHaveBeenCalledWith('session-1', 'expired');
	});

	it('returns an effective user on the valid-session happy path', async () => {
		const expiresAt = new Date(Date.now() + 60_000);
		mockFindActiveSession.mockResolvedValueOnce({
			id: 'session-1',
			adminUserId: 'admin-1',
			targetUserId: 'target-1',
			startedAt: new Date(),
			expiresAt,
			endedAt: null,
		});

		const result = await resolveImpersonation('admin-1', 'session-1');

		expect(result.shouldClearCookie).toBe(false);
		expect(result.effective).toEqual({
			userId: 'target-1',
			isImpersonation: true,
			impersonatedBy: 'admin-1',
			impersonationSessionId: 'session-1',
			expiresAt,
		});
	});
});
