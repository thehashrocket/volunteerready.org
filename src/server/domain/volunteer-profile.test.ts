/**
 * Tests for volunteer-profile.ts — pure domain logic.
 *
 * Covers: computeProfileCompleteness, computeTenure, computeReliabilityScore.
 */
import { describe, expect, it } from 'vitest';
import {
	type ActivityRecord,
	computeProfileCompleteness,
	computeReliabilityScore,
	computeTenure,
	type SignupRecord,
} from './volunteer-profile';

// ---------------------------------------------------------------------------
// computeProfileCompleteness
// ---------------------------------------------------------------------------

describe('computeProfileCompleteness', () => {
	const fullProfile = {
		bio: 'I love volunteering',
		phone: '555-1234',
		city: 'Austin',
		state: 'TX',
		country: 'US',
		availability: 'WEEKENDS' as const,
		interests: ['mentoring', 'education'],
	};

	const fullUser = {
		name: 'Jane Doe',
		email: 'jane@example.com',
		image: 'https://example.com/photo.jpg',
	};

	it('returns 100 for a fully complete profile', () => {
		const result = computeProfileCompleteness(fullProfile, fullUser);
		expect(result.score).toBe(100);
		expect(result.level).toBe('COMPLETE');
		expect(result.missing).toHaveLength(0);
	});

	it('returns MINIMAL for empty profile and user', () => {
		const result = computeProfileCompleteness(
			{
				bio: null,
				phone: null,
				city: null,
				state: null,
				country: null,
				availability: 'FLEXIBLE',
				interests: [],
			},
			{ name: null, email: null, image: null },
		);
		// Only availability is always counted (weight 5)
		expect(result.score).toBe(5);
		expect(result.level).toBe('MINIMAL');
	});

	it('returns STRONG for profile with most fields', () => {
		const result = computeProfileCompleteness(fullProfile, {
			...fullUser,
			image: null,
		});
		// 100 - 5 (photo) = 95
		expect(result.score).toBe(95);
		expect(result.level).toBe('STRONG');
	});
});

// ---------------------------------------------------------------------------
// computeTenure
// ---------------------------------------------------------------------------

describe('computeTenure', () => {
	function daysAgo(n: number): Date {
		const d = new Date();
		d.setDate(d.getDate() - n);
		return d;
	}

	it('returns NONE and 0 years when no activities', () => {
		const result = computeTenure([]);
		expect(result.level).toBe('NONE');
		expect(result.years).toBe(0);
	});

	it('returns NONE for activity less than 1 year ago', () => {
		const activities: ActivityRecord[] = [{ recordedAt: daysAgo(200) }];
		const result = computeTenure(activities);
		expect(result.level).toBe('NONE');
		expect(result.years).toBe(0);
	});

	it('returns 1YR for activity ~14 months ago (unambiguously over 1 year)', () => {
		const activities: ActivityRecord[] = [{ recordedAt: daysAgo(430) }];
		const result = computeTenure(activities);
		expect(result.level).toBe('1YR');
		expect(result.years).toBe(1);
	});

	it('returns 1YR for activity between 1 and 3 years ago', () => {
		const activities: ActivityRecord[] = [{ recordedAt: daysAgo(600) }];
		const result = computeTenure(activities);
		expect(result.level).toBe('1YR');
	});

	it('returns 3YR for activity ~37 months ago (unambiguously over 3 years)', () => {
		const activities: ActivityRecord[] = [{ recordedAt: daysAgo(1130) }];
		const result = computeTenure(activities);
		expect(result.level).toBe('3YR');
		expect(result.years).toBe(3);
	});

	it('returns 5YR for activity ~61 months ago (unambiguously over 5 years)', () => {
		const activities: ActivityRecord[] = [{ recordedAt: daysAgo(1870) }];
		const result = computeTenure(activities);
		expect(result.level).toBe('5YR');
		expect(result.years).toBe(5);
	});

	it('returns 5YR for activity more than 7 years ago', () => {
		const activities: ActivityRecord[] = [{ recordedAt: daysAgo(2600) }];
		const result = computeTenure(activities);
		expect(result.level).toBe('5YR');
		expect(result.years).toBe(7);
	});

	it('uses the earliest activity when multiple records exist', () => {
		const activities: ActivityRecord[] = [
			{ recordedAt: daysAgo(100) },
			{ recordedAt: daysAgo(800) }, // earliest — ~26 months, 2 years
			{ recordedAt: daysAgo(50) },
		];
		const result = computeTenure(activities);
		expect(result.level).toBe('1YR');
		expect(result.years).toBe(2);
	});
});

// ---------------------------------------------------------------------------
// computeReliabilityScore
// ---------------------------------------------------------------------------

