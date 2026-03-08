import { describe, expect, it } from 'vitest';

import {
	type CredentialRecord,
	computeProfileCompleteness,
	isCredentialValid,
	type ProfileData,
	summarizeCredentials,
	type UserIdentity,
} from '../volunteer-profile';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProfile(overrides: Partial<ProfileData> = {}): ProfileData {
	return {
		bio: null,
		phone: null,
		city: null,
		state: null,
		country: null,
		availability: 'FLEXIBLE',
		interests: [],
		...overrides,
	};
}

function makeUser(overrides: Partial<UserIdentity> = {}): UserIdentity {
	return {
		name: null,
		email: null,
		image: null,
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// computeProfileCompleteness
// ---------------------------------------------------------------------------

describe('computeProfileCompleteness', () => {
	it('returns MINIMAL for empty profile with no user data', () => {
		const result = computeProfileCompleteness(makeProfile(), makeUser());

		// availability always counts (+5)
		expect(result.score).toBe(5);
		expect(result.level).toBe('MINIMAL');
		expect(result.completed).toContain('availability');
		expect(result.missing).toContain('name');
		expect(result.missing).toContain('bio');
	});

	it('returns COMPLETE (100) for fully filled profile', () => {
		const profile = makeProfile({
			bio: 'I love volunteering',
			phone: '555-0123',
			city: 'Portland',
			state: 'OR',
			country: 'US',
			interests: ['education', 'environment'],
		});
		const user = makeUser({
			name: 'Jane Doe',
			email: 'jane@example.com',
			image: 'https://example.com/photo.jpg',
		});

		const result = computeProfileCompleteness(profile, user);

		expect(result.score).toBe(100);
		expect(result.level).toBe('COMPLETE');
		expect(result.missing).toHaveLength(0);
	});

	it('counts location as complete if only city is set', () => {
		const result = computeProfileCompleteness(
			makeProfile({ city: 'Seattle' }),
			makeUser(),
		);

		expect(result.completed).toContain('location');
	});

	it('counts location as complete if only country is set', () => {
		const result = computeProfileCompleteness(
			makeProfile({ country: 'US' }),
			makeUser(),
		);

		expect(result.completed).toContain('location');
	});

	it('ignores whitespace-only strings', () => {
		const result = computeProfileCompleteness(
			makeProfile({ bio: '   ', phone: '\t' }),
			makeUser({ name: '  ' }),
		);

		expect(result.missing).toContain('name');
		expect(result.missing).toContain('bio');
		expect(result.missing).toContain('phone');
	});

	it('returns STRONG for 70+ score', () => {
		// name(20) + email(15) + bio(15) + location(15) + availability(5) = 70
		const profile = makeProfile({ bio: 'Hello', city: 'NYC' });
		const user = makeUser({ name: 'Alice', email: 'alice@example.com' });

		const result = computeProfileCompleteness(profile, user);

		expect(result.score).toBe(70);
		expect(result.level).toBe('STRONG');
	});

	it('returns BASIC for 40-69 score', () => {
		// name(20) + email(15) + availability(5) = 40
		const result = computeProfileCompleteness(
			makeProfile(),
			makeUser({ name: 'Bob', email: 'bob@example.com' }),
		);

		expect(result.score).toBe(40);
		expect(result.level).toBe('BASIC');
	});

	it('treats empty interests array as missing', () => {
		const result = computeProfileCompleteness(
			makeProfile({ interests: [] }),
			makeUser(),
		);

		expect(result.missing).toContain('interests');
	});
});

// ---------------------------------------------------------------------------
// isCredentialValid
// ---------------------------------------------------------------------------

describe('isCredentialValid', () => {
	const now = new Date('2026-06-01T00:00:00Z');

	it('returns true for VERIFIED credential without expiry', () => {
		const cred: CredentialRecord = {
			type: 'BACKGROUND_CHECK',
			status: 'VERIFIED',
			issuedAt: new Date('2026-01-01'),
			expiresAt: null,
		};

		expect(isCredentialValid(cred, now)).toBe(true);
	});

	it('returns true for VERIFIED credential with future expiry', () => {
		const cred: CredentialRecord = {
			type: 'TRAINING_COMPLETE',
			status: 'VERIFIED',
			issuedAt: new Date('2026-01-01'),
			expiresAt: new Date('2027-01-01'),
		};

		expect(isCredentialValid(cred, now)).toBe(true);
	});

	it('returns false for VERIFIED credential with past expiry', () => {
		const cred: CredentialRecord = {
			type: 'ID_VERIFIED',
			status: 'VERIFIED',
			issuedAt: new Date('2025-01-01'),
			expiresAt: new Date('2026-01-01'),
		};

		expect(isCredentialValid(cred, now)).toBe(false);
	});

	it('returns false for PENDING credential', () => {
		const cred: CredentialRecord = {
			type: 'BACKGROUND_CHECK',
			status: 'PENDING',
			issuedAt: null,
			expiresAt: null,
		};

		expect(isCredentialValid(cred, now)).toBe(false);
	});

	it('returns false for REVOKED credential', () => {
		const cred: CredentialRecord = {
			type: 'REFERENCE_CHECK',
			status: 'REVOKED',
			issuedAt: new Date('2026-01-01'),
			expiresAt: null,
		};

		expect(isCredentialValid(cred, now)).toBe(false);
	});

	it('returns false for EXPIRED status even with future expiresAt', () => {
		const cred: CredentialRecord = {
			type: 'TRAINING_COMPLETE',
			status: 'EXPIRED',
			issuedAt: new Date('2026-01-01'),
			expiresAt: new Date('2027-01-01'),
		};

		expect(isCredentialValid(cred, now)).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// summarizeCredentials
// ---------------------------------------------------------------------------

describe('summarizeCredentials', () => {
	it('returns all zeros for empty array', () => {
		const summary = summarizeCredentials([]);

		expect(summary).toEqual({
			total: 0,
			verified: 0,
			pending: 0,
			expired: 0,
			revoked: 0,
		});
	});

	it('counts each status correctly', () => {
		const credentials: CredentialRecord[] = [
			{
				type: 'BACKGROUND_CHECK',
				status: 'VERIFIED',
				issuedAt: null,
				expiresAt: null,
			},
			{
				type: 'TRAINING_COMPLETE',
				status: 'VERIFIED',
				issuedAt: null,
				expiresAt: null,
			},
			{
				type: 'ID_VERIFIED',
				status: 'PENDING',
				issuedAt: null,
				expiresAt: null,
			},
			{
				type: 'REFERENCE_CHECK',
				status: 'EXPIRED',
				issuedAt: null,
				expiresAt: null,
			},
			{
				type: 'ORIENTATION_COMPLETE',
				status: 'REVOKED',
				issuedAt: null,
				expiresAt: null,
			},
		];

		const summary = summarizeCredentials(credentials);

		expect(summary.total).toBe(5);
		expect(summary.verified).toBe(2);
		expect(summary.pending).toBe(1);
		expect(summary.expired).toBe(1);
		expect(summary.revoked).toBe(1);
	});
});
