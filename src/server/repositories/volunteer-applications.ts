import type {
	ApplicationStatus,
	PrismaClient,
} from '@/prisma/generated/client';
import { normalizeEmail } from '@/server/domain/org-volunteer';
import { prisma } from '@/server/repositories/prisma';

/** Transactional client — works with both `prisma` and `prisma.$transaction(tx => …)`. */
type TxClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

/**
 * Cap on the claimable-candidate list. Exported so callers can detect
 * truncation (`length === CLAIMABLE_LIST_CAP` means there may be more) rather
 * than silently showing a partial list as if it were complete.
 */
export const CLAIMABLE_LIST_CAP = 50;

interface PaginationInput {
	page?: number;
	pageSize?: number;
}

export async function listApplications(
	orgId: string,
	status: ApplicationStatus | undefined,
	paging: PaginationInput = {},
	opportunityId?: string,
) {
	const pageSize = paging.pageSize ?? 20;
	const page = paging.page ?? 1;
	const skip = (page - 1) * pageSize;

	const where = {
		orgId,
		...(status ? { status } : {}),
		...(opportunityId ? { opportunityId } : {}),
	};

	const [items, total] = await Promise.all([
		prisma.volunteerApplication.findMany({
			where,
			orderBy: { submittedAt: 'desc' },
			skip,
			take: pageSize,
			include: { opportunity: { select: { id: true, title: true } } },
		}),
		prisma.volunteerApplication.count({ where }),
	]);

	return { items, total, page, pageSize };
}

export async function getApplicationDetail(
	orgId: string,
	applicationId: string,
) {
	return prisma.volunteerApplication.findFirst({
		where: { id: applicationId, orgId },
		include: {
			answers: true,
			opportunity: {
				select: {
					id: true,
					title: true,
					location: true,
					isRemote: true,
					startDate: true,
					endDate: true,
					commitmentHours: true,
				},
			},
		},
	});
}

export async function updateApplicationStatus(
	orgId: string,
	applicationId: string,
	status: ApplicationStatus,
) {
	return prisma.volunteerApplication.update({
		where: { id: applicationId, orgId },
		data: { status },
	});
}

/**
 * Transactional version — fetches current status and updates atomically.
 * Returns both the updated record and the previous status for audit logging.
 */
export async function updateApplicationStatusTx(
	tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
	orgId: string,
	applicationId: string,
	newStatus: ApplicationStatus,
) {
	const current = await tx.volunteerApplication.findUniqueOrThrow({
		where: { id: applicationId, orgId },
		select: { status: true },
	});

	const updated = await tx.volunteerApplication.update({
		where: { id: applicationId, orgId },
		data: { status: newStatus },
	});

	return { updated, previousStatus: current.status };
}

export async function getApplicationStatusTimeline(applicationId: string) {
	return prisma.auditLog.findMany({
		where: {
			entityType: 'APPLICATION',
			entityId: applicationId,
			action: 'STATUS_CHANGED',
		},
		orderBy: { createdAt: 'asc' },
		select: {
			id: true,
			createdAt: true,
			metadata: true,
		},
	});
}

export async function listUserApplications(userId: string) {
	return prisma.volunteerApplication.findMany({
		where: { submittedByUserId: userId },
		orderBy: { submittedAt: 'desc' },
		select: {
			id: true,
			submittedAt: true,
			status: true,
			screeningStatus: true,
			screeningReasons: true,
			organization: { select: { id: true, name: true, slug: true } },
		},
	});
}

