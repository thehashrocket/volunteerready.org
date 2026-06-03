/**
 * digest-unsubscribe-token.ts — HMAC-SHA256 tokens for one-click digest unsubscribe.
 *
 * Tokens have no expiry. The URL carries both the userId and the HMAC signature
 * as separate query params: ?userId=X&token=Y
 *
 * Pattern mirrors checkin-token.ts: raw functions take an explicit secret
 * (testable), env convenience wrappers throw if the env var is missing.
 */

import crypto from 'node:crypto';

function getSecret(): string {
	const secret = process.env.DIGEST_UNSUBSCRIBE_SECRET;
	if (!secret) {
		throw new Error(
			'DIGEST_UNSUBSCRIBE_SECRET is not configured. Digest unsubscribe is unavailable.',
		);
	}
	return secret;
}

function hmac(secret: string, data: string): string {
	return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

/** Generate a no-expiry HMAC token for a user's unsubscribe link. */
export function generateUnsubscribeToken(
	secret: string,
	userId: string,
): string {
	return hmac(secret, userId);
}

/**
 * Validate an unsubscribe token against the given userId.
 * Uses timingSafeEqual to prevent timing attacks.
 */
export function validateUnsubscribeToken(
	secret: string,
	userId: string,
	token: string,
): boolean {
	try {
		const expected = hmac(secret, userId);
		const expectedBuf = Buffer.from(expected, 'hex');
		const tokenBuf = Buffer.from(token, 'hex');
		if (tokenBuf.length !== expectedBuf.length) return false;
		return crypto.timingSafeEqual(tokenBuf, expectedBuf);
	} catch {
		return false;
	}
}

/** Convenience: generate token using env secret. */
export function generateUnsubscribeTokenFromEnv(userId: string): string {
	return generateUnsubscribeToken(getSecret(), userId);
}

/** Convenience: validate token using env secret. */
export function validateUnsubscribeTokenFromEnv(
	userId: string,
	token: string,
): boolean {
	return validateUnsubscribeToken(getSecret(), userId, token);
}
