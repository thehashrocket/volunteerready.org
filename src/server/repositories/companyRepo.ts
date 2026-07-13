import type {
	CompanyMemberRole,
	CompanyNonprofitLinkStatus,
	PlanTier,
	PrismaClient,
} from '@/prisma/generated/client';
import { prisma } from './prisma';

type TxClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

/**
 * Returns company fields safe to send to the client.
 * stripeCustomerId / stripeSubscriptionId are intentionally omitted.
 */
export async function findCompanyById(id: string) {
	return prisma.companyAccount.findUnique({
		where: { id },
		select: {
			id: true,
			name: true,
			slug: true,
			planTier: true,
			trialEndsAt: true,
			createdAt: true,
			updatedAt: true,
		},
	});
}

export async function findCompanyBySlug(slug: string) {
	return prisma.companyAccount.findUnique({
		where: { slug },
		select: { id: true, slug: true },
	});
}

export async function findCompanyByStripeCustomerId(stripeCustomerId: string) {
	return prisma.companyAccount.findUnique({
		where: { stripeCustomerId },
		select: { id: true, planTier: true, stripeCustomerId: true },
	});
}

export async function findCompanyWithOwnerEmail(companyId: string) {
	return prisma.companyAccount.findUnique({
		where: { id: companyId },
		select: {
			id: true,
			name: true,
			members: {
				where: { role: 'OWNER' },
				take: 1,
				select: { user: { select: { email: true, name: true } } },
			},
		},
	});
}

export async function createCompanyWithOwnerTx(
	tx: TxClient,
	{
		name,
		slug,
		userId,
		sessionToken,
	}: { name: string; slug: string; userId: string; sessionToken: string },
) {
	const company = await tx.companyAccount.create({
		data: { name, slug },
		select: { id: true, slug: true },
	});

	await tx.companyMember.create({
		data: { companyId: company.id, userId, role: 'OWNER' },
	});

	await tx.session.update({
		where: { sessionToken },
		data: { currentCompanyId: company.id },
	});

	return company;
}

export async function updateCompanyPlanTx(
	tx: TxClient,
	companyId: string,
	data: {
		planTier: PlanTier;
		stripeSubscriptionId?: string | null;
		trialEndsAt?: Date | null;
	},
) {
	return tx.companyAccount.update({
		where: { id: companyId },
		data,
		select: { id: true, planTier: true },
	});
}

export async function listCompaniesForUser(userId: string) {
	const memberships = await prisma.companyMember.findMany({
		where: { userId },
		orderBy: { createdAt: 'asc' },
		select: {
			role: true,
			company: {
				select: {
					id: true,
					name: true,
					slug: true,
					planTier: true,
				},
			},
		},
	});
	return memberships;
}

export async function getCompanyMembership(
	userId: string,
	companyId: string,
): Promise<{ role: CompanyMemberRole } | null> {
	return prisma.companyMember.findUnique({
		where: { companyId_userId: { companyId, userId } },
		select: { role: true },
	});
}

export async function upsertNonprofitLinkTx(
	tx: TxClient,
	{ companyId, orgId }: { companyId: string; orgId: string },
) {
	return tx.companyNonprofitLink.upsert({
		where: { companyId_orgId: { companyId, orgId } },
		create: { companyId, orgId, status: 'ACTIVE' },
		update: { status: 'ACTIVE' },
		select: { id: true, status: true },
	});
}

export async function setNonprofitLinkStatusTx(
	tx: TxClient,
	linkId: string,
	status: CompanyNonprofitLinkStatus,
) {
	return tx.companyNonprofitLink.update({
		where: { id: linkId },
		data: { status },
		select: { id: true, status: true },
	});
}

export async function listLinkedNonprofits(companyId: string) {
	return prisma.companyNonprofitLink.findMany({
		where: { companyId, status: 'ACTIVE' },
		orderBy: { createdAt: 'asc' },
		select: {
			id: true,
			status: true,
			createdAt: true,
			org: { select: { id: true, name: true, slug: true } },
		},
	});
}

// ---- ESG Report queries ---------------------------------------------------

export async function getCompanyPlanTier(companyId: string): Promise<PlanTier> {
	const company = await prisma.companyAccount.findUniqueOrThrow({
		where: { id: companyId },
		select: { planTier: true },
	});
	return company.planTier;
}

type ESGShiftRow = {
	orgId: string;
	orgName: string;
	employeeCount: number;
	shiftCount: number;
	totalHours: number;
};

/**
 * Aggregate shift activity per linked nonprofit for a company's employees.
 *
 * Joins:
 *   CompanyNonprofitLink → Organization → Shift → ShiftSignup (ATTENDED)
 *                                                  ↕
 *                                        CompanyMember (same company)
 *
 * Only counts shifts where the volunteer is both:
 *   1. A member of the company
 *   2. Signed up with ATTENDED status at a linked nonprofit
 *
 * Optional date filters are NULL-checked inside a single static template
 * instead of composed with Prisma.sql/Prisma.join — composed Sql fragments
 * break under `next dev` (Turbopack duplicates the generated client's Sql
 * class across module graphs, `instanceof` fails, and the fragment is sent
 * to Postgres as one literal parameter). See CLAUDE.md Rules.
 */
