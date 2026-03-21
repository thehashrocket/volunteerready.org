import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../repositories/prisma', () => ({
	prisma: {
		credentialShareToken: {
			findMany: vi.fn(async () => []),
			update: vi.fn(async () => ({})),
		},
	},
}));

vi.mock('../lib/email', () => ({
	sendEmail: vi.fn(async () => {}),
}));

import { sendEmail } from '../lib/email';
import { prisma } from '../repositories/prisma';
import { notifyExpiringShareTokens } from './share-token-expiry-service';

function makeToken(overrides: Record<string, unknown> = {}) {
	const now = new Date();
	const expiresAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days
	return {
		id: 'token-1',
		expiresAt,
		createdBy: { email: 'volunteer@example.com', name: 'Jane' },
		credential: {
			type: 'BACKGROUND_CHECK',
			organization: { name: 'Helping Hands' },
		},
		...overrides,
	};
}

describe('notifyExpiringShareTokens', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		process.env.NEXTAUTH_URL = 'http://localhost:3005';
	});

	it('sends email and sets notifiedAt for expiring tokens', async () => {
		vi.mocked(prisma.credentialShareToken.findMany).mockResolvedValueOnce([
			makeToken(),
		] as never);

		const result = await notifyExpiringShareTokens();

		expect(result.tokensNotified).toBe(1);
		expect(sendEmail).toHaveBeenCalledOnce();
		expect(sendEmail).toHaveBeenCalledWith(
			'volunteer@example.com',
			expect.stringContaining('expires in'),
			expect.stringContaining('background check'),
		);
		expect(prisma.credentialShareToken.update).toHaveBeenCalledWith({
			where: { id: 'token-1' },
			data: { notifiedAt: expect.any(Date) },
		});
	});

	it('skips tokens with no email', async () => {
		vi.mocked(prisma.credentialShareToken.findMany).mockResolvedValueOnce([
			makeToken({ createdBy: { email: null, name: 'No Email' } }),
		] as never);

		const result = await notifyExpiringShareTokens();

		expect(result.tokensNotified).toBe(0);
		expect(sendEmail).not.toHaveBeenCalled();
	});

	it('returns zero when no tokens are expiring', async () => {
		vi.mocked(prisma.credentialShareToken.findMany).mockResolvedValueOnce(
			[] as never,
		);

		const result = await notifyExpiringShareTokens();

		expect(result.tokensNotified).toBe(0);
		expect(sendEmail).not.toHaveBeenCalled();
	});

	it('handles P2025 race condition gracefully', async () => {
		vi.mocked(prisma.credentialShareToken.findMany).mockResolvedValueOnce([
			makeToken(),
		] as never);
		vi.mocked(prisma.credentialShareToken.update).mockRejectedValueOnce(
			Object.assign(new Error('Record not found'), { code: 'P2025' }),
		);

		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const result = await notifyExpiringShareTokens();

		expect(result.tokensNotified).toBe(0);
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining('already modified'),
		);
		warnSpy.mockRestore();
	});

	it('logs error and continues on non-P2025 failure', async () => {
		vi.mocked(prisma.credentialShareToken.findMany).mockResolvedValueOnce([
			makeToken({ id: 'token-a' }),
			makeToken({ id: 'token-b' }),
		] as never);
		vi.mocked(sendEmail)
			.mockRejectedValueOnce(new Error('SMTP failure'))
			.mockResolvedValueOnce(undefined);

		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const result = await notifyExpiringShareTokens();

		expect(result.tokensNotified).toBe(1);
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining('Failed to notify'),
			expect.any(Error),
		);
		errorSpy.mockRestore();
	});

	it('includes credential type and org name in email', async () => {
		vi.mocked(prisma.credentialShareToken.findMany).mockResolvedValueOnce([
			makeToken({
				credential: {
					type: 'TRAINING_COMPLETE',
					organization: { name: 'Community Center' },
				},
			}),
		] as never);

		await notifyExpiringShareTokens();

		expect(sendEmail).toHaveBeenCalledWith(
			'volunteer@example.com',
			expect.any(String),
			expect.stringContaining('training complete'),
		);
		expect(sendEmail).toHaveBeenCalledWith(
			'volunteer@example.com',
			expect.any(String),
			expect.stringContaining('Community Center'),
		);
	});
});
