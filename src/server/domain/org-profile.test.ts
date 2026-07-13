import { describe, expect, it } from 'vitest';
import {
	normalizeSlugInput,
	orgProfileUpdateSchema,
	orgSlugSchema,
	RESERVED_ORG_SLUGS,
} from './org-profile';

describe('orgSlugSchema', () => {
	it('accepts valid slugs', () => {
		for (const slug of [
			'abc',
			'greenfield-community-center',
			'org-123',
			'a1b',
		]) {
			expect(orgSlugSchema.safeParse(slug).success).toBe(true);
		}
	});

	it('rejects slugs shorter than 3 or longer than 60 chars', () => {
		expect(orgSlugSchema.safeParse('ab').success).toBe(false);
		expect(orgSlugSchema.safeParse('a'.repeat(61)).success).toBe(false);
		expect(orgSlugSchema.safeParse('a'.repeat(60)).success).toBe(true);
	});

	it('rejects uppercase, spaces, underscores, and symbols', () => {
		for (const slug of ['Abc', 'my org', 'my_org', 'org!', 'café']) {
			expect(orgSlugSchema.safeParse(slug).success).toBe(false);
		}
	});

	it('rejects leading, trailing, and doubled hyphens', () => {
		for (const slug of ['-org', 'org-', 'my--org']) {
			expect(orgSlugSchema.safeParse(slug).success).toBe(false);
		}
	});

	it('rejects every reserved slug', () => {
		for (const slug of RESERVED_ORG_SLUGS) {
			const result = orgSlugSchema.safeParse(slug);
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues[0].message).toBe('This name is reserved');
			}
		}
	});

	it('reserves the slugs that collide with live /apply routes', () => {
		expect(RESERVED_ORG_SLUGS.has('status')).toBe(true);
		expect(RESERVED_ORG_SLUGS.has('refer')).toBe(true);
	});
});

describe('orgProfileUpdateSchema', () => {
	it('accepts a valid profile', () => {
		expect(
			orgProfileUpdateSchema.safeParse({
				name: 'Greenfield Community Center',
				slug: 'greenfield-community-center',
			}).success,
		).toBe(true);
	});

	it('trims and rejects too-short names', () => {
		expect(
			orgProfileUpdateSchema.safeParse({ name: '  a  ', slug: 'valid-slug' })
				.success,
		).toBe(false);
	});

	it('enforces the 120-char name maximum on the trimmed value', () => {
		const ok = { name: 'a'.repeat(120), slug: 'valid-slug' };
		const tooLong = { name: 'a'.repeat(121), slug: 'valid-slug' };
		const paddedOk = { name: `  ${'a'.repeat(119)}  `, slug: 'valid-slug' };
		expect(orgProfileUpdateSchema.safeParse(ok).success).toBe(true);
		expect(orgProfileUpdateSchema.safeParse(tooLong).success).toBe(false);
		expect(orgProfileUpdateSchema.safeParse(paddedOk).success).toBe(true);
	});
});

describe('normalizeSlugInput', () => {
	it('lowercases and converts spaces to hyphens', () => {
		expect(normalizeSlugInput('Greenfield Community')).toBe(
			'greenfield-community',
		);
	});

	it('strips invalid characters', () => {
		expect(normalizeSlugInput('Paws & Claws!')).toBe('paws-claws');
	});

	it('collapses doubled hyphens but preserves a trailing one mid-typing', () => {
		expect(normalizeSlugInput('my--org')).toBe('my-org');
		expect(normalizeSlugInput('my-')).toBe('my-');
	});
});