/**
 * Orphan applications (`submittedByUserId: null`) submitted under `email`.
 *
 * SECURITY: these are *candidates*, never auto-attached. `screener.submit` is a
 * publicProcedure accepting an arbitrary `submittedByEmail`, so anyone can
 * create a row bearing someone else's address. Binding one to a user mints an
 * `APPLICATION` edge, which `requireOrgVolunteerRelationship()` accepts as
 * authorization — so the bind must be an explicit act by the address owner.
 *
 * Matched by PLAIN EQUALITY against the canonical form, never `mode:
 * 'insensitive'`. Prisma compiles `insensitive` to `ILIKE $1` with the value
 * interpolated unescaped, which makes `_` and `%` wildcards — and `_` is legal
 * in an address that zod's `.email()` accepts. On an authorization predicate
 * that is a hole: `j_smith@x.com` would match (and claim) `j.smith@x.com`.
 * T1's migration already backfilled this column to `lower(btrim(...))`, and
 * `screener.submit` now normalizes on write, so equality is correct.
 */
export async function listClaimableApplicationsByEmail(email: string) {
	return prisma.volunteerApplication.findMany({
		where: {
			submittedByUserId: null,
			submittedByEmail: normalizeEmail(email),
		},
		// OLDEST first, deliberately. The bound below is required because a third
		// party controls how many orphan rows carry a given address
		// (`screener.submit` is public), but `desc` + a cap is a starvation hole:
		// the genuine application is the OLD one (you applied anonymously, then
		// signed up later), so newest-first lets an attacker plant 50 fresh rows
		// and push the real one off the list permanently. There is no other bind
		// path since `linkApplicationsToUser()` was deleted, so a buried row
		// would be unclaimable forever.
		orderBy: { submittedAt: 'asc' },
		take: CLAIMABLE_LIST_CAP,
		select: {
			id: true,
			submittedAt: true,
			organization: { select: { id: true, name: true, slug: true } },
		},
	});
}

/**
 * Attach a single orphan application to `userId`, but only if it is still
 * unclaimed AND was submitted under `email`.
 *
 * The email predicate is the authorization check and lives in the `where`, not
 * in a caller-side comparison: passing another user's application id matches
 * zero rows rather than binding it. Returns null when nothing matched, which
 * also covers the concurrent double-claim race.
 *
 * Takes a `tx` so the caller can commit the bind and its `APPLICATION_CLAIMED`
 * audit row atomically — an authorization edge that exists with no audit trail
 * is exactly the state this fix was written to prevent.
 */
export async function claimApplicationForUser(
	applicationId: string,
	userId: string,
	email: string,
	tx: TxClient | typeof prisma = prisma,
) {
	const normalized = normalizeEmail(email);

	const result = await tx.volunteerApplication.updateMany({
		where: {
			id: applicationId,
			submittedByUserId: null,
			// Plain equality, NOT `mode: 'insensitive'` — see the note on
			// `listClaimableApplicationsByEmail`. ILIKE would turn this
			// authorization check into a wildcard pattern match.
			submittedByEmail: normalized,
		},
		data: { submittedByUserId: userId },
	});

	if (result.count === 0) {
		return null;
	}

	return tx.volunteerApplication.findUnique({
		where: { id: applicationId },
		select: { id: true, orgId: true },
	});
}

export async function getUserApplicationDetail(
	userId: string,
	applicationId: string,
) {
	return prisma.volunteerApplication.findFirst({
		where: { id: applicationId, submittedByUserId: userId },
		select: {
			id: true,
			submittedAt: true,
			status: true,
			screeningStatus: true,
			screeningReasons: true,
			orgId: true,
			organization: { select: { id: true, name: true, slug: true } },
			answers: {
				select: {
					id: true,
					questionId: true,
					answerJson: true,
				},
			},
		},
	});
}

export async function getScreenerQuestionsByIds(
	orgId: string,
	questionIds: string[],
) {
	if (questionIds.length === 0) {
		return [];
	}

	return prisma.screenerQuestion.findMany({
		where: { orgId, id: { in: questionIds } },
		select: { id: true, prompt: true },
	});
}

export async function getActiveQuestions(orgId: string) {
	return prisma.screenerQuestion.findMany({
		where: { orgId, isActive: true },
		orderBy: { order: 'asc' },
	});
}

