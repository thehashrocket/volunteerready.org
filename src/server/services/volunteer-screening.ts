import {
	ApplicationStatus,
	Prisma,
	ScreeningStatus,
} from '@/prisma/generated/client';
import {
	evaluateScreening,
	validateResponses,
	type ScreenerQuestion,
	type ScreenerResponse,
	type VolunteerProfile,
} from '@/server/domain/volunteer-screening';
import {
	createApplication,
	getActiveQuestions,
	submitAnswers,
} from '@/server/repositories/volunteer-applications';
import { prisma } from '@/server/repositories/prisma';

interface SubmitVolunteerApplicationPayload {
	submittedByEmail: string;
	profile: VolunteerProfile;
	responses: ScreenerResponse[];
}

function mapQuestion(question: {
	id: string;
	prompt: string;
	type: string;
	configJson: unknown;
}): ScreenerQuestion {
	const config =
		question.configJson && typeof question.configJson === 'object'
			? (question.configJson as Record<string, unknown>)
			: {};

	return {
		id: question.id,
		prompt: question.prompt,
		type: question.type as ScreenerQuestion['type'],
		options: Array.isArray(config.options)
			? (config.options as string[])
			: undefined,
		disqualifierRule:
			config.disqualifierRule && typeof config.disqualifierRule === 'object'
				? (config.disqualifierRule as ScreenerQuestion['disqualifierRule'])
				: undefined,
	};
}

export async function submitVolunteerApplication(
	orgId: string,
	payload: SubmitVolunteerApplicationPayload,
) {
	const questionRecords = await getActiveQuestions(orgId);
	const questions = questionRecords.map(mapQuestion);

	const validation = validateResponses(questions, payload.responses);

	let screeningStatus: ScreeningStatus = 'REVIEW';
	let screeningReasons: string[] = [];

	if (!validation.success) {
		screeningReasons = validation.error.issues.map((issue) => issue.message);
	} else {
		const result = evaluateScreening(questions, payload.responses);
		screeningStatus = result.status;
		screeningReasons = result.reasons;
	}

	const application = await createApplication({
		orgId,
		submittedByEmail: payload.submittedByEmail,
		status: ApplicationStatus.SUBMITTED,
		screeningStatus,
		screeningReasons,
	});

	await submitAnswers(
		application.id,
		payload.responses.map((response) => ({
			questionId: response.questionId,
			answerJson: { value: response.value },
		})),
	);

	await prisma.auditLog.create({
		data: {
			orgId,
			action: 'volunteer_application.submitted',
			entityType: 'VolunteerApplication',
			entityId: application.id,
			metadata: {
				submittedByEmail: payload.submittedByEmail,
				screeningStatus,
				profile: payload.profile,
			} as any as Prisma.InputJsonValue,
		},
	});

	return {
		applicationId: application.id,
		screeningStatus,
		screeningReasons,
	};
}
