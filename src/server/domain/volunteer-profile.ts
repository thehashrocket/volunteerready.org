/**
 * Volunteer Profile — pure domain logic.
 *
 * Profile completeness scoring and credential validation rules.
 * No framework imports — pure types and functions only.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AvailabilityType =
	| 'WEEKDAYS'
	| 'WEEKENDS'
	| 'EVENINGS'
	| 'FLEXIBLE';

export type ProfileVisibility = 'PUBLIC' | 'ORGS_ONLY' | 'PRIVATE';

export type CredentialType =
	| 'BACKGROUND_CHECK'
	| 'TRAINING_COMPLETE'
	| 'ID_VERIFIED'
	| 'REFERENCE_CHECK'
	| 'ORIENTATION_COMPLETE'
	| 'TENURE_1YR'
	| 'TENURE_3YR'
	| 'TENURE_5YR';

export type CredentialStatus = 'PENDING' | 'VERIFIED' | 'EXPIRED' | 'REVOKED';

/** Minimal profile shape for completeness scoring. */
export interface ProfileData {
	bio: string | null;
	phone: string | null;
	city: string | null;
	state: string | null;
	country: string | null;
	availability: AvailabilityType;
	interests: string[];
}

/** User-level fields that contribute to profile completeness. */
export interface UserIdentity {
	name: string | null;
	email: string | null;
	image: string | null;
}

export interface ProfileCompleteness {
	/** 0–100 score */
	score: number;
	/** Fields that are filled */
	completed: string[];
	/** Fields that are missing */
	missing: string[];
	/** Human-friendly label */
	level: CompletenessLevel;
}

export type CompletenessLevel = 'COMPLETE' | 'STRONG' | 'BASIC' | 'MINIMAL';

export interface CredentialRecord {
	type: CredentialType;
	status: CredentialStatus;
	issuedAt: Date | null;
	expiresAt: Date | null;
}

export interface CredentialSummary {
	total: number;
	verified: number;
	pending: number;
	expired: number;
	revoked: number;
}

// ---------------------------------------------------------------------------
// Profile Completeness
// ---------------------------------------------------------------------------

/**
 * Fields and their weights for profile completeness scoring.
 *
 * Max possible = sum of all weights = 100.
 */
const PROFILE_FIELDS: {
	field: string;
	weight: number;
	check: (p: ProfileData, u: UserIdentity) => boolean;
}[] = [
	{ field: 'name', weight: 20, check: (_p, u) => Boolean(u.name?.trim()) },
	{ field: 'email', weight: 15, check: (_p, u) => Boolean(u.email?.trim()) },
	{ field: 'photo', weight: 5, check: (_p, u) => Boolean(u.image?.trim()) },
	{ field: 'bio', weight: 15, check: (p) => Boolean(p.bio?.trim()) },
	{ field: 'phone', weight: 10, check: (p) => Boolean(p.phone?.trim()) },
	{
		field: 'location',
		weight: 15,
		check: (p) =>
			Boolean(p.city?.trim() || p.state?.trim() || p.country?.trim()),
	},
	{ field: 'availability', weight: 5, check: () => true }, // always set (has default)
	{ field: 'interests', weight: 15, check: (p) => p.interests.length > 0 },
];

/**
 * Calculate how complete a volunteer's profile is.
 *
 * Considers both user-level fields (name, email, photo) and
 * profile-level fields (bio, phone, location, availability, interests).
 */
export function computeProfileCompleteness(
	profile: ProfileData,
	user: UserIdentity,
): ProfileCompleteness {
	const completed: string[] = [];
	const missing: string[] = [];
	let score = 0;

	for (const { field, weight, check } of PROFILE_FIELDS) {
		if (check(profile, user)) {
			completed.push(field);
			score += weight;
		} else {
			missing.push(field);
		}
	}

	return {
		score,
		completed,
		missing,
		level: scoreToLevel(score),
	};
}

function scoreToLevel(score: number): CompletenessLevel {
	if (score >= 100) return 'COMPLETE';
	if (score >= 70) return 'STRONG';
	if (score >= 40) return 'BASIC';
	return 'MINIMAL';
}

// ---------------------------------------------------------------------------
// Credential Helpers
// ---------------------------------------------------------------------------

/** Human-friendly label for credential types. */
export const CREDENTIAL_LABELS: Record<CredentialType, string> = {
	BACKGROUND_CHECK: 'Background Check',
	TRAINING_COMPLETE: 'Training Complete',
	ID_VERIFIED: 'ID Verified',
	REFERENCE_CHECK: 'Reference Check',
	ORIENTATION_COMPLETE: 'Orientation Complete',
	TENURE_1YR: '1 Year Volunteer',
	TENURE_3YR: '3 Year Volunteer',
	TENURE_5YR: '5 Year Volunteer',
};

/** Check whether a credential is currently valid (verified + not expired). */
export function isCredentialValid(
	credential: CredentialRecord,
	now: Date = new Date(),
): boolean {
	if (credential.status !== 'VERIFIED') return false;
	if (credential.expiresAt && credential.expiresAt < now) return false;
	return true;
}

