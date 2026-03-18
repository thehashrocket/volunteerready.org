import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/repositories/credential-expiry-repo', () => ({
	findExpiredCredentials: vi.fn(async () => []),
	findExpiredShareTokens: vi.fn(async () => []),
	markCredentialExpiredTx: vi.fn(async () => ({})),
}));

vi.mock('@/server/repositories/credentialShareTokenRepo', () => ({
	markTokenExpiredTx: vi.fn(async () => ({})),
}));

vi.mock('@/server/repositories/auditRepo', () => ({
	writeAuditLogTx: vi.fn(async () => ({})),
}));

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		$transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
			fn({}),
		),
	},
}));

import * as auditRepo from '@/server/repositories/auditRepo';
import * as expiryRepo from '@/server/repositories/credential-expiry-repo';
import * as shareTokenRepo from '@/server/repositories/credentialShareTokenRepo';
import { prisma } from '@/server/repositories/prisma';
import { expireStaleCredentialsAndTokens } from '../credential-expiry-service';

describe('expireStaleCredentialsAndTokens', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns zero counts when nothing is expired', async () => {
		const result = await expireStaleCredentialsAndTokens();
		expect(result).toEqual({ credentialsExpired: 0, tokensExpired: 0 });
	});

	it('expires credentials and returns correct count', async () => {
		vi.mocked(expiryRepo.findExpiredCredentials).mockResolvedValueOnce([
			{ id: 'cred-1', userId: 'u1', orgId: 'org-1', type: 'BACKGROUND_CHECK' },
			{ id: 'cred-2', userId: 'u2', orgId: 'org-1', type: 'ID_VERIFIED' },
		]);

		const result = await expireStaleCredentialsAndTokens();

		expect(result.credentialsExpired).toBe(2);
		expect(expiryRepo.markCredentialExpiredTx).toHaveBeenCalledTimes(2);
		expect(auditRepo.writeAuditLogTx).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				action: 'CREDENTIAL_AUTO_EXPIRED',
				actorId: null,
			}),
		);
	});

	it('expires share tokens and returns correct count', async () => {
		vi.mocked(expiryRepo.findExpiredShareTokens).mockResolvedValueOnce([
			{ id: 'tok-1' },
			{ id: 'tok-2' },
			{ id: 'tok-3' },
		]);

		const result = await expireStaleCredentialsAndTokens();

		expect(result.tokensExpired).toBe(3);
		expect(shareTokenRepo.markTokenExpiredTx).toHaveBeenCalledTimes(3);
		expect(auditRepo.writeAuditLogTx).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				action: 'SHARE_TOKEN_AUTO_EXPIRED',
				actorId: null,
			}),
		);
	});

	it('skips P2025 errors and continues processing', async () => {
		vi.mocked(expiryRepo.findExpiredCredentials).mockResolvedValueOnce([
			{ id: 'cred-ok', userId: 'u1', orgId: 'org-1', type: 'ID_VERIFIED' },
			{
				id: 'cred-gone',
				userId: 'u2',
				orgId: 'org-1',
				type: 'BACKGROUND_CHECK',
			},
		]);

		// First succeeds, second throws P2025
		vi.mocked(prisma.$transaction)
			.mockImplementationOnce(async (fn) =>
				(fn as (tx: unknown) => Promise<unknown>)({}),
			)
			.mockRejectedValueOnce(
				Object.assign(new Error('Record not found'), { code: 'P2025' }),
			);

		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const result = await expireStaleCredentialsAndTokens();

		expect(result.credentialsExpired).toBe(1);
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining('already modified'),
		);
		warnSpy.mockRestore();
	});

	it('handles both credentials and tokens in single run', async () => {
		vi.mocked(expiryRepo.findExpiredCredentials).mockResolvedValueOnce([
			{ id: 'cred-1', userId: 'u1', orgId: 'org-1', type: 'TRAINING_COMPLETE' },
		]);
		vi.mocked(expiryRepo.findExpiredShareTokens).mockResolvedValueOnce([
			{ id: 'tok-1' },
		]);

		const result = await expireStaleCredentialsAndTokens();

		expect(result).toEqual({ credentialsExpired: 1, tokensExpired: 1 });
	});
});
