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
	reason?: string;
}

export interface ReviewRule {
	operator: 'equals' | 'includes' | 'lt' | 'lte' | 'gt' | 'gte';
	value: unknown;
	reason?: string;
}

export interface ScreenerQuestion {
	id: string;
	prompt: string;
	type: ScreenerQuestionType;
	options?: string[];
	required?: boolean;
	disqualifierRule?: DisqualifierRule;
	reviewRule?: ReviewRule;
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
	const responseIds = new Set(responses.map((response) => response.questionId));

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
						message: `Invalid value for "${question.prompt}"`,
						path: [index, 'value'],
					});
					continue;
				}

				if (question.options && question.options.length > 0) {
					if (question.type === 'SINGLE_CHOICE') {
						if (!question.options.includes(item.value as string)) {
							ctx.addIssue({
								code: z.ZodIssueCode.custom,
								message: `Value not in options for "${question.prompt}"`,
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
								message: `Value not in options for "${question.prompt}"`,
								path: [index, 'value'],
							});
						}
					}
				}
			}

			for (const question of questions) {
				if (question.required === false) {
					continue;
				}
				if (!responseIds.has(question.id)) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: `Missing response for ${question.prompt}`,
						path: ['missing', question.id],
					});
				}
			}
		})
		.safeParse(responses);
}

function ruleMatches(rule: DisqualifierRule | ReviewRule, value: unknown) {
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

// ---------------------------------------------------------------------------
// Default screener questions — seeded when a new org is created
// ---------------------------------------------------------------------------

export interface DefaultScreenerQuestion {
	key: string;
	prompt: string;
	type: ScreenerQuestionType;
	order: number;
	configJson: Record<string, unknown>;
}

export const DEFAULT_SCREENER_QUESTIONS: DefaultScreenerQuestion[] = [
	{
		key: 'age-18-plus',
		prompt: 'Are you 18 years of age or older?',
		type: 'BOOLEAN',
		order: 10,
		configJson: {
			required: true,
			rules: {
				disqualifierRule: { operator: 'equals', value: false },
				reason: 'Must be 18 years of age or older.',
			},
		},
	},
	{
		key: 'background-check-consent',
		prompt: 'Do you consent to a background check?',
		type: 'BOOLEAN',
		order: 20,
		configJson: {
			required: true,
			rules: {
				disqualifierRule: { operator: 'equals', value: false },
				reason: 'Background check consent is required.',
			},
		},
	},
	{
		key: 'availability',
		prompt: 'What is your general availability?',
		type: 'SINGLE_CHOICE',
		order: 30,
		configJson: {
			required: true,
			options: ['Weekdays', 'Weekends', 'Evenings', 'Flexible'],
		},
	},
	{
		key: 'prior-experience',
		prompt: 'Do you have prior volunteer experience?',
		type: 'BOOLEAN',
		order: 40,
		configJson: { required: false },
	},
	{
		key: 'why-volunteer',
		prompt: 'Why are you interested in volunteering with us?',
		type: 'TEXT',
		order: 50,
		configJson: { required: false, maxLength: 500 },
	},
];

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
			if (question.required === false) {
				continue;
			}
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
			if (question.disqualifierRule.reason) {
				reasons.push(
					`${question.disqualifierRule.reason} (${question.prompt})`,
				);
			} else {
				reasons.push(`Disqualifier matched for ${question.prompt}`);
			}
		}

		if (question.reviewRule && ruleMatches(question.reviewRule, value)) {
			if (status === 'PASS') {
				status = 'REVIEW';
			}
			if (question.reviewRule.reason) {
				reasons.push(`${question.reviewRule.reason} (${question.prompt})`);
			} else {
				reasons.push(`Review flag matched for ${question.prompt}`);
			}
		}
	}

	return { status, reasons };
}
