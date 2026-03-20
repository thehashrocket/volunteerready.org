/**
 * Org Analytics Repository — raw SQL aggregate queries.
 *
 * All queries are org-scoped. Uses Prisma.$queryRaw with parameterized
 * template literals to prevent SQL injection.
 *
 * Schema coupling risk: if column names change, queries break at runtime.
 * Mitigated by integration tests (see TODOS P2).
 */

import { prisma } from '@/server/repositories/prisma';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ApplicationFunnelStats = {
	/** Applications submitted in the period. */
	submitted: number;
	/** Applications that reached APPROVED status. */
	approved: number;
	/** Distinct volunteers who ATTENDED at least one shift in the period. */
	shifted: number;
	/** Distinct volunteers who received a VERIFIED credential from this org in the period. */
	credentialed: number;
};

export type RetentionStats = {
	/** Distinct volunteers with shift activity in the period. */
	activeVolunteers: number;
	/** Of active volunteers, how many had prior activity before the period. */
	returningVolunteers: number;
};

export type TopVolunteerRow = {
	userId: string;
	displayName: string;
	totalHours: number;
	verifiedCredentialCount: number;
	lastActiveAt: Date | null;
};

export type CheckinAnalytics = {
	qrCheckins: number;
	manualCheckins: number;
	geoCheckins: number;
	totalCheckins: number;
	hourBuckets: { hour: number; count: number }[];
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Application pipeline funnel for the org since `fromDate`.
 * Each stage is an independent aggregate — stages 3 and 4 are not
 * sub-cohorts of stage 1/2 (they measure distinct pipeline dimensions).
 */
export async function getApplicationFunnel(
	orgId: string,
	fromDate: Date,
): Promise<ApplicationFunnelStats> {
	const [submitted, approved, shifted, credentialed] = await Promise.all([
		prisma.$queryRaw<[{ count: bigint }]>`
			SELECT COUNT(*) AS count
			FROM "VolunteerApplication"
			WHERE "orgId" = ${orgId}
			  AND "submittedAt" >= ${fromDate}
		`,
		prisma.$queryRaw<[{ count: bigint }]>`
			SELECT COUNT(*) AS count
			FROM "VolunteerApplication"
			WHERE "orgId" = ${orgId}
			  AND status = 'APPROVED'
			  AND "submittedAt" >= ${fromDate}
		`,
		prisma.$queryRaw<[{ count: bigint }]>`
			SELECT COUNT(DISTINCT ss."userId") AS count
			FROM "ShiftSignup" ss
			JOIN "Shift" sh ON sh.id = ss."shiftId"
			WHERE sh."orgId" = ${orgId}
			  AND ss.status = 'ATTENDED'
			  AND ss."createdAt" >= ${fromDate}
		`,
		prisma.$queryRaw<[{ count: bigint }]>`
			SELECT COUNT(DISTINCT vc."userId") AS count
			FROM "VolunteerCredential" vc
			WHERE vc."orgId" = ${orgId}
			  AND vc.status = 'VERIFIED'
			  AND (vc."issuedAt" IS NULL OR vc."issuedAt" >= ${fromDate})
		`,
	]);

	return {
		submitted: Number(submitted[0]?.count ?? 0),
		approved: Number(approved[0]?.count ?? 0),
		shifted: Number(shifted[0]?.count ?? 0),
		credentialed: Number(credentialed[0]?.count ?? 0),
	};
}

/**
 * Volunteer retention: active volunteers in the period vs volunteers
 * who had prior activity (returning = "we've seen them before").
 *
 * fromDate defines the start of the "current period". Prior activity is
 * anything before fromDate.
 */
export async function getRetentionStats(
	orgId: string,
	fromDate: Date,
): Promise<RetentionStats> {
	const rows = await prisma.$queryRaw<
		[{ active_volunteers: bigint; returning_volunteers: bigint }]
	>`
		SELECT
			COUNT(DISTINCT curr.user_id) AS active_volunteers,
			COUNT(DISTINCT CASE WHEN prev.user_id IS NOT NULL THEN curr.user_id END)
				AS returning_volunteers
		FROM (
			SELECT DISTINCT ss."userId" AS user_id
			FROM "ShiftSignup" ss
			JOIN "Shift" sh ON sh.id = ss."shiftId"
			WHERE sh."orgId" = ${orgId}
			  AND ss.status IN ('ATTENDED', 'CONFIRMED')
			  AND ss."createdAt" >= ${fromDate}
		) curr
		LEFT JOIN (
			SELECT DISTINCT ss."userId" AS user_id
			FROM "ShiftSignup" ss
			JOIN "Shift" sh ON sh.id = ss."shiftId"
			WHERE sh."orgId" = ${orgId}
			  AND ss.status IN ('ATTENDED', 'CONFIRMED')
			  AND ss."createdAt" < ${fromDate}
		) prev ON prev.user_id = curr.user_id
	`;

	return {
		activeVolunteers: Number(rows[0]?.active_volunteers ?? 0),
		returningVolunteers: Number(rows[0]?.returning_volunteers ?? 0),
	};
}

/**
 * Average shift fill rate (confirmed + attended / capacity) across all
 * non-cancelled shifts since fromDate.
 */
export async function getAvgFillRate(
	orgId: string,
	fromDate: Date,
): Promise<number> {
	const rows = await prisma.$queryRaw<[{ avg_fill_rate: number | null }]>`
		SELECT AVG(
			CASE WHEN sh.capacity > 0 THEN
				CAST(
					(SELECT COUNT(*) FROM "ShiftSignup" ss2
					 WHERE ss2."shiftId" = sh.id
					   AND ss2.status IN ('CONFIRMED', 'ATTENDED'))
				AS FLOAT) / sh.capacity
			ELSE NULL END
		) AS avg_fill_rate
		FROM "Shift" sh
		WHERE sh."orgId" = ${orgId}
		  AND sh."startTime" >= ${fromDate}
		  AND sh.status != 'CANCELLED'
	`;

	const rate = rows[0]?.avg_fill_rate;
	return rate !== null && rate !== undefined ? Math.round(rate * 100) : 0;
}

/**
 * Top volunteers by ATTENDED hours for this org.
 * Returns at most `limit` rows, sorted by hours DESC.
 */
export async function getTopVolunteers(
	orgId: string,
	limit: number,
	fromDate: Date,
): Promise<TopVolunteerRow[]> {
	const rows = await prisma.$queryRaw<
		{
			user_id: string;
			display_name: string | null;
			total_hours: number | null;
			verified_credential_count: bigint;
			last_active_at: Date | null;
		}[]
	>`
		SELECT
			u.id AS user_id,
			u.name AS display_name,
			SUM(
				EXTRACT(EPOCH FROM (sh."endTime" - sh."startTime")) / 3600.0
			) AS total_hours,
			(
				SELECT COUNT(*)
				FROM "VolunteerCredential" vc
				WHERE vc."userId" = u.id
				  AND vc."orgId" = ${orgId}
				  AND vc.status = 'VERIFIED'
			) AS verified_credential_count,
			MAX(ss."createdAt") AS last_active_at
		FROM "ShiftSignup" ss
		JOIN "Shift" sh ON sh.id = ss."shiftId"
		JOIN "User" u ON u.id = ss."userId"
		WHERE sh."orgId" = ${orgId}
		  AND ss.status = 'ATTENDED'
		  AND ss."createdAt" >= ${fromDate}
		GROUP BY u.id, u.name
		ORDER BY total_hours DESC NULLS LAST
		LIMIT ${limit}
	`;

	return rows.map((r) => ({
		userId: r.user_id,
		displayName: r.display_name ?? 'Unknown',
		totalHours: Math.round((r.total_hours ?? 0) * 10) / 10,
		verifiedCredentialCount: Number(r.verified_credential_count),
		lastActiveAt: r.last_active_at,
	}));
}

/**
 * Check-in analytics: method breakdown (QR vs manual vs geo) and
 * busiest check-in hours. Uses AuditLog metadata to determine method.
 * Pre-QR entries default to 'manual' via COALESCE.
 */
export async function getCheckinAnalytics(
	orgId: string,
	fromDate: Date,
): Promise<CheckinAnalytics> {
	const [methodRows, hourRows] = await Promise.all([
		prisma.$queryRaw<{ method: string; count: bigint }[]>`
			SELECT
				COALESCE(al.metadata->>'method', 'manual') AS method,
				COUNT(*) AS count
			FROM "AuditLog" al
			WHERE al."orgId" = ${orgId}
			  AND al."entityType" = 'ShiftSignup'
			  AND al.action = 'shift.attendance.attended'
			  AND al."createdAt" >= ${fromDate}
			GROUP BY COALESCE(al.metadata->>'method', 'manual')
		`,
		prisma.$queryRaw<{ hour: number; count: bigint }[]>`
			SELECT
				EXTRACT(HOUR FROM al."createdAt") AS hour,
				COUNT(*) AS count
			FROM "AuditLog" al
			WHERE al."orgId" = ${orgId}
			  AND al."entityType" = 'ShiftSignup'
			  AND al.action = 'shift.attendance.attended'
			  AND al."createdAt" >= ${fromDate}
			GROUP BY EXTRACT(HOUR FROM al."createdAt")
			ORDER BY hour
		`,
	]);

	const methodMap: Record<string, number> = {};
	for (const row of methodRows) {
		methodMap[row.method] = Number(row.count);
	}

	return {
		qrCheckins: methodMap.qr ?? 0,
		manualCheckins: methodMap.manual ?? 0,
		geoCheckins: methodMap.geo ?? 0,
		totalCheckins:
			(methodMap.qr ?? 0) + (methodMap.manual ?? 0) + (methodMap.geo ?? 0),
		hourBuckets: hourRows.map((r) => ({
			hour: Number(r.hour),
			count: Number(r.count),
		})),
	};
}
