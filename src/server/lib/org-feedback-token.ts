/**
 * org-feedback-token.ts — HMAC-SHA256 tokens for the day-7 / day-30 org
 * feedback survey link.
 *
 * The survey email links to /screening/feedback/start?org=<slug>&type=<type>&token=X,
 * which moves the token into an httpOnly cookie and redirects to the
 * token-free survey URL (see src/server/domain/org-feedback.ts). The token binds the org id and the survey type, so only the link the org was
 * sent can save answers for that org. No expiry: the survey has no deadline.
 *
 * Keyed with NEXTAUTH_SECRET (always configured) under a label, so the token
 * cannot be swapped for any other HMAC the app makes with that secret.
 * Pattern mirrors digest-unsubscribe-token.ts: raw functions take an explicit
 * secret (testable); env wrappers throw if the env var is missing.
 */

import crypto from 'node:crypto';
import type { OrgFeedbackType } from '@/prisma/generated/client';

const LABEL = 'org-feedback-survey:v1';
const TOKEN_SHAPE = /^[0-9a-f]{64}$/;

function getSecret(): string {
	const secret = process.env.NEXTAUTH_SECRET;
	if (!secret) {
		throw new Error(
			'NEXTAUTH_SECRET is not configured. Feedback survey links are unavailable.',
		);
	}
	return secret;
}

function hmac(secret: string, orgId: string, type: OrgFeedbackType): string {
	return crypto
		.createHmac('sha256', secret)
		.update(`${LABEL}|${orgId}|${type}`)
		.digest('hex');
}

export function generateOrgFeedbackToken(
	secret: string,
	orgId: string,
	type: OrgFeedbackType,
): string {
	return hmac(secret, orgId, type);
}

/** True when `token` has the shape of a survey token (64 lowercase hex). */
export function isWellFormedOrgFeedbackToken(token: string): boolean {
	return TOKEN_SHAPE.test(token);
}

/** Timing-safe check of a survey token against the org and survey type. */
export function validateOrgFeedbackToken(
	secret: string,
	orgId: string,
	type: OrgFeedbackType,
	token: string,
): boolean {
	// Exactly one canonical form: 64 lowercase hex characters.
	if (!TOKEN_SHAPE.test(token)) return false;
	const expected = Buffer.from(hmac(secret, orgId, type), 'hex');
	return crypto.timingSafeEqual(Buffer.from(token, 'hex'), expected);
}

export function generateOrgFeedbackTokenFromEnv(
	orgId: string,
	type: OrgFeedbackType,
): string {
	return generateOrgFeedbackToken(getSecret(), orgId, type);
}

export function validateOrgFeedbackTokenFromEnv(
	orgId: string,
	type: OrgFeedbackType,
	token: string,
): boolean {
	return validateOrgFeedbackToken(getSecret(), orgId, type, token);
}
