import { describe, expect, it, vi } from 'vitest';

// Stub prisma so the top-level import in volunteer-screening.ts doesn't
// throw "DATABASE_URL is not set" during unit tests.
vi.mock('@/server/repositories/prisma', () => ({
	prisma: {},
}));
vi.mock('@/server/repositories/volunteer-applications', () => ({
	getActiveQuestions: vi.fn(),
}));
vi.mock('@/server/repositories/auditRepo', () => ({
	writeAuditLogTx: vi.fn(),
}));

import { mapQuestion } from '../volunteer-screening';

describe('mapQuestion', () => {
	it('maps a simple TEXT question with no rules', () => {
		const result = mapQuestion({
			id: 'q1',
			prompt: 'Tell us about yourself',
			type: 'TEXT',
			configJson: { required: true, maxLength: 500 },
		});
		expect(result).toEqual({
			id: 'q1',
			prompt: 'Tell us about yourself',
			type: 'TEXT',
			options: undefined,
			required: true,
			disqualifierRule: undefined,
			reviewRule: undefined,
		});
	});

	it('maps a SINGLE_CHOICE question with options', () => {
		const result = mapQuestion({
			id: 'q2',
			prompt: 'Preferred shift',
			type: 'SINGLE_CHOICE',
			configJson: {
				required: true,
				options: ['Morning', 'Afternoon'],
			},
		});
		expect(result.options).toEqual(['Morning', 'Afternoon']);
		expect(result.required).toBe(true);
	});

	it('maps a BOOLEAN question with disqualifier rule', () => {
		const result = mapQuestion({
			id: 'q3',
			prompt: 'Are you over 18?',
			type: 'BOOLEAN',
			configJson: {
				required: true,
				rules: {
					disqualifierRule: { operator: 'equals', value: false },
					reason: 'Must be 18+',
				},
			},
		});
		expect(result.disqualifierRule).toEqual({
			operator: 'equals',
			value: false,
			reason: 'Must be 18+',
		});
		expect(result.reviewRule).toBeUndefined();
	});

	it('maps a question with both disqualifier and review rules', () => {
		const result = mapQuestion({
			id: 'q4',
			prompt: 'Years of experience',
			type: 'NUMBER',
			configJson: {
				rules: {
					disqualifierRule: { operator: 'lt', value: 1 },
					reviewIf: { operator: 'lte', value: 3 },
					reason: 'Experience level',
				},
			},
		});
		expect(result.disqualifierRule).toEqual({
			operator: 'lt',
			value: 1,
			reason: 'Experience level',
		});
		expect(result.reviewRule).toEqual({
			operator: 'lte',
			value: 3,
			reason: 'Experience level',
		});
	});

	it('handles null configJson gracefully', () => {
		const result = mapQuestion({
			id: 'q5',
			prompt: 'Anything',
			type: 'TEXT',
			configJson: null,
		});
		expect(result.options).toBeUndefined();
		expect(result.required).toBeUndefined();
		expect(result.disqualifierRule).toBeUndefined();
	});

	it('handles empty object configJson', () => {
		const result = mapQuestion({
			id: 'q6',
			prompt: 'Anything',
			type: 'TEXT',
			configJson: {},
		});
		expect(result.required).toBeUndefined();
		expect(result.options).toBeUndefined();
	});

	it('throws on malformed configJson', () => {
		expect(() =>
			mapQuestion({
				id: 'q7',
				prompt: 'Bad',
				type: 'TEXT',
				configJson: { required: 'not-a-boolean' },
			}),
		).toThrow();
	});
});