export async function getESGShiftAggregates(
	companyId: string,
	dateRange: { from?: Date | null; to?: Date | null },
): Promise<ESGShiftRow[]> {
	const from = dateRange.from ?? null;
	const to = dateRange.to ?? null;

	const rows = await prisma.$queryRaw<
		{
			orgId: string;
			orgName: string;
			employeeCount: bigint;
			shiftCount: bigint;
			totalHours: number;
		}[]
	>`
		SELECT
			o."id"                                          AS "orgId",
			o."name"                                        AS "orgName",
			COUNT(DISTINCT cm."userId")                     AS "employeeCount",
			COUNT(DISTINCT s."id")                          AS "shiftCount",
			COALESCE(SUM(
				EXTRACT(EPOCH FROM (s."endTime" - s."startTime")) / 3600.0
			), 0)                                           AS "totalHours"
		FROM "CompanyNonprofitLink" cnl
		JOIN "Organization" o     ON o."id" = cnl."orgId"
		JOIN "Shift" s            ON s."orgId" = o."id"
		JOIN "ShiftSignup" ss     ON ss."shiftId" = s."id"
		JOIN "CompanyMember" cm   ON cm."userId" = ss."userId"
		                         AND cm."companyId" = cnl."companyId"
		WHERE cnl."companyId" = ${companyId}
		  AND cnl."status" = 'ACTIVE'
		  AND ss."status" = 'ATTENDED'
		  AND s."startTime" >= COALESCE(${from}::timestamp, '-infinity'::timestamp)
		  AND s."endTime" <= COALESCE(${to}::timestamp, 'infinity'::timestamp)
		GROUP BY o."id", o."name"
		ORDER BY o."name"
	`;

	return rows.map((r) => ({
		orgId: r.orgId,
		orgName: r.orgName,
		employeeCount: Number(r.employeeCount),
		shiftCount: Number(r.shiftCount),
		totalHours: Number(r.totalHours),
	}));
}

type ESGCredentialRow = {
	orgId: string;
	orgName: string;
	verifiedCredentialCount: number;
};

/**
 * Count verified credentials per linked nonprofit for a company's employees.
 * Not date-filtered — credentials are point-in-time.
 */
export async function getESGCredentialCounts(
	companyId: string,
): Promise<ESGCredentialRow[]> {
	const rows = await prisma.$queryRaw<
		{
			orgId: string;
			orgName: string;
			verifiedCredentialCount: bigint;
		}[]
	>`
		SELECT
			o."id"                          AS "orgId",
			o."name"                        AS "orgName",
			COUNT(vc."id")                  AS "verifiedCredentialCount"
		FROM "CompanyNonprofitLink" cnl
		JOIN "Organization" o              ON o."id" = cnl."orgId"
		JOIN "VolunteerCredential" vc      ON vc."orgId" = o."id"
		JOIN "CompanyMember" cm            ON cm."userId" = vc."userId"
		                                   AND cm."companyId" = cnl."companyId"
		WHERE cnl."companyId" = ${companyId}
		  AND cnl."status" = 'ACTIVE'
		  AND vc."status" = 'VERIFIED'
		GROUP BY o."id", o."name"
		ORDER BY o."name"
	`;

	return rows.map((r) => ({
		orgId: r.orgId,
		orgName: r.orgName,
		verifiedCredentialCount: Number(r.verifiedCredentialCount),
	}));
}

/**
 * Cross-org deduplicated count of company employees who attended shifts
 * at any linked nonprofit within the date range.
 *
 * Same static-template pattern as getESGShiftAggregates — no Sql fragment
 * composition (breaks under Turbopack dev, see that function's doc comment).
 */
export async function getESGDistinctEmployeeCount(
	companyId: string,
	dateRange: { from?: Date | null; to?: Date | null },
): Promise<number> {
	const from = dateRange.from ?? null;
	const to = dateRange.to ?? null;

	const result = await prisma.$queryRaw<{ count: bigint }[]>`
		SELECT COUNT(DISTINCT cm."userId") AS "count"
		FROM "CompanyNonprofitLink" cnl
		JOIN "Shift" s            ON s."orgId" = cnl."orgId"
		JOIN "ShiftSignup" ss     ON ss."shiftId" = s."id"
		JOIN "CompanyMember" cm   ON cm."userId" = ss."userId"
		                         AND cm."companyId" = cnl."companyId"
		WHERE cnl."companyId" = ${companyId}
		  AND cnl."status" = 'ACTIVE'
		  AND ss."status" = 'ATTENDED'
		  AND s."startTime" >= COALESCE(${from}::timestamp, '-infinity'::timestamp)
		  AND s."endTime" <= COALESCE(${to}::timestamp, 'infinity'::timestamp)
	`;

	return Number(result[0]?.count ?? 0);
}
