import { z } from 'zod';

export interface VolunteerProfile {
	name: string;
	email: string;
	phone: string;
	county: string;
	availability: string;
	experienceLevel: string;
	notes?: string;
}

export const volunteerProfileSchema = z.object({
	name: z.string().min(1),
	email: z.string().email(),
	phone: z.string().min(1),
	county: z.string().min(1),
	availability: z.string().min(1),
	experienceLevel: z.string().min(1),
	notes: z.string().optional(),
});

export type ScreenerQuestionType =
	| 'TEXT'
	| 'SINGLE_CHOICE'
	| 'MULTI_CHOICE'
	| 'BOOLEAN'
	| 'NUMBER';

export interface DisqualifierRule {
	operator: 'equals' | 'includes' | 'lt' | 'lte' | 'gt' | 'gte';
	value: unknown;
}

export interface ScreenerQuestion {
	id: string;
	prompt: string;
	type: ScreenerQuestionType;
	options?: string[];
	disqualifierRule?: DisqualifierRule;
}

export interface ScreenerResponse {
	questionId: string;
	value: unknown;
}

export const screenerResponseSchema = z.object({
	questionId: z.string().min(1),
	value: z.unknown(),
});

export type ScreeningStatus = 'PASS' | 'REVIEW' | 'FAIL';

export interface ScreeningResult {
	status: ScreeningStatus;
	reasons: string[];
}

const validatorForType = (type: ScreenerQuestionType) => {
	switch (type) {
		case 'TEXT':
			return z.string().min(1);
		case 'SINGLE_CHOICE':
			return z.string().min(1);
		case 'MULTI_CHOICE':
			return z.array(z.string().min(1));
		case 'BOOLEAN':
			return z.boolean();
		case 'NUMBER':
			return z.number();
		default:
			return z.unknown();
	}
};

export function validateResponses(
	questions: ScreenerQuestion[],
	responses: ScreenerResponse[],
) {
	const questionMap = new Map(
		questions.map((question) => [question.id, question]),
	);

	return z
		.array(screenerResponseSchema)
		.superRefine((items, ctx) => {
			for (const [index, item] of items.entries()) {
				const question = questionMap.get(item.questionId);
				if (!question) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: `Unknown question: ${item.questionId}`,
						path: [index, 'questionId'],
					});
					continue;
				}

				const validator = validatorForType(question.type);
				const validation = validator.safeParse(item.value);
				if (!validation.success) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: `Invalid value for question ${question.id}`,
						path: [index, 'value'],
					});
					continue;
				}

				if (question.options && question.options.length > 0) {
					if (question.type === 'SINGLE_CHOICE') {
						if (!question.options.includes(item.value as string)) {
							ctx.addIssue({
								code: z.ZodIssueCode.custom,
								message: `Value not in options for question ${question.id}`,
								path: [index, 'value'],
							});
						}
					}

					if (question.type === 'MULTI_CHOICE') {
						const values = item.value as string[];
						const invalid = values.filter(
							(value) => !question.options?.includes(value),
						);
						if (invalid.length > 0) {
							ctx.addIssue({
								code: z.ZodIssueCode.custom,
								message: `Value not in options for question ${question.id}`,
								path: [index, 'value'],
							});
						}
					}
				}
			}
		})
		.safeParse(responses);
}

function ruleMatches(rule: DisqualifierRule, value: unknown) {
	switch (rule.operator) {
		case 'equals':
			return value === rule.value;
		case 'includes':
			if (Array.isArray(value)) {
				return value.includes(rule.value as never);
			}
			if (typeof value === 'string') {
				return value.includes(String(rule.value));
			}
			return false;
		case 'lt':
			return typeof value === 'number' && typeof rule.value === 'number'
				? value < rule.value
				: false;
		case 'lte':
			return typeof value === 'number' && typeof rule.value === 'number'
				? value <= rule.value
				: false;
		case 'gt':
			return typeof value === 'number' && typeof rule.value === 'number'
				? value > rule.value
				: false;
		case 'gte':
			return typeof value === 'number' && typeof rule.value === 'number'
				? value >= rule.value
				: false;
		default:
			return false;
	}
}

export function evaluateScreening(
	questions: ScreenerQuestion[],
	responses: ScreenerResponse[],
): ScreeningResult {
	const responseMap = new Map(
		responses.map((response) => [response.questionId, response.value]),
	);

	const reasons: string[] = [];
	let status: ScreeningStatus = 'PASS';

	for (const question of questions) {
		const value = responseMap.get(question.id);
		if (value === undefined) {
			if (status === 'PASS') {
				status = 'REVIEW';
			}
			reasons.push(`Missing response for ${question.prompt}`);
			continue;
		}

		if (
			question.disqualifierRule &&
			ruleMatches(question.disqualifierRule, value)
		) {
			status = 'FAIL';
			reasons.push(`Disqualifier matched for ${question.prompt}`);
		}
	}

	return { status, reasons };
}
