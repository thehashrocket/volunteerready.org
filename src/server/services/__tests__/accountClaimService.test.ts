import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockClaimUnclaimedUser, mockWriteAuditLog } = vi.hoisted(() => ({
	mockClaimUnclaimedUser: vi.fn(),
	mockWriteAuditLog: vi.fn(),
}));

vi.mock('@/server/repositories/userAccountStateRepo', () => ({
	claimUnclaimedUser: mockClaimUnclaimedUser,
}));

vi.mock('@/server/repositories/auditRepo', () => ({
	writeAuditLog: mockWriteAuditLog,
}));

import { claimAccountOnSignIn } from '@/server/services/accountClaimService';

describe('claimAccountOnSignIn', () => {
	beforeEach(() => {
		mockClaimUnclaimedUser.mockReset();
		mockWriteAuditLog.mockReset();
		mockWriteAuditLog.mockResolvedValue({ id: 'audit-1' });
		delete process.env.ACCOUNT_STATE_FLIP_ENABLED;
	});

	it('flips an UNCLAIMED user and reports that it did', async () => {
		mockClaimUnclaimedUser.mockResolvedValueOnce(true);

		await expect(claimAccountOnSignIn('user-1')).resolves.toBe(true);

		expect(mockClaimUnclaimedUser).toHaveBeenCalledWith(
			'user-1',
			expect.any(Date),
		);
	});

	it('is a no-op for a user who is already ACTIVE', async () => {
		mockClaimUnclaimedUser.mockResolvedValueOnce(false);

		await expect(claimAccountOnSignIn('user-1')).resolves.toBe(false);

		// The overwhelmingly common case — every sign-in by every existing user.
		// It must not write an audit row each time.
		expect(mockWriteAuditLog).not.toHaveBeenCalled();
	});

	it('writes an ACCOUNT_CLAIMED audit row attributing the user to themselves', async () => {
		mockClaimUnclaimedUser.mockResolvedValueOnce(true);

		await claimAccountOnSignIn('user-1');

		expect(mockWriteAuditLog).toHaveBeenCalledWith(
			expect.objectContaining({
				actorId: 'user-1',
				action: 'ACCOUNT_CLAIMED',
				entityType: 'User',
				entityId: 'user-1',
			}),
		);
	});

	it('stamps the audit metadata with the same instant it wrote to the row', async () => {
		mockClaimUnclaimedUser.mockResolvedValueOnce(true);

		await claimAccountOnSignIn('user-1');

		const passedDate = mockClaimUnclaimedUser.mock.calls[0][1] as Date;
		const auditArg = mockWriteAuditLog.mock.calls[0][0] as {
			metadata: { claimedAt: string };
		};
		// Two `new Date()` calls would drift; the value must come from one clock read.
		expect(auditArg.metadata.claimedAt).toBe(passedDate.toISOString());
	});

	it('ACCOUNT_STATE_FLIP_ENABLED=false skips the flip entirely', async () => {
		process.env.ACCOUNT_STATE_FLIP_ENABLED = 'false';

		await expect(claimAccountOnSignIn('user-1')).resolves.toBe(false);

		expect(mockClaimUnclaimedUser).not.toHaveBeenCalled();
		expect(mockWriteAuditLog).not.toHaveBeenCalled();
	});

	it('SECURITY: any value other than the exact string "false" leaves the flip on', async () => {
		for (const value of ['0', 'no', 'off', '', 'FALSE']) {
			process.env.ACCOUNT_STATE_FLIP_ENABLED = value;
			mockClaimUnclaimedUser.mockReset();
			mockClaimUnclaimedUser.mockResolvedValueOnce(true);

			await claimAccountOnSignIn('user-1');

			expect(
				mockClaimUnclaimedUser,
				`value=${JSON.stringify(value)}`,
			).toHaveBeenCalled();
		}
	});

	it('propagates a repository failure so the caller can log it', async () => {
		// auth.ts owns the try/catch — swallowing here would hide a broken flip
		// from the logs entirely.
		mockClaimUnclaimedUser.mockRejectedValueOnce(new Error('db down'));

		await expect(claimAccountOnSignIn('user-1')).rejects.toThrow('db down');
	});

	it('swallows an audit failure and still reports the claim', async () => {
		const consoleError = vi
			.spyOn(console, 'error')
			.mockImplementation(() => {});
		mockClaimUnclaimedUser.mockResolvedValueOnce(true);
		mockWriteAuditLog.mockRejectedValueOnce(new Error('audit down'));

		// Must NOT propagate. By this point the flip has committed, so letting it
		// throw would make auth.ts log "Failed to claim account on sign-in" about
		// a claim that succeeded — sending an operator after a bug that isn't
		// there. A lost audit row is recoverable from User.claimedAt; a reverted
		// flip would leave a signed-in person permanently email-suppressed.
		await expect(claimAccountOnSignIn('user-1')).resolves.toBe(true);

		expect(mockClaimUnclaimedUser).toHaveBeenCalled();
		expect(consoleError).toHaveBeenCalledWith(
			'[accountClaim] Flip committed but audit write failed:',
			expect.objectContaining({ userId: 'user-1' }),
		);

		consoleError.mockRestore();
	});
});
