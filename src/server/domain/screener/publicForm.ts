import { z } from 'zod';
import type { ScreenerQuestionType } from '@/server/domain/volunteer-screening';

export type PublicQuestionType =
	| 'YES_NO'
	| 'TEXT'
	| 'SINGLE_SELECT'
	| 'MULTI_SELECT'
	| 'NUMBER'
	| 'BOOLEAN'
	| 'SINGLE_CHOICE';

/**
 * Every stored question type and the field the public apply form renders for
 * it. A Record, so adding a ScreenerQuestionType fails the typecheck until it
 * is mapped here. Unmapped types used to fall back to TEXT, which submits a
 * string that screening's validator then rejects ("Invalid value for ...").
 */
const PUBLIC_TYPE_BY_STORED_TYPE: Record<
	ScreenerQuestionType,
	PublicQuestionType
> = {
	TEXT: 'TEXT',
	BOOLEAN: 'YES_NO',
	SINGLE_CHOICE: 'SINGLE_SELECT',
	MULTI_CHOICE: 'MULTI_SELECT',
	NUMBER: 'NUMBER',
};

export function toPublicQuestionType(type: string): PublicQuestionType {
	return PUBLIC_TYPE_BY_STORED_TYPE[type as ScreenerQuestionType] ?? 'TEXT';
}

export type PublicOrgSummary = {
	id: string;
	name: string;
	slug: string;
	showPoweredBy: boolean;
};

export type PublicScreenerQuestion = {
	id: string;
	key: string;
	prompt: string;
	type: PublicQuestionType;
	order: number;
	configJson: unknown;
};

export type PublicQuestion = PublicScreenerQuestion;

export type PublicForm = {
	org: PublicOrgSummary;
	questions: PublicQuestion[];
};

export function buildDefaultValues(questions: PublicQuestion[]) {
	const defaults: Record<string, unknown> = {};
	for (const q of questions) {
		switch (normalizeQuestionType(q.type)) {
			case 'YES_NO':
				defaults[q.key] = undefined; // force user selection
				break;
			case 'TEXT':
				defaults[q.key] = '';
				break;
			case 'SINGLE_SELECT':
				defaults[q.key] = '';
				break;
			case 'MULTI_SELECT':
				defaults[q.key] = [];
				break;
			case 'NUMBER':
				defaults[q.key] = ''; // an empty <input type="number">
				break;
			default:
				defaults[q.key] = '';
		}
	}
	return defaults;
}

/**
 * Keep this conservative: required by default unless configJson says optional.
 * (Or switch to explicit isRequired column later.)
 */
export function buildZodSchema(questions: PublicQuestion[]) {
	const shape: Record<string, z.ZodTypeAny> = {};

	for (const q of questions) {
		const cfg = (q.configJson ?? {}) as Record<string, unknown>;
		const required = cfg.required !== false; // default required

		switch (normalizeQuestionType(q.type)) {
			case 'YES_NO': {
				const base = z.boolean({ message: 'Required' });
				shape[q.key] = required ? base : base.optional();
				break;
			}
			case 'TEXT': {
				const max = typeof cfg.maxLength === 'number' ? cfg.maxLength : 500;
				const base = z.string().trim().max(max, `Max ${max} characters`);
				shape[q.key] = required
					? base.min(1, 'Required')
					: z.preprocess(normalizeOptionalString, base.optional());
				break;
			}
			case 'SINGLE_SELECT': {
				const options: string[] = Array.isArray(cfg.options) ? cfg.options : [];
				const base =
					options.length > 0
						? z.string().refine((v) => options.includes(v), 'Invalid selection')
						: z.string();

				shape[q.key] = required
					? base.min(1, 'Required')
					: z.preprocess(normalizeOptionalString, base.optional());
				break;
			}
			case 'MULTI_SELECT': {
				const options: string[] = Array.isArray(cfg.options) ? cfg.options : [];
				const item =
					options.length > 0
						? z.string().refine((v) => options.includes(v), 'Invalid selection')
						: z.string().min(1);
				// Must submit an array: screening validates MULTI_CHOICE with
				// z.array(z.string()), and a joined string fails it.
				shape[q.key] = required
					? z.array(item).min(1, 'Select at least one')
					: z.preprocess(
							(v) => (Array.isArray(v) && v.length === 0 ? undefined : v),
							z.array(item).optional(),
						);
				break;
			}
			case 'NUMBER': {
				// The input yields a string; screening validates NUMBER with
				// z.number(), so convert here or the submission is rejected.
				const base = z.number({ message: 'Enter a number' }); // v4: rejects NaN and Infinity
				shape[q.key] = z.preprocess(
					toNumberOrUndefined,
					required ? base : base.optional(),
				);
				break;
			}
			default: {
				// fallback: accept string
				const base = z.string();
				shape[q.key] = required
					? base.min(1, 'Required')
					: z.preprocess(normalizeOptionalString, base.optional());
			}
		}
	}

	return z.object(shape);
}

function normalizeQuestionType(type: PublicQuestionType) {
	switch (type) {
		case 'BOOLEAN':
			return 'YES_NO';
		case 'SINGLE_CHOICE':
			return 'SINGLE_SELECT';
		default:
			return type;
	}
}

export function mapFormValuesToAnswers(values: Record<string, unknown>) {
	// Convert the keyed object to an array shape if your submit expects that.
	return Object.entries(values).map(([questionKey, value]) => ({
		questionKey,
		value,
	}));
}

export function buildResponsesFromAnswers(
	questions: PublicQuestion[],
	answers: Record<string, unknown>,
) {
	return questions
		.map((question) => ({
			questionId: question.id,
			value: answers[question.key],
		}))
		.filter((response) => !isEmptyAnswer(response.value));
}

function toNumberOrUndefined(value: unknown) {
	if (typeof value === 'number') return value;
	if (typeof value !== 'string' || value.trim() === '') return undefined;
	const n = Number(value.trim());
	// NaN stays NaN so z.number() reports "Enter a number" instead of the
	// answer silently disappearing.
	return n;
}

function normalizeOptionalString(value: unknown) {
	if (typeof value !== 'string') {
		return value;
	}
	const trimmed = value.trim();
	return trimmed === '' ? undefined : trimmed;
}

function isEmptyAnswer(value: unknown) {
	if (value === null || value === undefined) {
		return true;
	}
	if (typeof value === 'string') {
		return value.trim() === '';
	}
	if (Array.isArray(value)) {
		return value.length === 0;
	}
	return false;
}
