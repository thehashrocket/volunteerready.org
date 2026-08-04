import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	generateUnsubscribeToken,
	generateUnsubscribeTokenFromEnv,
	validateUnsubscribeToken,
	validateUnsubscribeTokenFromEnv,
} from '../digest-unsubscribe-token';

const TEST_SECRET = 'test-secret-for-digest-unsubscribe';
const TEST_USER_ID = 'user_abc123';

describe('generateUnsubscribeToken', () => {
	it('returns a hex string', () => {
		const token = generateUnsubscribeToken(TEST_SECRET, TEST_USER_ID);
		expect(token).toMatch(/^[0-9a-f]+$/);
	});

	it('is deterministic for the same inputs', () => {
		const a = generateUnsubscribeToken(TEST_SECRET, TEST_USER_ID);
		const b = generateUnsubscribeToken(TEST_SECRET, TEST_USER_ID);
		expect(a).toBe(b);
	});

	it('differs by userId', () => {
		const a = generateUnsubscribeToken(TEST_SECRET, 'user_1');
		const b = generateUnsubscribeToken(TEST_SECRET, 'user_2');
		expect(a).not.toBe(b);
	});

	it('differs by secret', () => {
		const a = generateUnsubscribeToken('secret-a', TEST_USER_ID);
		const b = generateUnsubscribeToken('secret-b', TEST_USER_ID);
		expect(a).not.toBe(b);
	});
});

describe('validateUnsubscribeToken', () => {
	it('returns true for a valid token', () => {
		const token = generateUnsubscribeToken(TEST_SECRET, TEST_USER_ID);
		expect(validateUnsubscribeToken(TEST_SECRET, TEST_USER_ID, token)).toBe(
			true,
		);
	});

	it('returns false for a tampered token', () => {
		const token = generateUnsubscribeToken(TEST_SECRET, TEST_USER_ID);
		const tampered = `${token.slice(0, -2)}ff`;
		expect(validateUnsubscribeToken(TEST_SECRET, TEST_USER_ID, tampered)).toBe(
			false,
		);
	});

	it('returns false for a wrong userId', () => {
		const token = generateUnsubscribeToken(TEST_SECRET, TEST_USER_ID);
		expect(validateUnsubscribeToken(TEST_SECRET, 'wrong_user', token)).toBe(
			false,
		);
	});

	it('returns false for a wrong secret', () => {
		const token = generateUnsubscribeToken(TEST_SECRET, TEST_USER_ID);
		expect(validateUnsubscribeToken('wrong-secret', TEST_USER_ID, token)).toBe(
			false,
		);
	});

	it('returns false for a length-mismatched token (non-hex garbage)', () => {
		expect(validateUnsubscribeToken(TEST_SECRET, TEST_USER_ID, 'short')).toBe(
			false,
		);
	});

	it('returns false for an empty token', () => {
		expect(validateUnsubscribeToken(TEST_SECRET, TEST_USER_ID, '')).toBe(false);
	});

	it('returns false for non-hex token (catches exception)', () => {
		expect(
			validateUnsubscribeToken(TEST_SECRET, TEST_USER_ID, 'gg'.repeat(32)),
		).toBe(false);
	});
});

describe('env convenience wrappers', () => {
	beforeEach(() => {
		vi.stubEnv('DIGEST_UNSUBSCRIBE_SECRET', TEST_SECRET);
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it('generateUnsubscribeTokenFromEnv generates a token using env secret', () => {
		const token = generateUnsubscribeTokenFromEnv(TEST_USER_ID);
		const expected = generateUnsubscribeToken(TEST_SECRET, TEST_USER_ID);
		expect(token).toBe(expected);
	});

	it('validateUnsubscribeTokenFromEnv validates using env secret', () => {
		const token = generateUnsubscribeToken(TEST_SECRET, TEST_USER_ID);
		expect(validateUnsubscribeTokenFromEnv(TEST_USER_ID, token)).toBe(true);
	});

	it('generateUnsubscribeTokenFromEnv throws when env secret is missing', () => {
		vi.stubEnv('DIGEST_UNSUBSCRIBE_SECRET', '');
		expect(() => generateUnsubscribeTokenFromEnv(TEST_USER_ID)).toThrow(
			'DIGEST_UNSUBSCRIBE_SECRET is not configured',
		);
	});

	it('validateUnsubscribeTokenFromEnv throws when env secret is missing', () => {
		vi.stubEnv('DIGEST_UNSUBSCRIBE_SECRET', '');
		expect(() =>
			validateUnsubscribeTokenFromEnv(TEST_USER_ID, 'sometoken'),
		).toThrow('DIGEST_UNSUBSCRIBE_SECRET is not configured');
	});
});
