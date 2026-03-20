/**
 * checkin-token.ts — HMAC-SHA256 stateless tokens for QR check-in.
 *
 * Tokens rotate every 5 minutes (TIME_WINDOW_SECONDS). Validation accepts
 * the current window AND the previous window to handle edge cases where a
 * volunteer's QR code was generated just before the window boundary.
 *
 * QR data format: `vr:1|{shiftId}|{userId}|{token}`
 *   - `vr:1` = version prefix (future-proofing)
 *   - token = HMAC-SHA256 hex of `shiftId|userId|timeWindow`
 */

import crypto from 'node:crypto';

const TIME_WINDOW_SECONDS = 300; // 5 minutes

/** Get the HMAC secret from env, or throw. */
function getSecret(): string {
	const secret = process.env.CHECKIN_HMAC_SECRET;
	if (!secret) {
		throw new Error(
			'CHECKIN_HMAC_SECRET is not configured. QR check-in is unavailable.',
		);
	}
	return secret;
}

/** Compute the time window index for a given timestamp. */
function timeWindow(now: Date): number {
	return Math.floor(now.getTime() / 1000 / TIME_WINDOW_SECONDS);
}

/** Generate an HMAC-SHA256 token for a specific time window. */
function hmac(secret: string, data: string): string {
	return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

/**
 * Generate a check-in token for the current time window.
 */
export function generateCheckinToken(
	secret: string,
	shiftId: string,
	userId: string,
	now: Date = new Date(),
): string {
	const window = timeWindow(now);
	return hmac(secret, `${shiftId}|${userId}|${window}`);
}

/**
 * Validate a check-in token against the current and previous time windows.
 * Returns true if valid in either window.
 */
export function validateCheckinToken(
	secret: string,
	shiftId: string,
	userId: string,
	token: string,
	now: Date = new Date(),
): boolean {
	const currentWindow = timeWindow(now);
	const currentToken = hmac(secret, `${shiftId}|${userId}|${currentWindow}`);
	if (token === currentToken) return true;

	const previousToken = hmac(
		secret,
		`${shiftId}|${userId}|${currentWindow - 1}`,
	);
	return token === previousToken;
}

/** Parsed QR data structure. */
export type QrData = {
	version: number;
	shiftId: string;
	userId: string;
	token: string;
};

const QR_REGEX = /^vr:(\d+)\|([a-z0-9]+)\|([a-z0-9]+)\|([a-f0-9]{64})$/;

/**
 * Parse raw QR code data into structured fields.
 * Returns null if the format doesn't match.
 */
export function parseQrData(raw: string): QrData | null {
	const match = QR_REGEX.exec(raw);
	if (!match) return null;

	return {
		version: Number.parseInt(match[1], 10),
		shiftId: match[2],
		userId: match[3],
		token: match[4],
	};
}

/**
 * Format QR data into the canonical string for encoding.
 */
export function formatQrData(
	shiftId: string,
	userId: string,
	token: string,
): string {
	return `vr:1|${shiftId}|${userId}|${token}`;
}

/**
 * Convenience: generate token using env secret.
 * Throws if CHECKIN_HMAC_SECRET is not set.
 */
export function generateCheckinTokenFromEnv(
	shiftId: string,
	userId: string,
	now?: Date,
): string {
	return generateCheckinToken(getSecret(), shiftId, userId, now);
}

/**
 * Convenience: validate token using env secret.
 * Throws if CHECKIN_HMAC_SECRET is not set.
 */
export function validateCheckinTokenFromEnv(
	shiftId: string,
	userId: string,
	token: string,
	now?: Date,
): boolean {
	return validateCheckinToken(getSecret(), shiftId, userId, token, now);
}
