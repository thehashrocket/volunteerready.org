/**
 * Unit tests for platform-catalog domain Zod schemas.
 * Verifies slug + field validation rules that keep admin-entered data safe.
 */

import { describe, expect, it } from 'vitest';
import {
	createDefaultQuestionInput,
	createSkillFamilyInput,
	createSkillInput,
	updateDefaultQuestionInput,
	updateSkillFamilyInput,
	updateSkillInput,
} from './platform-catalog';

const cuid = 'cjld2cjxh0000qzrmn831i7rn';

describe('slug validation', () => {
	it.each([
		['leadership', true],
		['animal-handling', true],
		['a1-b2-c3', true],
		['Leadership', false], // uppercase
		['animal handling', false], // space
		['-leading', false], // leading hyphen
		['trailing-', false], // trailing hyphen
		['double--hyphen', false], // double hyphen
		['under_score', false], // underscore
		['', false], // empty
	])('slug %s → valid=%s', (slug, expected) => {
		const result = createSkillFamilyInput.safeParse({ name: 'X', slug });
		expect(result.success).toBe(expected);
	});
});

describe('createSkillFamilyInput', () => {
	it('accepts valid input with optional order', () => {
		expect(
			createSkillFamilyInput.safeParse({
				name: 'Leadership',
				slug: 'leadership',
				order: 5,
			}).success,
		).toBe(true);
	});

	it('rejects empty name', () => {
		expect(
			createSkillFamilyInput.safeParse({ name: '', slug: 'leadership' })
				.success,
		).toBe(false);
	});

	it('rejects negative order', () => {
		expect(
			createSkillFamilyInput.safeParse({
				name: 'Leadership',
				slug: 'leadership',
				order: -1,
			}).success,
		).toBe(false);
	});
});

describe('updateSkillFamilyInput', () => {
	it('requires cuid id', () => {
		expect(
			updateSkillFamilyInput.safeParse({ id: 'not-a-cuid', name: 'X' }).success,
		).toBe(false);
		expect(
			updateSkillFamilyInput.safeParse({ id: cuid, name: 'X' }).success,
		).toBe(true);
	});

	it('accepts isActive boolean', () => {
		expect(
			updateSkillFamilyInput.safeParse({ id: cuid, isActive: false }).success,
		).toBe(true);
	});
});

describe('createSkillInput', () => {
	it('requires cuid familyId', () => {
		expect(
			createSkillInput.safeParse({
				familyId: 'bad',
				name: 'X',
				slug: 'x',
			}).success,
		).toBe(false);
	});
});

describe('updateSkillInput', () => {
	it('allows partial updates', () => {
		expect(updateSkillInput.safeParse({ id: cuid, name: 'X' }).success).toBe(
			true,
		);
		expect(
			updateSkillInput.safeParse({ id: cuid, isActive: true }).success,
		).toBe(true);
	});
});

describe('createDefaultQuestionInput', () => {
	it('accepts valid input', () => {
		expect(
			createDefaultQuestionInput.safeParse({
				key: 'age-18-plus',
				prompt: 'Are you 18+?',
				type: 'BOOLEAN',
				order: 0,
				configJson: { required: true },
			}).success,
		).toBe(true);
	});

	it('rejects invalid type enum', () => {
		expect(
			createDefaultQuestionInput.safeParse({
				key: 'age-18-plus',
				prompt: 'Are you 18+?',
				type: 'SOMETHING_ELSE',
				configJson: {},
			}).success,
		).toBe(false);
	});

	it('rejects empty prompt', () => {
		expect(
			createDefaultQuestionInput.safeParse({
				key: 'x',
				prompt: '',
				type: 'TEXT',
				configJson: {},
			}).success,
		).toBe(false);
	});
});

describe('updateDefaultQuestionInput', () => {
	it('does not accept key changes (immutable)', () => {
		const parsed = updateDefaultQuestionInput.safeParse({
			id: cuid,
			// biome-ignore lint/suspicious/noExplicitAny: runtime field sneak-in test
			key: 'new-key' as any,
			prompt: 'New',
		});
		expect(parsed.success).toBe(true);
		// Key is stripped by the schema (not declared)
		if (parsed.success) {
			expect('key' in parsed.data).toBe(false);
		}
	});
});
