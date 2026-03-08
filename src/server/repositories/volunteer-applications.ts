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
	const [submitted, review, approved, rejected] = await Promise.all([
		prisma.volunteerApplication.count({
			where: { orgId, status: 'SUBMITTED' },
		}),
		prisma.volunteerApplication.count({ where: { orgId, status: 'REVIEW' } }),
		prisma.volunteerApplication.count({ where: { orgId, status: 'APPROVED' } }),
		prisma.volunteerApplication.count({ where: { orgId, status: 'REJECTED' } }),
	]);
	return { submitted, review, approved, rejected };
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
