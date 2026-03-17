import { prisma } from './prisma';

export type PlatformStats = {
	orgCount: number;
	credentialCount: number;
	shiftCount: number;
	volunteerCount: number;
};

/**
 * Aggregate platform-wide stats for the public homepage social proof section.
 * Returns zeros on any error (graceful degradation — homepage never breaks).
 *
 * Tables counted:
 *   Organization       → total orgs on platform
 *   VolunteerCredential → verified credentials issued
 *   Shift               → shifts completed
 *   User                → volunteers (users with at least one application)
 */
export async function getPlatformStats(): Promise<PlatformStats> {
	try {
		const [orgCount, credentialCount, shiftCount, volunteerCount] =
			await Promise.all([
				prisma.organization.count(),
				prisma.volunteerCredential.count({
					where: { status: 'VERIFIED' },
				}),
				prisma.shift.count({ where: { status: 'COMPLETED' } }),
				prisma.volunteerApplication.groupBy({
					by: ['submittedByUserId'],
					where: { submittedByUserId: { not: null } },
				}),
			]);

		return {
			orgCount,
			credentialCount,
			shiftCount,
			volunteerCount: volunteerCount.length,
		};
	} catch {
		return {
			orgCount: 0,
			credentialCount: 0,
			shiftCount: 0,
			volunteerCount: 0,
		};
	}
}
