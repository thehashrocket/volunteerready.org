import { describe, expect, it } from 'vitest';
import {
	evaluateScreening,
	type ScreenerQuestion,
	type ScreenerResponse,
	validateResponses,
} from '../volunteer-screening';

// ---------------------------------------------------------------------------
// Helpers — reusable question builders
// ---------------------------------------------------------------------------

function textQuestion(overrides?: Partial<ScreenerQuestion>): ScreenerQuestion {
	return {
		id: 'q-text',
		prompt: 'Tell us about yourself',
		type: 'TEXT',
		...overrides,
	};
}

function booleanQuestion(
	overrides?: Partial<ScreenerQuestion>,
): ScreenerQuestion {
	return {
		id: 'q-bool',
		prompt: 'Are you over 18?',
		type: 'BOOLEAN',
		...overrides,
	};
}

function numberQuestion(
	overrides?: Partial<ScreenerQuestion>,
): ScreenerQuestion {
	return {
		id: 'q-num',
		prompt: 'Years of experience',
		type: 'NUMBER',
		...overrides,
	};
}

function singleChoiceQuestion(
	overrides?: Partial<ScreenerQuestion>,
): ScreenerQuestion {
	return {
		id: 'q-single',
		prompt: 'Preferred shift',
		type: 'SINGLE_CHOICE',
		options: ['Morning', 'Afternoon', 'Evening'],
		...overrides,
	};
}

function multiChoiceQuestion(
	overrides?: Partial<ScreenerQuestion>,
): ScreenerQuestion {
	return {
		id: 'q-multi',
		prompt: 'Available days',
		type: 'MULTI_CHOICE',
		options: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
		...overrides,
	};
}

function response(questionId: string, value: unknown): ScreenerResponse {
	return { questionId, value };
}

// ===========================================================================
// validateResponses
// ===========================================================================

describe('validateResponses', () => {
	describe('TEXT questions', () => {
		it('accepts a valid non-empty string', () => {
			const result = validateResponses(
				[textQuestion()],
				[response('q-text', 'I love volunteering')],
			);
			expect(result.success).toBe(true);
		});

		it('rejects an empty string', () => {
			const result = validateResponses(
				[textQuestion()],
				[response('q-text', '')],
			);
			expect(result.success).toBe(false);
		});

		it('rejects a non-string value', () => {
			const result = validateResponses(
				[textQuestion()],
				[response('q-text', 123)],
			);
			expect(result.success).toBe(false);
		});
	});

	describe('BOOLEAN questions', () => {
		it('accepts true', () => {
			const result = validateResponses(
				[booleanQuestion()],
				[response('q-bool', true)],
			);
			expect(result.success).toBe(true);
		});

		it('accepts false', () => {
			const result = validateResponses(
				[booleanQuestion()],
				[response('q-bool', false)],
			);
			expect(result.success).toBe(true);
		});

		it('rejects a string that looks like a boolean', () => {
			const result = validateResponses(
				[booleanQuestion()],
				[response('q-bool', 'true')],
			);
			expect(result.success).toBe(false);
		});
	});

	describe('NUMBER questions', () => {
		it('accepts a positive number', () => {
			const result = validateResponses(
				[numberQuestion()],
				[response('q-num', 5)],
			);
			expect(result.success).toBe(true);
		});

		it('accepts zero', () => {
			const result = validateResponses(
				[numberQuestion()],
				[response('q-num', 0)],
			);
			expect(result.success).toBe(true);
		});

		it('rejects a numeric string', () => {
			const result = validateResponses(
				[numberQuestion()],
				[response('q-num', '5')],
			);
			expect(result.success).toBe(false);
		});
	});

	describe('SINGLE_CHOICE questions', () => {
		it('accepts a value that matches an option', () => {
			const result = validateResponses(
				[singleChoiceQuestion()],
				[response('q-single', 'Morning')],
			);
			expect(result.success).toBe(true);
		});

		it('rejects a value not in the options', () => {
			const result = validateResponses(
				[singleChoiceQuestion()],
				[response('q-single', 'Night')],
			);
			expect(result.success).toBe(false);
		});

		it('rejects an empty string', () => {
			const result = validateResponses(
				[singleChoiceQuestion()],
				[response('q-single', '')],
			);
			expect(result.success).toBe(false);
		});
	});

	describe('MULTI_CHOICE questions', () => {
		it('accepts valid selections from options', () => {
			const result = validateResponses(
				[multiChoiceQuestion()],
				[response('q-multi', ['Monday', 'Wednesday'])],
			);
			expect(result.success).toBe(true);
		});

		it('rejects selections that include an invalid option', () => {
			const result = validateResponses(
				[multiChoiceQuestion()],
				[response('q-multi', ['Monday', 'Saturday'])],
			);
			expect(result.success).toBe(false);
		});

		it('rejects a plain string instead of an array', () => {
			const result = validateResponses(
				[multiChoiceQuestion()],
				[response('q-multi', 'Monday')],
			);
			expect(result.success).toBe(false);
		});
	});

	describe('required / optional handling', () => {
		it('fails when a required question has no response', () => {
			const result = validateResponses([textQuestion()], []);
			expect(result.success).toBe(false);
			if (!result.success) {
				const messages = result.error.issues.map((i) => i.message);
				expect(messages).toContain(
					'Missing response for Tell us about yourself',
				);
			}
		});

		it('passes when an optional question has no response', () => {
			const result = validateResponses([textQuestion({ required: false })], []);
			expect(result.success).toBe(true);
		});
	});

	describe('unknown questions', () => {
		it('fails when a response references a question that does not exist', () => {
			const result = validateResponses(
				[textQuestion()],
				[response('q-text', 'hello'), response('q-unknown', 'ghost answer')],
			);
			expect(result.success).toBe(false);
			if (!result.success) {
				const messages = result.error.issues.map((i) => i.message);
				expect(messages).toContain('Unknown question: q-unknown');
			}
		});
	});
});

