import {
	ApplicationStatus,
	OpportunityStatus,
	type Prisma,
	type ScreeningStatus,
} from '@/prisma/generated/client';
import {
	type DisqualifierRule,
	evaluateScreening,
	type ScreenerQuestion,
	type ScreenerResponse,
	type VolunteerProfile,
	validateResponses,
} from '@/server/domain/volunteer-screening';
import { prisma } from '@/server/repositories/prisma';
import {
	createApplication,
	getActiveQuestions,
	submitAnswers,
} from '@/server/repositories/volunteer-applications';

interface SubmitVolunteerApplicationPayload {
	submittedByEmail: string;
	submittedByUserId?: string | null;
	opportunityId?: string | null;
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

	const rules =
		config.rules && typeof config.rules === 'object'
			? (config.rules as Record<string, unknown>)
			: null;
	const disqualifier =
		rules &&
		typeof rules.disqualifierRule === 'object' &&
		rules.disqualifierRule !== null
			? (rules.disqualifierRule as Record<string, unknown>)
			: null;
	const reviewIf =
		rules && typeof rules.reviewIf === 'object' && rules.reviewIf !== null
			? (rules.reviewIf as Record<string, unknown>)
			: null;
	const ruleReason =
		typeof rules?.reason === 'string' ? rules.reason : undefined;

	const disqualifierRule =
		disqualifier && isRule(disqualifier)
			? {
					...disqualifier,
					reason: ruleReason,
				}
			: undefined;
	const reviewRule =
		reviewIf && isRule(reviewIf)
			? {
					...reviewIf,
					reason: ruleReason,
				}
			: undefined;

	return {
		id: question.id,
		prompt: question.prompt,
		type: question.type as ScreenerQuestion['type'],
		options: Array.isArray(config.options)
			? (config.options as string[])
			: undefined,
		required:
			typeof config.required === 'boolean' ? config.required : undefined,
		disqualifierRule,
		reviewRule,
	};
}

const allowedOperators = new Set<DisqualifierRule['operator']>([
	'equals',
	'includes',
	'lt',
	'lte',
	'gt',
	'gte',
]);

function isRule(
	rule: Record<string, unknown>,
): rule is { operator: DisqualifierRule['operator']; value: unknown } {
	return (
		typeof rule.operator === 'string' &&
		allowedOperators.has(rule.operator as DisqualifierRule['operator']) &&
		'value' in rule
	);
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

	const application = await createApplication({
		orgId,
		opportunityId: validatedOpportunityId,
		submittedByEmail: payload.submittedByEmail,
		submittedByUserId: payload.submittedByUserId ?? null,
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
				opportunityId: validatedOpportunityId,
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
