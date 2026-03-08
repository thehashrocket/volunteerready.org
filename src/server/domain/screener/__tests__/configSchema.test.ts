import { describe, expect, it } from 'vitest';
import {
	parseConfigJson,
	safeParseConfigJson,
	screenerQuestionConfigSchema,
} from '../configSchema';

// ===========================================================================
// screenerQuestionConfigSchema — valid inputs
// ===========================================================================

describe('screenerQuestionConfigSchema', () => {
	it('accepts an empty object (all fields optional)', () => {
		const result = screenerQuestionConfigSchema.safeParse({});
		expect(result.success).toBe(true);
	});

	it('accepts a minimal TEXT config', () => {
		const result = screenerQuestionConfigSchema.safeParse({
			required: true,
			maxLength: 500,
		});
		expect(result.success).toBe(true);
	});

	it('accepts a SINGLE_CHOICE config with options', () => {
		const result = screenerQuestionConfigSchema.safeParse({
			required: true,
			options: ['Morning', 'Afternoon', 'Evening'],
		});
		expect(result.success).toBe(true);
	});

	it('accepts a BOOLEAN config with disqualifier rule', () => {
		const result = screenerQuestionConfigSchema.safeParse({
			required: true,
			rules: {
				disqualifierRule: { operator: 'equals', value: false },
				reason: 'Must be over 18',
			},
		});
		expect(result.success).toBe(true);
	});

	it('accepts rules with both disqualifierRule and reviewIf', () => {
		const result = screenerQuestionConfigSchema.safeParse({
			rules: {
				disqualifierRule: { operator: 'lt', value: 1 },
				reviewIf: { operator: 'lte', value: 3 },
				reason: 'Experience check',
			},
		});
		expect(result.success).toBe(true);
	});

	it('accepts rules with null (cleared rules)', () => {
		const result = screenerQuestionConfigSchema.safeParse({
			required: false,
			rules: null,
		});
		expect(result.success).toBe(true);
	});

	it('accepts all six rule operators', () => {
		for (const op of ['equals', 'includes', 'lt', 'lte', 'gt', 'gte']) {
			const result = screenerQuestionConfigSchema.safeParse({
				rules: {
					disqualifierRule: { operator: op, value: 0 },
				},
			});
			expect(result.success, `operator "${op}" should be valid`).toBe(true);
		}
	});
});

// ===========================================================================
// screenerQuestionConfigSchema — invalid inputs
// ===========================================================================

describe('screenerQuestionConfigSchema — invalid inputs', () => {
	it('rejects a non-object value', () => {
		const result = screenerQuestionConfigSchema.safeParse('not an object');
		expect(result.success).toBe(false);
	});

	it('rejects required as a string', () => {
		const result = screenerQuestionConfigSchema.safeParse({
			required: 'yes',
		});
		expect(result.success).toBe(false);
	});

	it('rejects maxLength as a negative number', () => {
		const result = screenerQuestionConfigSchema.safeParse({
			maxLength: -10,
		});
		expect(result.success).toBe(false);
	});

	it('rejects maxLength as a float', () => {
		const result = screenerQuestionConfigSchema.safeParse({
			maxLength: 10.5,
		});
		expect(result.success).toBe(false);
	});

	it('rejects options with empty strings', () => {
		const result = screenerQuestionConfigSchema.safeParse({
			options: ['Valid', ''],
		});
		expect(result.success).toBe(false);
	});

	it('rejects a rule with an invalid operator', () => {
		const result = screenerQuestionConfigSchema.safeParse({
			rules: {
				disqualifierRule: { operator: 'notEquals', value: true },
			},
		});
		expect(result.success).toBe(false);
	});

	it('rejects a rule missing the value field', () => {
		const result = screenerQuestionConfigSchema.safeParse({
			rules: {
				disqualifierRule: { operator: 'equals' },
			},
		});
		expect(result.success).toBe(false);
	});
});

// ===========================================================================
// parseConfigJson helper
// ===========================================================================

describe('parseConfigJson', () => {
	it('returns empty object for null', () => {
		expect(parseConfigJson(null)).toEqual({});
	});

	it('returns empty object for undefined', () => {
		expect(parseConfigJson(undefined)).toEqual({});
	});

	it('parses valid config and returns typed result', () => {
		const result = parseConfigJson({
			required: true,
			options: ['A', 'B'],
			rules: {
				disqualifierRule: { operator: 'equals', value: false },
				reason: 'Must accept terms',
			},
		});
		expect(result.required).toBe(true);
		expect(result.options).toEqual(['A', 'B']);
		expect(result.rules?.disqualifierRule?.operator).toBe('equals');
		expect(result.rules?.reason).toBe('Must accept terms');
	});

	it('throws ZodError for malformed config', () => {
		expect(() => parseConfigJson({ required: 'not-a-boolean' })).toThrow();
	});

	it('throws ZodError for invalid rule operator', () => {
		expect(() =>
			parseConfigJson({
				rules: {
					disqualifierRule: { operator: 'NOPE', value: 1 },
				},
			}),
		).toThrow();
	});
});

// ===========================================================================
// safeParseConfigJson helper
// ===========================================================================

describe('safeParseConfigJson', () => {
	it('returns success for null', () => {
		const result = safeParseConfigJson(null);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toEqual({});
		}
	});

	it('returns success for valid config', () => {
		const result = safeParseConfigJson({ required: false });
		expect(result.success).toBe(true);
	});

	it('returns error for malformed config', () => {
		const result = safeParseConfigJson({ maxLength: 'five' });
		expect(result.success).toBe(false);
	});
});
