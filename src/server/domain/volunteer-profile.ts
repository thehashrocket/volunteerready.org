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
	| 'ORIENTATION_COMPLETE';

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
