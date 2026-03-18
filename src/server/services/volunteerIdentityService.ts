/**
 * Volunteer Identity Service — public-facing volunteer profile assembly.
 *
 * Two exported functions:
 *   - getPublicProfile   — internet-facing; returns data only for PUBLIC profiles
 *   - getOrgVisibleProfile — org screener use; returns data for PUBLIC + ORGS_ONLY
 *
 * Both return null for not-found AND for invisible profiles — identical response
 * prevents callers from distinguishing the two cases (no information leakage).
 */
import { cache } from 'react';
import type { CredentialType } from '@/prisma/generated/client';
import {
	CREDENTIAL_LABELS,
	computeReliabilityScore,
	computeTenure,
	type TenureLevel,
} from '@/server/domain/volunteer-profile';
import {
	getAttendedShiftsForUser,
	getSignupsForReliability,
} from '@/server/repositories/shiftSignupRepo';
import { getCredentialsByUserId } from '@/server/repositories/volunteerCredentialRepo';
import { getProfileWithUser } from '@/server/repositories/volunteerProfileRepo';

export interface VolunteerCredentialSummary {
	type: CredentialType;
	label: string;
	issuedAt: Date | null;
	orgName: string;
}

export interface PublicVolunteerProfile {
	displayName: string;
	bio: string | null;
	city: string | null;
	state: string | null;
	credentials: VolunteerCredentialSummary[];
	/** Total attended volunteer hours, rounded to nearest integer. */
	totalHours: number;
	/** Number of distinct organizations the volunteer has attended shifts for. */
	orgCount: number;
	memberSince: Date;
	reliabilityScore: number | null;
	tenureLevel: TenureLevel;
	// NEVER: phone, email, applicationData, financialData
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

type ProfileWithUser = NonNullable<
	Awaited<ReturnType<typeof getProfileWithUser>>
>;

/** Assemble the data shape from a pre-fetched profile record. */
async function assembleProfile(
	profileWithUser: ProfileWithUser,
): Promise<PublicVolunteerProfile> {
	const userId = profileWithUser.userId;

	const [credentials, attendedShifts, signups] = await Promise.all([
		getCredentialsByUserId(userId),
		getAttendedShiftsForUser(userId),
		getSignupsForReliability(userId),
	]);

	// Only expose VERIFIED credentials on the profile
	const verifiedCredentials: VolunteerCredentialSummary[] = credentials
		.filter((c) => c.status === 'VERIFIED')
		.map((c) => ({
			type: c.type,
			label:
				CREDENTIAL_LABELS[c.type as keyof typeof CREDENTIAL_LABELS] ?? c.type,
			issuedAt: c.issuedAt,
			orgName: c.organization.name,
		}));

	// Total hours = sum of (endTime - startTime) for ATTENDED shifts
	const totalHours = Math.round(
		attendedShifts.reduce((sum, signup) => {
			const { startTime, endTime } = signup.shift;
			if (!startTime || !endTime) return sum;
			return sum + (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
		}, 0),
	);

	// Distinct orgs from attended shifts
	const orgIds = new Set(attendedShifts.map((s) => s.shift.orgId));
	const orgCount = orgIds.size;

	// Activity records for tenure computation
	const activityRecords = attendedShifts.map((s) => ({
		recordedAt: s.createdAt,
	}));
	const tenureResult = computeTenure(activityRecords);

	const signupRecords = signups.map((s) => ({
		status: s.status as 'CONFIRMED' | 'ATTENDED' | 'NO_SHOW' | 'CANCELLED',
		createdAt: s.createdAt,
	}));
	const reliabilityScore = computeReliabilityScore(
		signupRecords,
		verifiedCredentials.length,
		tenureResult.years,
	);

	return {
		displayName: profileWithUser.user.name ?? 'Volunteer',
		bio: profileWithUser.bio,
		city: profileWithUser.city,
		state: profileWithUser.state,
		credentials: verifiedCredentials,
		totalHours,
		orgCount,
		memberSince: profileWithUser.user.createdAt,
		reliabilityScore,
		tenureLevel: tenureResult.level,
	};
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Assemble the public-facing profile for a volunteer.
 *
 * Returns null for not-found AND for non-PUBLIC profiles — identical response
 * prevents callers from distinguishing the two cases (security requirement).
 *
 * Use getOrgVisibleProfile for authenticated org screeners, which also
 * respects ORGS_ONLY visibility.
 */
export const getPublicProfile = cache(async function getPublicProfile(
	userId: string,
): Promise<PublicVolunteerProfile | null> {
	const profileWithUser = await getProfileWithUser(userId);
	if (!profileWithUser) return null;
	if (profileWithUser.visibility !== 'PUBLIC') return null;
	return assembleProfile(profileWithUser);
});

/**
 * Assemble a volunteer's profile for authenticated org screeners.
 *
 * Respects PUBLIC and ORGS_ONLY visibility — volunteers who set ORGS_ONLY
 * want their identity visible to orgs they apply to, not the public internet.
 * PRIVATE profiles still return null.
 *
 * Returns null for not-found AND for PRIVATE profiles — identical response
 * prevents callers from distinguishing the two cases.
 */
export async function getOrgVisibleProfile(
	userId: string,
): Promise<PublicVolunteerProfile | null> {
	const profileWithUser = await getProfileWithUser(userId);
	if (!profileWithUser) return null;
	if (profileWithUser.visibility === 'PRIVATE') return null;
	// PUBLIC and ORGS_ONLY are both visible to authenticated org screeners.
	return assembleProfile(profileWithUser);
}
