import { Prisma } from '@/prisma/generated/client';
import type {
	ApplicationStatus,
	ScreeningStatus,
} from '@/prisma/generated/client';
import { prisma } from '@/server/repositories/prisma';

interface CreateApplicationInput {
	orgId: string;
	opportunityId?: string | null;
	submittedByEmail: string;
	submittedByUserId?: string | null;
	status: ApplicationStatus;
	screeningStatus: ScreeningStatus;
	screeningReasons: string[];
}

interface PaginationInput {
	page?: number;
	pageSize?: number;
}

export async function createApplication(input: CreateApplicationInput) {
	return prisma.volunteerApplication.create({
		data: {
			orgId: input.orgId,
			opportunityId: input.opportunityId ?? null,
			submittedByUserId: input.submittedByUserId ?? null,
			submittedByEmail: input.submittedByEmail,
			status: input.status,
			screeningStatus: input.screeningStatus,
			screeningReasons: input.screeningReasons,
		},
	});
}

export async function submitAnswers(
	applicationId: string,
	answers: { questionId: string; answerJson: unknown }[],
) {
	if (answers.length === 0) {
		return { count: 0 };
	}

	return prisma.volunteerAnswer.createMany({
		data: answers.map((answer) => ({
			applicationId,
			questionId: answer.questionId,
			answerJson: answer.answerJson as Prisma.InputJsonValue,
		})),
	});
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
				select: { id: true, title: true, location: true, isRemote: true, startDate: true, endDate: true, commitmentHours: true },
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
