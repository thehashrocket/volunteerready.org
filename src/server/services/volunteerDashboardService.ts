import { credentialExpiryWindowEnd } from '@/server/domain/credential-expiry';
import { prisma } from '@/server/repositories/prisma';

/**
 * Fetches all data needed for the volunteer dashboard in a single call.
 * Queries are scoped to the authenticated user — no org context required.
 *
 * SECURITY: takes ONLY a user id, and deliberately no email. Both application
 * queries below used to also match `{ submittedByEmail: email,
 * submittedByUserId: null }`, which was wrong twice over:
 *
 *   1. `screener.submit` is a publicProcedure accepting an arbitrary
 *      `submittedByEmail`, so anyone could plant an orphan application bearing
 *      someone else's address and have it render on that person's dashboard as
 *      their own pending application — and steer their recommended-opportunities
 *      list toward the planting org. The companion auto-BIND was removed when
 *      `linkApplicationsToUser()` was deleted; this auto-DISPLAY outlived it.
 *   2. The address came from `ctx.session.user.email`, which under impersonation
 *      is the REAL ADMIN'S while `userId` is the target's — so an admin's own
 *      unlinked applications leaked into the impersonated volunteer's dashboard.
 *
 * An unlinked application becomes visible by exactly one route now: the user
 * claiming it from `/app/my-applications`.
 */
export async function getVolunteerDashboard(userId: string) {
	const now = new Date();
	// Shared with the staff-facing notifier and with the copy naming this
	// window here and on /screening. The helper — rather than the constant plus
	// local arithmetic — because the two queries used to compute the same 30
	// days differently and diverged across DST.
	const warningWindowEnd = credentialExpiryWindowEnd(now);

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

		// Pending applications (SUBMITTED or REVIEW status), linked to this user only
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

		// Credentials inside the shared expiry warning window
		// (CREDENTIAL_EXPIRY_WARNING_DAYS — see credentialExpiryWindowEnd).
		prisma.volunteerCredential.findMany({
			where: {
				userId,
				status: 'VERIFIED',
				expiresAt: { lte: warningWindowEnd, gte: now },
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