/** Summarize a set of credentials into counts by status. */
export function summarizeCredentials(
	credentials: CredentialRecord[],
): CredentialSummary {
	const summary: CredentialSummary = {
		total: credentials.length,
		verified: 0,
		pending: 0,
		expired: 0,
		revoked: 0,
	};

	for (const c of credentials) {
		switch (c.status) {
			case 'VERIFIED':
				summary.verified++;
				break;
			case 'PENDING':
				summary.pending++;
				break;
			case 'EXPIRED':
				summary.expired++;
				break;
			case 'REVOKED':
				summary.revoked++;
				break;
		}
	}

	return summary;
}

// ---------------------------------------------------------------------------
// Tenure Computation (Phase 7)
// ---------------------------------------------------------------------------

export const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

export type TenureLevel = 'NONE' | '1YR' | '3YR' | '5YR';

export interface TenureResult {
	/** Full years of volunteer tenure, based on earliest recorded activity. */
	years: number;
	level: TenureLevel;
}

/** Minimal activity record for tenure computation. */
export interface ActivityRecord {
	recordedAt: Date;
}

/**
 * Compute a volunteer's tenure level from their activity history.
 *
 * Tenure clock starts from the earliest recorded activity (application or
 * shift signup), not from account creation. Returns NONE if no activity.
 */
export function computeTenure(
	activities: ActivityRecord[],
	now: Date = new Date(),
): TenureResult {
	if (activities.length === 0) {
		return { years: 0, level: 'NONE' };
	}

	const earliest = activities.reduce((min, a) =>
		a.recordedAt < min.recordedAt ? a : min,
	).recordedAt;

	const msPerYear = MS_PER_YEAR;
	const years = Math.floor((now.getTime() - earliest.getTime()) / msPerYear);

	let level: TenureLevel;
	if (years >= 5) {
		level = '5YR';
	} else if (years >= 3) {
		level = '3YR';
	} else if (years >= 1) {
		level = '1YR';
	} else {
		level = 'NONE';
	}

	return { years, level };
}

// ---------------------------------------------------------------------------
// Reliability Score (Phase 7)
// ---------------------------------------------------------------------------

/** Minimal signup record for reliability computation. */
export interface SignupRecord {
	status: 'CONFIRMED' | 'WAITLISTED' | 'ATTENDED' | 'NO_SHOW' | 'CANCELLED';
	createdAt: Date;
}

const RELIABILITY_WEIGHTS = {
	attendance: 0.4,
	credentials: 0.3,
	tenure: 0.2,
	recency: 0.1,
} as const;

const MAX_CREDENTIAL_SCORE_AT = 5;
const MAX_TENURE_YEARS = 5;

/**
 * Compute a 0–100 reliability score for a volunteer.
 *
 * Returns null when there are no past completed shifts — distinguishing "no data"
 * from "poor attendee". Callers must render null as "no data" rather than 0.
 *
 * Formula:
 *   - 40% attendance rate (ATTENDED / (ATTENDED + NO_SHOW)) — past shifts only
 *   - 30% verified credential count (capped at 5)
 *   - 20% tenure years (capped at 5)
 *   - 10% recency: any signup in the last 365 days (includes CONFIRMED upcoming)
 *
 * CONFIRMED signups are intentionally excluded from the attendance denominator.
 * Counting upcoming shifts would penalise active volunteers who haven't attended
 * them yet — reliability should reflect past behaviour only.
 */
export function computeReliabilityScore(
	signups: SignupRecord[],
	verifiedCredentialCount: number,
	tenureYears: number,
	now: Date = new Date(),
): number | null {
	// Past completed shifts only — CONFIRMED (upcoming) excluded from denominator.
	const active = signups.filter(
		(s) => s.status === 'ATTENDED' || s.status === 'NO_SHOW',
	);

	if (active.length === 0) return null;

	const attended = active.filter((s) => s.status === 'ATTENDED').length;
	const attendanceRate = attended / active.length;

	const credentialScore =
		Math.min(verifiedCredentialCount, MAX_CREDENTIAL_SCORE_AT) /
		MAX_CREDENTIAL_SCORE_AT;

	const tenureScore =
		Math.min(tenureYears, MAX_TENURE_YEARS) / MAX_TENURE_YEARS;

	const msPerYear = MS_PER_YEAR;
	const hasRecentActivity = signups.some(
		(s) => now.getTime() - s.createdAt.getTime() < msPerYear,
	);
	const recencyScore = hasRecentActivity ? 1 : 0;

	const raw =
		attendanceRate * RELIABILITY_WEIGHTS.attendance +
		credentialScore * RELIABILITY_WEIGHTS.credentials +
		tenureScore * RELIABILITY_WEIGHTS.tenure +
		recencyScore * RELIABILITY_WEIGHTS.recency;

	return Math.round(raw * 100);
}
