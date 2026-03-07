import { ApplicationStatus } from '@/prisma/generated/client';
import { getPublicFormByOrgSlug } from '@/server/repositories/publicApplyRepo';
import {
	getApplicationDetail,
	getScreenerQuestionsByIds,
	listApplications,
	updateApplicationStatus as repoUpdateApplicationStatus,
} from '@/server/repositories/volunteer-applications';
import {
	formatAnswerValue,
	normalizeAnswerValue,
	normalizeReasons,
} from '@/server/services/my-applications';

export async function listOrgApplications(
	orgId: string,
	input: { status?: string; page?: number; pageSize?: number },
) {
	return listApplications(orgId, input.status as ApplicationStatus | undefined, {
		page: input.page,
		pageSize: input.pageSize,
	});
}

export async function getOrgApplicationDetail(orgId: string, id: string) {
	return getApplicationDetail(orgId, id);
}

export async function getOrgApplicationDetailEnriched(
	orgId: string,
	id: string,
) {
	const application = await getApplicationDetail(orgId, id);
	if (!application) return null;

	const questionIds = application.answers.map((a) => a.questionId);
	const questions = await getScreenerQuestionsByIds(orgId, questionIds);
	const questionMap = new Map(questions.map((q) => [q.id, q]));

	return {
		id: application.id,
		submittedAt: application.submittedAt,
		submittedByEmail: application.submittedByEmail,
		status: application.status,
		screeningStatus: application.screeningStatus,
		screeningReasons: normalizeReasons(application.screeningReasons),
		answers: application.answers.map((a) => ({
			id: a.id,
			questionId: a.questionId,
			prompt: questionMap.get(a.questionId)?.prompt ?? 'Question removed',
			value: normalizeAnswerValue(a.answerJson),
			displayValue: formatAnswerValue(normalizeAnswerValue(a.answerJson)),
		})),
	};
}

export async function updateOrgApplicationStatus(
	orgId: string,
	id: string,
	status: ApplicationStatus,
) {
	return repoUpdateApplicationStatus(orgId, id, status);
}

export async function getPublicScreenerForm(orgSlug: string) {
	return getPublicFormByOrgSlug(orgSlug);
}
