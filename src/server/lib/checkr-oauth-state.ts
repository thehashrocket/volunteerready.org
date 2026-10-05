/**
 * checkr-oauth-state.ts — the `state` value for the Checkr Partner OAuth
 * connect flow.
 *
 * `state` is `<orgId>.<issuedAtMs>.<mac>`, where the MAC is HMAC-SHA256 over
 * the browser's session token, the org id and the issue time. The callback
 * accepts it only from the same browser session that started the flow, for
 * the org it was issued for, within STATE_TTL_MS.
 *
 * Keyed with NEXTAUTH_SECRET under a label, so it cannot be swapped for any
 * other HMAC the app makes with that secret.
 */

import crypto from 'node:crypto';

const LABEL = 'checkr-oauth-state:v1';
export const STATE_TTL_MS = 15 * 60 * 1000;
const MAC_SHAPE = /^[0-9a-f]{64}$/;

function getSecret(): string {
	const secret = process.env.NEXTAUTH_SECRET;
	if (!secret) {
		throw new Error('NEXTAUTH_SECRET is not configured.');
	}
	return secret;
}

function mac(
	secret: string,
	sessionToken: string,
	orgId: string,
	issuedAt: number,
) {
	return crypto
		.createHmac('sha256', secret)
		.update(`${LABEL}|${sessionToken}|${orgId}|${issuedAt}`)
		.digest('hex');
}

export function createCheckrOAuthState(
	input: { orgId: string; sessionToken: string; now?: number },
	secret: string = getSecret(),
): string {
	const issuedAt = input.now ?? Date.now();
	return `${input.orgId}.${issuedAt}.${mac(secret, input.sessionToken, input.orgId, issuedAt)}`;
}

/** The org id the state was issued for, or null when it is not valid here. */
export function verifyCheckrOAuthState(
	input: { state: string; sessionToken: string; now?: number },
	secret: string = getSecret(),
): string | null {
	const parts = input.state.split('.');
	if (parts.length !== 3) return null;
	const [orgId, issuedAtRaw, given] = parts;
	const issuedAt = Number(issuedAtRaw);
	const now = input.now ?? Date.now();
	if (!orgId || !Number.isSafeInteger(issuedAt) || !MAC_SHAPE.test(given)) {
		return null;
	}
	if (issuedAt > now || now - issuedAt > STATE_TTL_MS) return null;

	const expected = Buffer.from(
		mac(secret, input.sessionToken, orgId, issuedAt),
		'hex',
	);
	return crypto.timingSafeEqual(Buffer.from(given, 'hex'), expected)
		? orgId
		: null;
}
