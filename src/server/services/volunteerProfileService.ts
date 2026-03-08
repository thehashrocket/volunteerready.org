import { computeProfileCompleteness } from '@/server/domain/volunteer-profile';
import { writeAuditLogTx } from '@/server/repositories/auditRepo';
import { prisma } from '@/server/repositories/prisma';
import {
	getProfileByUserId,
	getProfileWithUser,
	type UpsertProfileInput,
	upsertProfile,
} from '@/server/repositories/volunteerProfileRepo';

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** Get a volunteer's profile, or null. */
export async function getVolunteerProfile(userId: string) {
	return getProfileByUserId(userId);
}

/** Get profile + completeness scoring. */
export async function getVolunteerProfileWithCompleteness(userId: string) {
	const record = await getProfileWithUser(userId);

	if (!record) {
		// No profile yet — compute completeness with defaults
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { name: true, email: true, image: true },
		});

		if (!user) return null;

		const completeness = computeProfileCompleteness(
			{
				bio: null,
				phone: null,
				city: null,
				state: null,
				country: null,
				availability: 'FLEXIBLE',
				interests: [],
			},
			user,
		);

		return { profile: null, completeness };
	}

	const completeness = computeProfileCompleteness(
		{
			bio: record.bio,
			phone: record.phone,
			city: record.city,
			state: record.state,
			country: record.country,
			availability: record.availability,
			interests: record.interests,
		},
		record.user,
	);

	return { profile: record, completeness };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/** Create or update a volunteer profile with audit logging. */
export async function saveVolunteerProfile(input: UpsertProfileInput) {
	return prisma.$transaction(async (tx) => {
		const profile = await upsertProfile(tx, input);

		await writeAuditLogTx(tx, {
			orgId: 'SYSTEM',
			actorId: input.userId,
			action: 'VOLUNTEER_PROFILE_UPDATED',
			entityType: 'VolunteerProfile',
			entityId: profile.id,
		});

		return profile;
	});
}
