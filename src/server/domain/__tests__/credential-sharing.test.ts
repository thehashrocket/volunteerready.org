import { describe, expect, it } from 'vitest';
import {
	canClaimToken,
	canShareCredential,
	computeTokenExpiry,
	isTokenExpired,
	SHARE_TOKEN_EXPIRY_DAYS,
	tokenDaysRemaining,
} from '@/server/domain/credential-sharing';

describe('credential-sharing domain', () => {
	const now = new Date('2026-03-17T00:00:00Z');

	// -----------------------------------------------------------------------
	// canShareCredential
	// -----------------------------------------------------------------------
	describe('canShareCredential', () => {
		it('returns true for VERIFIED with no expiry', () => {
			expect(canShareCredential('VERIFIED', null, now)).toBe(true);
		});

		it('returns true for VERIFIED with future expiry', () => {
			const future = new Date('2026-06-01T00:00:00Z');
			expect(canShareCredential('VERIFIED', future, now)).toBe(true);
		});

		it('returns false for VERIFIED with past expiry', () => {
			const past = new Date('2026-01-01T00:00:00Z');
			expect(canShareCredential('VERIFIED', past, now)).toBe(false);
		});

		it('returns false for PENDING', () => {
			expect(canShareCredential('PENDING', null, now)).toBe(false);
		});

		it('returns false for EXPIRED', () => {
			expect(canShareCredential('EXPIRED', null, now)).toBe(false);
		});

		it('returns false for REVOKED', () => {
			expect(canShareCredential('REVOKED', null, now)).toBe(false);
		});

		it('returns false when expiresAt equals now (boundary)', () => {
			expect(canShareCredential('VERIFIED', now, now)).toBe(false);
		});
	});

	// -----------------------------------------------------------------------
	// canClaimToken
	// -----------------------------------------------------------------------
	describe('canClaimToken', () => {
		const validOpts = {
			tokenStatus: 'ACTIVE' as const,
			tokenExpiresAt: new Date('2026-04-17T00:00:00Z'),
			credentialStatus: 'VERIFIED' as const,
			credentialExpiresAt: null,
			claimingOrgId: 'org-b',
			credentialOrgId: 'org-a',
			now,
		};

		it('returns ok for valid claim', () => {
			expect(canClaimToken(validOpts)).toEqual({ ok: true });
		});

		it('rejects non-ACTIVE token', () => {
			const result = canClaimToken({
				...validOpts,
				tokenStatus: 'CLAIMED',
			});
			expect(result.ok).toBe(false);
			expect(result.reason).toContain('no longer active');
		});

		it('rejects expired token', () => {
			const result = canClaimToken({
				...validOpts,
				tokenExpiresAt: new Date('2026-01-01T00:00:00Z'),
			});
			expect(result.ok).toBe(false);
			expect(result.reason).toContain('expired');
		});

		it('rejects non-VERIFIED credential', () => {
			const result = canClaimToken({
				...validOpts,
				credentialStatus: 'REVOKED',
			});
			expect(result.ok).toBe(false);
			expect(result.reason).toContain('no longer verified');
		});

		it('rejects expired credential', () => {
			const result = canClaimToken({
				...validOpts,
				credentialExpiresAt: new Date('2026-01-01T00:00:00Z'),
			});
			expect(result.ok).toBe(false);
			expect(result.reason).toContain('credential has expired');
		});

		it('rejects same-org claim', () => {
			const result = canClaimToken({
				...validOpts,
				claimingOrgId: 'org-a',
			});
			expect(result.ok).toBe(false);
			expect(result.reason).toContain('own organization');
		});

		it('rejects token at exact expiry boundary', () => {
			const result = canClaimToken({
				...validOpts,
				tokenExpiresAt: now,
			});
			expect(result.ok).toBe(false);
		});
	});

	// -----------------------------------------------------------------------
	// isTokenExpired
	// -----------------------------------------------------------------------
	describe('isTokenExpired', () => {
		it('returns false for future date', () => {
			expect(isTokenExpired(new Date('2026-04-17T00:00:00Z'), now)).toBe(false);
		});

		it('returns true for past date', () => {
			expect(isTokenExpired(new Date('2026-01-01T00:00:00Z'), now)).toBe(true);
		});

		it('returns true at exact boundary', () => {
			expect(isTokenExpired(now, now)).toBe(true);
		});
	});

	// -----------------------------------------------------------------------
	// computeTokenExpiry
	// -----------------------------------------------------------------------
	describe('computeTokenExpiry', () => {
		it('returns a date 30 days from now', () => {
			const expiry = computeTokenExpiry(now);
			const diffDays =
				(expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
			expect(diffDays).toBe(SHARE_TOKEN_EXPIRY_DAYS);
		});
	});

	// -----------------------------------------------------------------------
	// tokenDaysRemaining
	// -----------------------------------------------------------------------
	describe('tokenDaysRemaining', () => {
		it('returns correct days for future expiry', () => {
			const expiry = new Date('2026-03-20T00:00:00Z');
			expect(tokenDaysRemaining(expiry, now)).toBe(3);
		});

		it('returns 0 for expired token', () => {
			const past = new Date('2026-01-01T00:00:00Z');
			expect(tokenDaysRemaining(past, now)).toBe(0);
		});

		it('returns 0 at exact boundary', () => {
			expect(tokenDaysRemaining(now, now)).toBe(0);
		});

		it('rounds up partial days', () => {
			const expiry = new Date('2026-03-17T12:00:00Z');
			expect(tokenDaysRemaining(expiry, now)).toBe(1);
		});
	});

	// -----------------------------------------------------------------------
	// Constants
	// -----------------------------------------------------------------------
	it('SHARE_TOKEN_EXPIRY_DAYS is 30', () => {
		expect(SHARE_TOKEN_EXPIRY_DAYS).toBe(30);
	});
});
