export type PlatformStats = {
	orgCount: number;
	credentialCount: number;
	shiftCount: number;
	volunteerCount: number;
};

const ZERO_STATS: PlatformStats = {
	orgCount: 0,
	credentialCount: 0,
	shiftCount: 0,
	volunteerCount: 0,
};

/**
 * Aggregate platform-wide stats for the public homepage social proof section.
 * Returns zeros on any error (graceful degradation — homepage never breaks).
 *
 * Uses dynamic import so that a missing DATABASE_URL (which throws at
 * prisma module init) is caught instead of crashing the page.
 */
export async function getPlatformStats(): Promise<PlatformStats> {
	try {
		const { prisma } = await import('./prisma');

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
		return ZERO_STATS;
	}
}
