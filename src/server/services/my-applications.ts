import { TRPCError } from '@trpc/server';
import type { Prisma } from '@/prisma/generated/client';
import { prisma } from '@/server/repositories/prisma';
import {
	getApplicationStatusTimeline,
	getScreenerQuestionsByIds,
	getUserApplicationDetail,
	listUserApplications,
} from '@/server/repositories/volunteer-applications';

export async function listMyApplications(
	userId: string,
	email?: string | null,
) {
	await linkApplicationsToUser(userId, email);
	const applications = await listUserApplications(userId);

	return applications.map((application) => {
		const reasons = normalizeReasons(application.screeningReasons);

		return {
			id: application.id,
			submittedAt: application.submittedAt,
			status: application.status,
			screeningStatus: application.screeningStatus,
			screeningReasonsCount: reasons.length,
			organization: application.organization,
		};
	});
}

export async function getMyApplicationDetail(
	userId: string,
	applicationId: string,
	email?: string | null,
) {
	await linkApplicationsToUser(userId, email);
	const application = await getUserApplicationDetail(userId, applicationId);

	if (!application) {
		throw new TRPCError({
			code: 'NOT_FOUND',
			message: 'Application not found.',
		});
	}

	const reasons = normalizeReasons(application.screeningReasons);
	const questionIds = application.answers.map((answer) => answer.questionId);
	const questions = await getScreenerQuestionsByIds(
		application.orgId,
		questionIds,
	);
	const questionMap = new Map(
		questions.map((question) => [question.id, question]),
	);

	const answers = application.answers.map((answer) => ({
		id: answer.id,
		questionId: answer.questionId,
		prompt: questionMap.get(answer.questionId)?.prompt ?? 'Question removed',
		value: normalizeAnswerValue(answer.answerJson),
		displayValue: formatAnswerValue(normalizeAnswerValue(answer.answerJson)),
	}));

	return {
		id: application.id,
		submittedAt: application.submittedAt,
		status: application.status,
		screeningStatus: application.screeningStatus,
		screeningReasons: reasons,
		organization: application.organization,
		answers,
	};
}

export async function getMyApplicationStatusTimeline(
	userId: string,
	applicationId: string,
) {
	// Verify ownership before returning timeline
	const application = await prisma.volunteerApplication.findFirst({
		where: { id: applicationId, submittedByUserId: userId },
		select: { id: true },
	});

	if (!application) {
		throw new TRPCError({
			code: 'NOT_FOUND',
			message: 'Application not found.',
		});
	}

	return getApplicationStatusTimeline(applicationId);
}

async function linkApplicationsToUser(userId: string, email?: string | null) {
	if (!email) {
		return;
	}

	await prisma.volunteerApplication.updateMany({
		where: {
			submittedByUserId: null,
			submittedByEmail: email,
		},
		data: { submittedByUserId: userId },
	});
}

export function normalizeReasons(
	value: Prisma.JsonValue | null | undefined,
): string[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.map((item) => {
		if (typeof item === 'string') {
			return item;
		}
		if (item && typeof item === 'object') {
			const message = (item as { message?: string }).message;
			if (typeof message === 'string') {
				return message;
			}
		}
		return JSON.stringify(item);
	});
}

export function normalizeAnswerValue(
	value: Prisma.JsonValue | null | undefined,
) {
	if (!value || typeof value !== 'object') {
		return value;
	}
	if ('value' in value) {
		return (value as { value: unknown }).value;
	}
	return value;
}

export function formatAnswerValue(value: unknown) {
	if (value === null || value === undefined) {
		return '—';
	}
	if (typeof value === 'string') {
		return value;
	}
	if (typeof value === 'number' || typeof value === 'boolean') {
		return String(value);
	}
	if (Array.isArray(value)) {
		return value.length > 0 ? value.join(', ') : '—';
	}
	try {
		return JSON.stringify(value);
	} catch {
		return String(value);
	}
}
