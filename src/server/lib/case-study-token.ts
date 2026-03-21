/**
 * HMAC-SHA256 consent tokens for case study email approval.
 *
 * Token format: `${orgId}|${timestamp}|${hmac}`
 * Default max age: 7 days.
 */

import crypto from 'node:crypto';

const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function hmac(secret: string, data: string): string {
	return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

function getSecret(): string | null {
	return process.env.CASE_STUDY_CONSENT_SECRET || null;
}

export function createConsentToken(
	orgId: string,
	secret: string | null = getSecret(),
	now: Date = new Date(),
): string {
	if (!secret) {
		throw new Error('CASE_STUDY_CONSENT_SECRET is not configured.');
	}
	const timestamp = now.getTime().toString();
	const signature = hmac(secret, `${orgId}|${timestamp}`);
	return `${orgId}|${timestamp}|${signature}`;
}

export function verifyConsentToken(
	token: string,
	secret: string | null = getSecret(),
	maxAgeMs: number = DEFAULT_MAX_AGE_MS,
	now: Date = new Date(),
): string | null {
	if (!secret) return null;
	const parts = token.split('|');
	if (parts.length !== 3) return null;

	const [orgId, timestampStr, signature] = parts;
	if (!orgId || !timestampStr || !signature) return null;

	const timestamp = Number(timestampStr);
	if (Number.isNaN(timestamp)) return null;

	// Check expiry
	if (now.getTime() - timestamp > maxAgeMs) return null;

	// Verify HMAC — guard against malformed hex that would cause
	// timingSafeEqual to throw on mismatched buffer lengths
	const expected = hmac(secret, `${orgId}|${timestampStr}`);
	if (signature.length !== expected.length) return null;

	try {
		if (
			!crypto.timingSafeEqual(
				Buffer.from(signature, 'hex'),
				Buffer.from(expected, 'hex'),
			)
		) {
			return null;
		}
	} catch {
		return null;
	}

	return orgId;
}