export async function countApplicationsByStatus(orgId: string) {
	const [submitted, review, approved, rejected, withdrawn] = await Promise.all([
		prisma.volunteerApplication.count({
			where: { orgId, status: 'SUBMITTED' },
		}),
		prisma.volunteerApplication.count({ where: { orgId, status: 'REVIEW' } }),
		prisma.volunteerApplication.count({ where: { orgId, status: 'APPROVED' } }),
		prisma.volunteerApplication.count({ where: { orgId, status: 'REJECTED' } }),
		prisma.volunteerApplication.count({
			where: { orgId, status: 'WITHDRAWN' },
		}),
	]);
	return { submitted, review, approved, rejected, withdrawn };
}

export async function withdrawApplication(
	userId: string,
	applicationId: string,
) {
	return prisma.volunteerApplication.findFirst({
		where: { id: applicationId, submittedByUserId: userId },
		select: {
			id: true,
			orgId: true,
			status: true,
			opportunityId: true,
			submittedByEmail: true,
			opportunity: { select: { title: true } },
		},
	});
}

export async function setApplicationWithdrawn(applicationId: string) {
	return prisma.volunteerApplication.update({
		where: { id: applicationId },
		data: { status: 'WITHDRAWN' },
	});
}

export async function listApplicationsWithSkills(
	orgId: string,
	opportunityId: string,
) {
	return prisma.volunteerApplication.findMany({
		where: { orgId, opportunityId },
		select: {
			id: true,
			submittedByUserId: true,
			submittedByUser: {
				select: {
					volunteerSkills: {
						select: {
							skillId: true,
							skill: { select: { name: true } },
						},
					},
				},
			},
		},
	});
}

/**
 * Find an active (non-REJECTED) application by user + opportunity.
 * Used for dedup checks on the apply form and submit guard.
 * orgId scopes the query to the tenant boundary.
 */
export async function findActiveApplicationByUserAndOpportunity(
	orgId: string,
	userId: string,
	opportunityId: string,
) {
	return prisma.volunteerApplication.findFirst({
		where: {
			orgId,
			submittedByUserId: userId,
			opportunityId,
			status: { notIn: ['REJECTED', 'WITHDRAWN'] },
		},
		select: {
			id: true,
			status: true,
			submittedAt: true,
		},
	});
}

/**
 * For a set of opportunity IDs, return which ones the user has already applied to
 * (with active/non-REJECTED applications). Used by the opportunities listing.
 * orgId scopes the query to the tenant boundary.
 */
export async function listUserAppliedOpportunities(
	orgId: string,
	userId: string,
	opportunityIds: string[],
) {
	if (opportunityIds.length === 0) return [];

	return prisma.volunteerApplication.findMany({
		where: {
			orgId,
			submittedByUserId: userId,
			opportunityId: { in: opportunityIds },
			status: { notIn: ['REJECTED', 'WITHDRAWN'] },
		},
		select: {
			id: true,
			opportunityId: true,
			status: true,
			submittedAt: true,
		},
	});
}

/**
 * For a set of opportunity IDs, return which ones the user has applied to
 * across ANY org. Used by the cross-org browse page where there's no single orgId.
 * Safe because it only returns the authenticated user's own application data.
 */
export async function listUserAppliedOpportunitiesCrossOrg(
	userId: string,
	opportunityIds: string[],
) {
	if (opportunityIds.length === 0) return [];

	return prisma.volunteerApplication.findMany({
		where: {
			submittedByUserId: userId,
			opportunityId: { in: opportunityIds },
			status: { notIn: ['REJECTED', 'WITHDRAWN'] },
		},
		select: {
			id: true,
			opportunityId: true,
			status: true,
			submittedAt: true,
		},
	});
}

export async function getRecentApplications(orgId: string, limit: number) {
	return prisma.volunteerApplication.findMany({
		where: { orgId },
		orderBy: { submittedAt: 'desc' },
		take: limit,
		select: {
			id: true,
			submittedAt: true,
			submittedByEmail: true,
			status: true,
			opportunity: { select: { id: true, title: true } },
		},
	});
}