describe('computeReliabilityScore', () => {
	function makeSignup(
		status: SignupRecord['status'],
		daysAgo = 0,
	): SignupRecord {
		const d = new Date();
		d.setDate(d.getDate() - daysAgo);
		return { status, createdAt: d };
	}

	it('returns null when there are no active signups', () => {
		const result = computeReliabilityScore([], 0, 0);
		expect(result).toBeNull();
	});

	it('returns null when all signups are CANCELLED', () => {
		const signups: SignupRecord[] = [
			makeSignup('CANCELLED'),
			makeSignup('CANCELLED'),
		];
		const result = computeReliabilityScore(signups, 0, 0);
		expect(result).toBeNull();
	});

	it('returns null when only CONFIRMED signups exist (no past shifts yet)', () => {
		// CONFIRMED = upcoming commitment, not a completed shift.
		// A volunteer who just signed up but hasn't attended yet has no reliability data.
		const signups: SignupRecord[] = [
			makeSignup('CONFIRMED'),
			makeSignup('CONFIRMED'),
		];
		const result = computeReliabilityScore(signups, 0, 0);
		expect(result).toBeNull();
	});

	it('CONFIRMED signups do not count in the attendance denominator', () => {
		// 1 ATTENDED + 5 CONFIRMED upcoming → denominator should be 1, not 6.
		// Attendance rate = 1/1 = 100%, not 1/6 = 17%.
		const signups: SignupRecord[] = [
			makeSignup('ATTENDED'),
			makeSignup('CONFIRMED'),
			makeSignup('CONFIRMED'),
			makeSignup('CONFIRMED'),
			makeSignup('CONFIRMED'),
			makeSignup('CONFIRMED'),
		];
		const attendanceOnly = computeReliabilityScore(
			[makeSignup('ATTENDED')],
			0,
			0,
		);
		const withConfirmed = computeReliabilityScore(signups, 0, 0);
		// Scores should be equal — CONFIRMED entries don't affect the denominator.
		expect(withConfirmed).toBe(attendanceOnly);
	});

	it('returns 100 for perfect attendance with credentials and tenure', () => {
		const signups: SignupRecord[] = [
			makeSignup('ATTENDED'),
			makeSignup('ATTENDED'),
			makeSignup('ATTENDED'),
		];
		// 40% attendance (100%) + 30% creds (5/5 = 100%) + 20% tenure (5yr) + 10% recency
		const result = computeReliabilityScore(signups, 5, 5);
		expect(result).toBe(100);
	});

	it('returns 40 for 100% attendance but no credentials, no tenure, no recency', () => {
		const oldDate = new Date();
		oldDate.setFullYear(oldDate.getFullYear() - 2);
		const signups: SignupRecord[] = [
			{ status: 'ATTENDED', createdAt: oldDate },
		];
		const result = computeReliabilityScore(signups, 0, 0);
		// Only attendance contributes: 40% * 100% = 40
		expect(result).toBe(40);
	});

	it('returns lower score for 50% attendance rate', () => {
		const signups: SignupRecord[] = [
			makeSignup('ATTENDED'),
			makeSignup('NO_SHOW'),
		];
		const result = computeReliabilityScore(signups, 0, 0);
		// attendance: 40% * 50% = 20, credentials: 0, tenure: 0, recency: 10% * 1 = 10
		expect(result).toBe(30);
	});

	it('adds credential bonus proportionally (capped at 5 credentials)', () => {
		const signups: SignupRecord[] = [makeSignup('ATTENDED')];
		const withOne = computeReliabilityScore(signups, 1, 0);
		const withFive = computeReliabilityScore(signups, 5, 0);
		const withTen = computeReliabilityScore(signups, 10, 0); // should cap at 5

		expect(withFive).toBe(withTen); // cap at 5 credentials
		expect(withOne).toBeLessThan(withFive ?? 0);
	});

	it('adds recency bonus for signups within the last year', () => {
		const oldDate = new Date();
		oldDate.setFullYear(oldDate.getFullYear() - 2);
		const oldSignup = { status: 'ATTENDED' as const, createdAt: oldDate };
		const recentSignup = makeSignup('ATTENDED', 30); // 30 days ago

		const withoutRecency = computeReliabilityScore([oldSignup], 0, 0);
		const withRecency = computeReliabilityScore([recentSignup], 0, 0);

		expect(withRecency).toBeGreaterThan(withoutRecency ?? 0);
		// Recency bonus is 10 points
		expect((withRecency ?? 0) - (withoutRecency ?? 0)).toBe(10);
	});

	it('returns a number between 0 and 100 inclusive', () => {
		const signups: SignupRecord[] = [
			makeSignup('ATTENDED'),
			makeSignup('NO_SHOW'),
			makeSignup('CONFIRMED'),
		];
		const result = computeReliabilityScore(signups, 3, 2);
		expect(result).toBeGreaterThanOrEqual(0);
		expect(result).toBeLessThanOrEqual(100);
	});
});
