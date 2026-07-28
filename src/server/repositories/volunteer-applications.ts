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
			// Declining is terminal: a row the address owner has said is not theirs
			// is never offered again. Without this the card would keep re-offering
			// it, which is the nag-until-yes behaviour the decline path fixes.
			declinedAt: null,
		},
		// OLDEST first. This NARROWS a starvation window; it does not close it.
		//
		// The cap is required — `screener.submit` is public, so a third party
		// controls how many orphan rows carry a given address. But a cap over an
		// attacker-controllable list is starvable from whichever end gets dropped,
		// and ordering only chooses the end:
		//   `desc` loses the OLDEST row, which is the common real case (you
		//         applied anonymously, then signed up later) — an attacker plants
		//         50 fresh rows and buries an application already sitting there.
		//   `asc`  loses the NEWEST row, so an attacker must PRE-plant 50 rows
		//         against an address before its owner applies.
		// `asc` is the better trade because it costs the attacker foreknowledge
		// and prior action, while `desc` is exploitable against applications that
		// already exist. Both leave a residual window, and there is no other bind
		// path since `linkApplicationsToUser()` was deleted, so a dropped row is
		// unclaimable.
		//
		// Ordering cannot fix this. The real fixes are the deferred decline path
		// (declining frees a slot) and/or bounding per (email, orgId) so one org
		// cannot consume every slot. Tracked in docs/TODOS.md.
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
		// `status` is read so the caller can materialize the roster edge for an
		// application that was APPROVED before the applicant ever signed in (E1a).
		// Without it that row would never be created and never reconciled.
		select: { id: true, orgId: true, status: true },
	});
}

/**
 * Mark one orphan application as NOT belonging to the owner of `email`.
 *
 * The authorization predicate is the same shape as `claimApplicationForUser`'s
 * and lives in the `where` for the same reason: a foreign application id matches
 * zero rows rather than letting one user suppress another's claim candidate.
 * `declinedAt: null` also makes a repeat decline a no-op rather than an error.
 *
 * PLAIN EQUALITY against the canonical form, never `mode: 'insensitive'` — see
 * the note on `listClaimableApplicationsByEmail`.
 *
 * Returns null when nothing matched.
 */
export async function declineApplicationForUser(
	applicationId: string,
	userId: string,
	email: string,
	tx: TxClient | typeof prisma = prisma,
) {
	const result = await tx.volunteerApplication.updateMany({
		where: {
			id: applicationId,
			submittedByUserId: null,
			submittedByEmail: normalizeEmail(email),
			declinedAt: null,
		},
		data: { declinedByUserId: userId, declinedAt: new Date() },
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
