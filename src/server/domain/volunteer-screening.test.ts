import { describe, expect, it } from 'vitest';
import { DEFAULT_SCREENER_QUESTIONS } from './volunteer-screening';

describe('DEFAULT_SCREENER_QUESTIONS', () => {
	it('contains 5 starter questions', () => {
		expect(DEFAULT_SCREENER_QUESTIONS).toHaveLength(5);
	});

	it('has unique keys', () => {
		const keys = DEFAULT_SCREENER_QUESTIONS.map((q) => q.key);
		expect(new Set(keys).size).toBe(keys.length);
	});

	it('has ascending order values', () => {
		const orders = DEFAULT_SCREENER_QUESTIONS.map((q) => q.order);
		for (let i = 1; i < orders.length; i++) {
			expect(orders[i]).toBeGreaterThan(orders[i - 1]);
		}
	});

	it('uses valid question types', () => {
		const validTypes = [
			'TEXT',
			'SINGLE_CHOICE',
			'MULTI_CHOICE',
			'BOOLEAN',
			'NUMBER',
		];
		for (const q of DEFAULT_SCREENER_QUESTIONS) {
			expect(validTypes).toContain(q.type);
		}
	});

	it('all questions have configJson with required field', () => {
		for (const q of DEFAULT_SCREENER_QUESTIONS) {
			expect(q.configJson).toBeDefined();
			expect(typeof q.configJson.required).toBe('boolean');
		}
	});

	it('BOOLEAN disqualifier questions have reason text', () => {
		const disqualifiers = DEFAULT_SCREENER_QUESTIONS.filter(
			(q) =>
				q.type === 'BOOLEAN' &&
				(q.configJson.rules as Record<string, unknown> | undefined)
					?.disqualifierRule,
		);
		expect(disqualifiers.length).toBeGreaterThan(0);
		for (const q of disqualifiers) {
			const rules = q.configJson.rules as Record<string, unknown>;
			expect(typeof rules.reason).toBe('string');
			expect((rules.reason as string).length).toBeGreaterThan(0);
		}
	});

	it('SINGLE_CHOICE questions have options array', () => {
		const choiceQs = DEFAULT_SCREENER_QUESTIONS.filter(
			(q) => q.type === 'SINGLE_CHOICE',
		);
		for (const q of choiceQs) {
			expect(Array.isArray(q.configJson.options)).toBe(true);
			expect((q.configJson.options as string[]).length).toBeGreaterThanOrEqual(
				2,
			);
		}
	});

	it('keys are kebab-case and <= 50 chars', () => {
		for (const q of DEFAULT_SCREENER_QUESTIONS) {
			expect(q.key).toMatch(/^[a-z0-9-]+$/);
			expect(q.key.length).toBeLessThanOrEqual(50);
		}
	});
});
