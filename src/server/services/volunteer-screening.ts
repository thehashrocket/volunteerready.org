import {
	ApplicationStatus,
	OpportunityStatus,
	type Prisma,
	type ScreeningStatus,
} from '@/prisma/generated/client';
import { parseConfigJson } from '@/server/domain/screener/configSchema';
import {
	evaluateScreening,
	type ScreenerQuestion,
	type ScreenerResponse,
	type VolunteerProfile,
	validateResponses,
} from '@/server/domain/volunteer-screening';
import { writeAuditLogTx } from '@/server/repositories/auditRepo';
import { prisma } from '@/server/repositories/prisma';
import { getActiveQuestions } from '@/server/repositories/volunteer-applications';

interface SubmitVolunteerApplicationPayload {
	submittedByEmail: string;
	submittedByUserId?: string | null;
	opportunityId?: string | null;
	profile: VolunteerProfile;
	responses: ScreenerResponse[];
}

export function mapQuestion(question: {
	id: string;
	prompt: string;
	type: string;
	configJson: unknown;
}): ScreenerQuestion {
	const config = parseConfigJson(question.configJson);

	const disqualifierRule = config.rules?.disqualifierRule
		? {
				operator: config.rules.disqualifierRule.operator,
				value: config.rules.disqualifierRule.value,
				reason: config.rules.reason,
			}
		: undefined;

	const reviewRule = config.rules?.reviewIf
		? {
				operator: config.rules.reviewIf.operator,
				value: config.rules.reviewIf.value,
				reason: config.rules.reason,
			}
		: undefined;

	return {
		id: question.id,
		prompt: question.prompt,
		type: question.type as ScreenerQuestion['type'],
		options: config.options,
		required: config.required,
		disqualifierRule,
		reviewRule,
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

	let validatedOpportunityId: string | null = null;
	if (payload.opportunityId) {
		const opp = await prisma.volunteerOpportunity.findFirst({
			where: {
				id: payload.opportunityId,
				orgId,
				status: OpportunityStatus.PUBLISHED,
			},
			select: { id: true },
		});
		validatedOpportunityId = opp?.id ?? null;
	}

	// Application + answers + audit all committed atomically
	const application = await prisma.$transaction(async (tx) => {
		const app = await tx.volunteerApplication.create({
			data: {
				orgId,
				opportunityId: validatedOpportunityId,
				submittedByUserId: payload.submittedByUserId ?? null,
				submittedByEmail: payload.submittedByEmail,
				status: ApplicationStatus.SUBMITTED,
				screeningStatus,
				screeningReasons,
			},
		});

		if (payload.responses.length > 0) {
			await tx.volunteerAnswer.createMany({
				data: payload.responses.map((response) => ({
					applicationId: app.id,
					questionId: response.questionId,
					answerJson: { value: response.value } as Prisma.InputJsonValue,
				})),
			});
		}

		await writeAuditLogTx(tx, {
			orgId,
			action: 'volunteer_application.submitted',
			entityType: 'VolunteerApplication',
			entityId: app.id,
			metadata: {
				submittedByEmail: payload.submittedByEmail,
				opportunityId: validatedOpportunityId,
				screeningStatus,
				profile: payload.profile,
			},
		});

		return app;
	});

	return {
		applicationId: application.id,
		screeningStatus,
		screeningReasons,
	};
}
