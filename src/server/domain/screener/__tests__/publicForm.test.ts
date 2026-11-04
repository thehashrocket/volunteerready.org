import { describe, expect, it } from 'vitest';
import {
	buildDefaultValues,
	buildResponsesFromAnswers,
	buildZodSchema,
	type PublicQuestion,
	toPublicQuestionType,
} from '@/server/domain/screener/publicForm';
import {
	type ScreenerQuestion,
	type ScreenerQuestionType,
	validateResponses,
} from '@/server/domain/volunteer-screening';

// One question of every stored type, as an org's screener would hold them.
const STORED: Array<{
	id: string;
	key: string;
	type: ScreenerQuestionType;
	options?: string[];
}> = [
	{ id: 'q-text', key: 'why', type: 'TEXT' },
	{ id: 'q-bool', key: 'adult', type: 'BOOLEAN' },
	{
		id: 'q-single',
		key: 'shift',
		type: 'SINGLE_CHOICE',
		options: ['Mornings', 'Evenings'],
	},
	{
		id: 'q-multi',
		key: 'roles',
		type: 'MULTI_CHOICE',
		options: ['Dog walking', 'Front desk', 'Events'],
	},
	{ id: 'q-num', key: 'hours', type: 'NUMBER' },
];

const publicQuestions: PublicQuestion[] = STORED.map((q, order) => ({
	id: q.id,
	key: q.key,
	prompt: q.key,
	type: toPublicQuestionType(q.type),
	order,
	configJson: { options: q.options, required: true },
}));

const screeningQuestions: ScreenerQuestion[] = STORED.map((q) => ({
	id: q.id,
	prompt: q.key,
	type: q.type,
	options: q.options,
	required: true,
}));

/** What the form holds after a person fills it in: strings from inputs. */
const rawFormValues = {
	why: 'I like dogs',
	adult: true,
	shift: 'Evenings',
	roles: ['Dog walking', 'Events'],
	hours: '6',
};

describe('public apply form → screening', () => {
	it('maps every stored question type to its own field type', () => {
		expect(STORED.map((q) => toPublicQuestionType(q.type))).toEqual([
			'TEXT',
			'YES_NO',
			'SINGLE_SELECT',
			'MULTI_SELECT',
			'NUMBER',
		]);
	});

	it('produces answers that screening accepts, for every question type', () => {
		// The regression: NUMBER and MULTI_CHOICE fell back to a text field,
		// submitted strings, and screening rejected the whole application.
		const parsed = buildZodSchema(publicQuestions).parse(rawFormValues);
		const responses = buildResponsesFromAnswers(publicQuestions, parsed);

		const result = validateResponses(screeningQuestions, responses);
		expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
		expect(parsed.hours).toBe(6);
		expect(parsed.roles).toEqual(['Dog walking', 'Events']);
	});

	it('starts a multi-select empty and a number field blank', () => {
		const defaults = buildDefaultValues(publicQuestions);
		expect(defaults.roles).toEqual([]);
		expect(defaults.hours).toBe('');
	});
});

describe('buildZodSchema: NUMBER', () => {
	const schema = (required: boolean) =>
		buildZodSchema([
			{
				id: 'n',
				key: 'n',
				prompt: 'n',
				type: 'NUMBER',
				order: 0,
				configJson: { required },
			},
		]);

	it.each([
		['6', 6],
		[' 2.5 ', 2.5],
		['0', 0],
		[12, 12],
	])('accepts %j as %j', (input, expected) => {
		expect(schema(true).parse({ n: input }).n).toBe(expected);
	});

	it('rejects a blank required answer and non-numbers', () => {
		for (const input of ['', '   ', 'six', undefined]) {
			const r = schema(true).safeParse({ n: input });
			expect(r.success).toBe(false);
			expect(r.error?.issues[0].message).toBe('Enter a number');
		}
	});

	it('lets an optional number be left blank', () => {
		expect(schema(false).parse({ n: '' }).n).toBeUndefined();
	});
});

describe('buildZodSchema: MULTI_SELECT', () => {
	const schema = (required: boolean) =>
		buildZodSchema([
			{
				id: 'm',
				key: 'm',
				prompt: 'm',
				type: 'MULTI_SELECT',
				order: 0,
				configJson: { required, options: ['A', 'B'] },
			},
		]);

	it('requires at least one choice when required', () => {
		const r = schema(true).safeParse({ m: [] });
		expect(r.success).toBe(false);
		expect(r.error?.issues[0].message).toBe('Select at least one');
	});

	it('rejects a value outside the options', () => {
		expect(schema(true).safeParse({ m: ['C'] }).success).toBe(false);
	});

	it('drops an empty optional selection', () => {
		expect(schema(false).parse({ m: [] }).m).toBeUndefined();
	});
});
