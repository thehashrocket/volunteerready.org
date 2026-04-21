import type { ApplicationStatus } from '@/prisma/generated/client';
import { prisma } from '@/server/repositories/prisma';

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
