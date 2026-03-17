/**
 * tokens.ts — Shared token generation and hashing utilities.
 *
 * Used for: org invitations, company invitations, application status links,
 * credential share tokens, and any future token-based auth flows.
 *
 * Pattern: generate a 256-bit random token, SHA256 hash it, store the hash.
 * The raw token is sent to the user (via URL/email). Only the hash is in the DB.
 * This prevents DB breach from exposing usable tokens.
 */

import crypto from 'node:crypto';

/** Generate a cryptographically random 256-bit hex token. */
export function generateToken(): string {
	return crypto.randomBytes(32).toString('hex');
}

/** SHA256 hash a raw token for storage. */
export function hashToken(token: string): string {
	return crypto.createHash('sha256').update(token).digest('hex');
}
