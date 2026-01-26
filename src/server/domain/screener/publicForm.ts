import { z } from 'zod';

export type PublicQuestionType =
	| 'YES_NO'
	| 'TEXT'
	| 'SINGLE_SELECT'
	| 'BOOLEAN'
	| 'SINGLE_CHOICE';

export type PublicOrgSummary = {
	id: string;
	name: string;
	slug: string;
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
		const cfg = (q.configJson ?? {}) as any;
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
				shape[q.key] = required ? base.min(1, 'Required') : base.optional();
				break;
			}
			case 'SINGLE_SELECT': {
				const options: string[] = Array.isArray(cfg.options) ? cfg.options : [];
				const base =
					options.length > 0
						? z.string().refine((v) => options.includes(v), 'Invalid selection')
						: z.string();

				shape[q.key] = required ? base.min(1, 'Required') : base.optional();
				break;
			}
			default: {
				// fallback: accept string
				const base = z.string();
				shape[q.key] = required ? base.min(1, 'Required') : base.optional();
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
