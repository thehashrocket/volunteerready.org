/**
 * credential-sharing.ts — Pure domain functions for credential sharing.
 *
 * NO framework imports. No Prisma. No tRPC. Pure functions only.
 * Follows background-check.ts pattern.
 *
 * Credential share token lifecycle:
 *
 *     volunteer generates
 *           │
 *           ▼
 *       ┌────────┐   staff claims    ┌─────────┐
 *       │ ACTIVE │──────────────────▶│ CLAIMED │
 *       └────────┘                   └─────────┘
 *           │
 *           │  time passes / volunteer revokes
 *           ▼
 *       ┌─────────┐
 *       │ EXPIRED │
 *       └─────────┘
 *
 *   Guards at claim time:
 *     ✓ token.status == ACTIVE
 *     ✓ token.expiresAt > now
 *     ✓ credential.status == VERIFIED
 *     ✓ credential.expiresAt is null OR > now
 *     ✓ claimingOrgId != credential.orgId (can't claim your own)
 *     ✓ no existing credential of same type for user in claiming org
 *
 *   Provenance: claimed credentials gain sharedFromOrgId + sharedFromCredentialId
 *   to track the trust chain. Second-generation sharing is allowed.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ShareTokenStatus = 'ACTIVE' | 'CLAIMED' | 'EXPIRED';

export type CredentialStatus = 'PENDING' | 'VERIFIED' | 'EXPIRED' | 'REVOKED';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Share tokens expire after 30 days. */
export const SHARE_TOKEN_EXPIRY_DAYS = 30;

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

/** Returns true if a credential can be shared. Only VERIFIED + non-expired. */
export function canShareCredential(
	status: CredentialStatus,
	expiresAt: Date | null,
	now: Date = new Date(),
): boolean {
	if (status !== 'VERIFIED') return false;
	if (expiresAt !== null && expiresAt <= now) return false;
	return true;
}

/** Returns true if a share token can be claimed. */
export function canClaimToken(opts: {
	tokenStatus: ShareTokenStatus;
	tokenExpiresAt: Date;
	credentialStatus: CredentialStatus;
	credentialExpiresAt: Date | null;
	claimingOrgId: string;
	credentialOrgId: string;
	now?: Date;
}): { ok: boolean; reason?: string } {
	const now = opts.now ?? new Date();

	if (opts.tokenStatus !== 'ACTIVE') {
		return { ok: false, reason: 'Token is no longer active.' };
	}
	if (opts.tokenExpiresAt <= now) {
		return { ok: false, reason: 'This share link has expired.' };
	}
	if (opts.credentialStatus !== 'VERIFIED') {
		return {
			ok: false,
			reason: 'The underlying credential is no longer verified.',
		};
	}
	if (opts.credentialExpiresAt !== null && opts.credentialExpiresAt <= now) {
		return { ok: false, reason: 'The underlying credential has expired.' };
	}
	if (opts.claimingOrgId === opts.credentialOrgId) {
		return {
			ok: false,
			reason: 'You cannot claim a credential from your own organization.',
		};
	}

	return { ok: true };
}

/** Returns true if a share token has expired based on its expiresAt date. */
export function isTokenExpired(
	expiresAt: Date,
	now: Date = new Date(),
): boolean {
	return expiresAt <= now;
}

/** Compute expiry date from now. */
export function computeTokenExpiry(now: Date = new Date()): Date {
	return new Date(
		now.getTime() + SHARE_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
	);
}

/** Returns days remaining until token expires. 0 if already expired. */
export function tokenDaysRemaining(
	expiresAt: Date,
	now: Date = new Date(),
): number {
	const diffMs = expiresAt.getTime() - now.getTime();
	if (diffMs <= 0) return 0;
	return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

export const generateShareTokenSchema = z.object({
	credentialId: z.string().min(1),
});

export const claimShareTokenSchema = z.object({
	token: z.string().min(1),
});

export const revokeShareTokenSchema = z.object({
	tokenId: z.string().min(1),
});

export const getTokenInfoSchema = z.object({
	token: z.string().min(1),
});

export const requestCredentialSharingSchema = z.object({
	applicationId: z.string().min(1),
});
