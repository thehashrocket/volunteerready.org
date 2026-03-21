import { prisma } from '@/server/repositories/prisma';

/**
 * Fetches all data needed for the volunteer dashboard in a single call.
 * Queries are scoped to the authenticated user — no org context required.
 */
export async function getVolunteerDashboard(userId: string) {
	const now = new Date();
	const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

	const [
		upcomingShifts,
		pendingApplications,
		expiringCredentials,
		impactStats,
		recentOpportunities,
	] = await Promise.all([
		// Next 3 upcoming confirmed shifts
		prisma.shiftSignup.findMany({
			where: {
				userId,
				status: 'CONFIRMED',
				shift: {
					startTime: { gte: now },
					status: { in: ['OPEN', 'FULL'] },
				},
			},
			orderBy: { shift: { startTime: 'asc' } },
			take: 3,
			select: {
				id: true,
				shift: {
					select: {
						id: true,
						title: true,
						startTime: true,
						endTime: true,
						location: true,
						organization: {
							select: { id: true, name: true, slug: true },
						},
					},
				},
			},
		}),

		// Pending applications (SUBMITTED or REVIEW status)
		prisma.volunteerApplication.findMany({
			where: {
				submittedByUserId: userId,
				status: { in: ['SUBMITTED', 'REVIEW'] },
			},
			orderBy: { submittedAt: 'desc' },
			take: 5,
			select: {
				id: true,
				status: true,
				submittedAt: true,
				opportunity: {
					select: { id: true, title: true },
				},
				organization: {
					select: { id: true, name: true, slug: true },
				},
			},
		}),

		// Credentials expiring within 30 days
		prisma.volunteerCredential.findMany({
			where: {
				userId,
				status: 'VERIFIED',
				expiresAt: { lte: thirtyDaysFromNow, gte: now },
			},
			orderBy: { expiresAt: 'asc' },
			take: 5,
			select: {
				id: true,
				type: true,
				expiresAt: true,
				organization: {
					select: { id: true, name: true },
				},
			},
		}),

		// Impact summary: DB-side aggregation for hours + orgs + shift count
		Promise.all([
			prisma.$queryRaw<
				[
					{
						total_minutes: bigint | null;
						orgs_served: bigint;
						shifts_attended: bigint;
					},
				]
			>`
				SELECT
					COALESCE(SUM(EXTRACT(EPOCH FROM (s."endTime" - s."startTime")) / 60), 0) AS total_minutes,
					COUNT(DISTINCT s."orgId") AS orgs_served,
					COUNT(*) AS shifts_attended
				FROM "ShiftSignup" ss
				JOIN "Shift" s ON s.id = ss."shiftId"
				WHERE ss."userId" = ${userId} AND ss.status = 'ATTENDED'
			`,
			prisma.volunteerCredential.count({
				where: { userId, status: 'VERIFIED' },
			}),
		]).then(([rows, verifiedCredentials]) => {
			const row = rows[0];
			return {
				totalHours: Math.round(Number(row?.total_minutes ?? 0) / 60),
				orgsServed: Number(row?.orgs_served ?? 0),
				shiftsAttended: Number(row?.shifts_attended ?? 0),
				verifiedCredentials,
			};
		}),

		// Top 3 recommended opportunities (published, from orgs the volunteer has interacted with)
		prisma.volunteerApplication
			.findMany({
				where: { submittedByUserId: userId },
				select: { orgId: true },
				distinct: ['orgId'],
			})
			.then((apps) => {
				const orgIds = apps.map((a) => a.orgId);
				if (orgIds.length === 0) return [];

				return prisma.volunteerOpportunity.findMany({
					where: {
						orgId: { in: orgIds },
						status: 'PUBLISHED',
					},
					orderBy: { createdAt: 'desc' },
					take: 3,
					select: {
						id: true,
						title: true,
						isRemote: true,
						location: true,
						organization: {
							select: { id: true, name: true, slug: true },
						},
					},
				});
			}),
	]);

	return {
		upcomingShifts,
		pendingApplications,
		expiringCredentials,
		impact: impactStats,
		recommendedOpportunities: recentOpportunities,
	};
}