// ===========================================================================
// evaluateScreening — also tests ruleMatches indirectly
// ===========================================================================

describe('evaluateScreening', () => {
	describe('basic screening with no rules', () => {
		it('returns PASS when all required questions are answered', () => {
			const result = evaluateScreening(
				[textQuestion(), booleanQuestion()],
				[response('q-text', 'hello'), response('q-bool', true)],
			);
			expect(result.status).toBe('PASS');
			expect(result.reasons).toEqual([]);
		});

		it('returns REVIEW when a required question is missing', () => {
			const result = evaluateScreening(
				[textQuestion(), booleanQuestion()],
				[response('q-text', 'hello')],
			);
			expect(result.status).toBe('REVIEW');
			expect(result.reasons).toContain('Missing response for Are you over 18?');
		});

		it('skips missing optional questions without penalty', () => {
			const result = evaluateScreening([textQuestion({ required: false })], []);
			expect(result.status).toBe('PASS');
			expect(result.reasons).toEqual([]);
		});
	});

	// -----------------------------------------------------------------------
	// Disqualifier rules — tests all 6 operators via ruleMatches
	// -----------------------------------------------------------------------

	describe('disqualifier rules', () => {
		it('FAIL on equals match (boolean)', () => {
			const result = evaluateScreening(
				[
					booleanQuestion({
						disqualifierRule: {
							operator: 'equals',
							value: false,
							reason: 'Must be over 18',
						},
					}),
				],
				[response('q-bool', false)],
			);
			expect(result.status).toBe('FAIL');
			expect(result.reasons).toContain('Must be over 18 (Are you over 18?)');
		});

		it('PASS when equals does not match', () => {
			const result = evaluateScreening(
				[
					booleanQuestion({
						disqualifierRule: {
							operator: 'equals',
							value: false,
						},
					}),
				],
				[response('q-bool', true)],
			);
			expect(result.status).toBe('PASS');
		});

		it('FAIL on includes match (array value)', () => {
			const result = evaluateScreening(
				[
					multiChoiceQuestion({
						disqualifierRule: {
							operator: 'includes',
							value: 'Monday',
							reason: 'Mondays unavailable',
						},
					}),
				],
				[response('q-multi', ['Monday', 'Tuesday'])],
			);
			expect(result.status).toBe('FAIL');
		});

		it('FAIL on includes match (string value)', () => {
			const result = evaluateScreening(
				[
					textQuestion({
						disqualifierRule: {
							operator: 'includes',
							value: 'felony',
						},
					}),
				],
				[response('q-text', 'I have a felony conviction')],
			);
			expect(result.status).toBe('FAIL');
		});

		it('PASS on includes when value is not found', () => {
			const result = evaluateScreening(
				[
					multiChoiceQuestion({
						disqualifierRule: {
							operator: 'includes',
							value: 'Saturday',
						},
					}),
				],
				[response('q-multi', ['Monday', 'Tuesday'])],
			);
			expect(result.status).toBe('PASS');
		});

		it('FAIL on lt match', () => {
			const result = evaluateScreening(
				[
					numberQuestion({
						disqualifierRule: {
							operator: 'lt',
							value: 1,
							reason: 'Need at least 1 year',
						},
					}),
				],
				[response('q-num', 0)],
			);
			expect(result.status).toBe('FAIL');
		});

		it('PASS when lt does not match (equal value)', () => {
			const result = evaluateScreening(
				[
					numberQuestion({
						disqualifierRule: { operator: 'lt', value: 1 },
					}),
				],
				[response('q-num', 1)],
			);
			expect(result.status).toBe('PASS');
		});

		it('FAIL on lte match (equal value)', () => {
			const result = evaluateScreening(
				[
					numberQuestion({
						disqualifierRule: { operator: 'lte', value: 0 },
					}),
				],
				[response('q-num', 0)],
			);
			expect(result.status).toBe('FAIL');
		});

		it('FAIL on gt match', () => {
			const result = evaluateScreening(
				[
					numberQuestion({
						disqualifierRule: {
							operator: 'gt',
							value: 10,
							reason: 'Too many years',
						},
					}),
				],
				[response('q-num', 15)],
			);
			expect(result.status).toBe('FAIL');
		});

		it('PASS when gt does not match (equal value)', () => {
			const result = evaluateScreening(
				[
					numberQuestion({
						disqualifierRule: { operator: 'gt', value: 10 },
					}),
				],
				[response('q-num', 10)],
			);
			expect(result.status).toBe('PASS');
		});

		it('FAIL on gte match (equal value)', () => {
			const result = evaluateScreening(
				[
					numberQuestion({
						disqualifierRule: { operator: 'gte', value: 10 },
					}),
				],
				[response('q-num', 10)],
			);
			expect(result.status).toBe('FAIL');
		});

		it('uses default reason when none is provided', () => {
			const result = evaluateScreening(
				[
					booleanQuestion({
						disqualifierRule: { operator: 'equals', value: false },
					}),
				],
				[response('q-bool', false)],
			);
			expect(result.reasons).toContain(
				'Disqualifier matched for Are you over 18?',
			);
		});

		it('returns false for includes when value is not a string or array', () => {
			const result = evaluateScreening(
				[
					numberQuestion({
						disqualifierRule: {
							operator: 'includes',
							value: 5,
						},
					}),
				],
				[response('q-num', 5)],
			);
			// numbers are not strings or arrays, so includes returns false
			expect(result.status).toBe('PASS');
		});

		it('returns false for numeric operators when values are not numbers', () => {
			const result = evaluateScreening(
				[
					textQuestion({
						disqualifierRule: { operator: 'lt', value: 5 },
					}),
				],
				[response('q-text', 'hello')],
			);
			expect(result.status).toBe('PASS');
		});
	});

	// -----------------------------------------------------------------------
	// Review rules
	// -----------------------------------------------------------------------

	describe('review rules', () => {
		it('REVIEW on review rule match', () => {
			const result = evaluateScreening(
				[
					numberQuestion({
						reviewRule: {
							operator: 'lte',
							value: 1,
							reason: 'Low experience',
						},
					}),
				],
				[response('q-num', 1)],
			);
			expect(result.status).toBe('REVIEW');
			expect(result.reasons).toContain('Low experience (Years of experience)');
		});

		it('uses default reason when review rule has no reason', () => {
			const result = evaluateScreening(
				[
					numberQuestion({
						reviewRule: { operator: 'lte', value: 1 },
					}),
				],
				[response('q-num', 0)],
			);
			expect(result.reasons).toContain(
				'Review flag matched for Years of experience',
			);
		});

		it('PASS when review rule does not match', () => {
			const result = evaluateScreening(
				[
					numberQuestion({
						reviewRule: { operator: 'lte', value: 1 },
					}),
				],
				[response('q-num', 5)],
			);
			expect(result.status).toBe('PASS');
		});
	});

	// -----------------------------------------------------------------------
	// Priority: FAIL beats REVIEW
	// -----------------------------------------------------------------------

	describe('status priority', () => {
		it('FAIL wins over REVIEW when both rules match on different questions', () => {
			const result = evaluateScreening(
				[
					booleanQuestion({
						disqualifierRule: { operator: 'equals', value: false },
					}),
					numberQuestion({
						reviewRule: { operator: 'lte', value: 1 },
					}),
				],
				[response('q-bool', false), response('q-num', 0)],
			);
			expect(result.status).toBe('FAIL');
			expect(result.reasons).toHaveLength(2);
		});

		it('FAIL wins even if review rule is evaluated first', () => {
			// review question listed first, disqualifier second
			const result = evaluateScreening(
				[
					numberQuestion({
						reviewRule: { operator: 'lte', value: 1 },
					}),
					booleanQuestion({
						disqualifierRule: { operator: 'equals', value: false },
					}),
				],
				[response('q-num', 0), response('q-bool', false)],
			);
			expect(result.status).toBe('FAIL');
		});

		it('disqualifier does not downgrade to REVIEW', () => {
			// Both a disqualifier and a review on the same question
			const result = evaluateScreening(
				[
					numberQuestion({
						disqualifierRule: { operator: 'lt', value: 1 },
						reviewRule: { operator: 'lte', value: 2 },
					}),
				],
				[response('q-num', 0)],
			);
			expect(result.status).toBe('FAIL');
			// Both reasons should be collected
			expect(result.reasons).toHaveLength(2);
		});
	});

	// -----------------------------------------------------------------------
	// Edge cases
	// -----------------------------------------------------------------------

	describe('edge cases', () => {
		it('handles an empty question list and empty responses', () => {
			const result = evaluateScreening([], []);
			expect(result.status).toBe('PASS');
			expect(result.reasons).toEqual([]);
		});

		it("handles extra responses for questions that don't exist (ignores them)", () => {
			const result = evaluateScreening(
				[textQuestion()],
				[response('q-text', 'hello'), response('q-ghost', 'phantom')],
			);
			// evaluateScreening only iterates over questions, not responses,
			// so extra responses are silently ignored
			expect(result.status).toBe('PASS');
		});
	});
});
