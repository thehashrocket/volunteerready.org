import { describe, expect, it } from 'vitest';
import { createConsentToken, verifyConsentToken } from '../case-study-token';

const TEST_SECRET = 'test-secret-key-for-unit-tests';
const TEST_ORG_ID = 'org_abc123';

describe('createConsentToken', () => {
	it('creates a token with orgId|timestamp|signature format', () => {
		const token = createConsentToken(TEST_ORG_ID, TEST_SECRET);
		const parts = token.split('|');
		expect(parts).toHaveLength(3);
		expect(parts[0]).toBe(TEST_ORG_ID);
		expect(Number(parts[1])).not.toBeNaN();
		expect(parts[2]).toMatch(/^[0-9a-f]{64}$/); // sha256 hex
	});

	it('throws when secret is null', () => {
		expect(() => createConsentToken(TEST_ORG_ID, null)).toThrow(
			'CASE_STUDY_CONSENT_SECRET is not configured.',
		);
	});

	it('uses the provided timestamp', () => {
		const fixedDate = new Date('2026-01-15T00:00:00Z');
		const token = createConsentToken(TEST_ORG_ID, TEST_SECRET, fixedDate);
		const parts = token.split('|');
		expect(parts[1]).toBe(fixedDate.getTime().toString());
	});
});

describe('verifyConsentToken', () => {
	it('returns orgId for a valid token', () => {
		const now = new Date();
		const token = createConsentToken(TEST_ORG_ID, TEST_SECRET, now);
		const result = verifyConsentToken(
			token,
			TEST_SECRET,
			7 * 24 * 60 * 60 * 1000,
			now,
		);
		expect(result).toBe(TEST_ORG_ID);
	});

	it('returns null for expired token', () => {
		const weekAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
		const token = createConsentToken(TEST_ORG_ID, TEST_SECRET, weekAgo);
		const result = verifyConsentToken(token, TEST_SECRET);
		expect(result).toBeNull();
	});

	it('returns null for tampered signature', () => {
		const token = createConsentToken(TEST_ORG_ID, TEST_SECRET);
		const parts = token.split('|');
		const tampered = `${parts[0]}|${parts[1]}|${'a'.repeat(64)}`;
		const result = verifyConsentToken(tampered, TEST_SECRET);
		expect(result).toBeNull();
	});

	it('returns null for wrong secret', () => {
		const token = createConsentToken(TEST_ORG_ID, TEST_SECRET);
		const result = verifyConsentToken(token, 'wrong-secret');
		expect(result).toBeNull();
	});

	it('returns null for malformed token (missing parts)', () => {
		expect(verifyConsentToken('just-a-string', TEST_SECRET)).toBeNull();
		expect(verifyConsentToken('a|b', TEST_SECRET)).toBeNull();
		expect(verifyConsentToken('', TEST_SECRET)).toBeNull();
	});

	it('returns null for non-numeric timestamp', () => {
		const result = verifyConsentToken('org|notanumber|abc', TEST_SECRET);
		expect(result).toBeNull();
	});

	it('returns null when secret is null (env var missing)', () => {
		const token = createConsentToken(TEST_ORG_ID, TEST_SECRET);
		const result = verifyConsentToken(token, null);
		expect(result).toBeNull();
	});

	it('returns null for malformed hex signature', () => {
		const now = new Date();
		const timestamp = now.getTime().toString();
		const badHex = `${TEST_ORG_ID}|${timestamp}|not-valid-hex-at-all!!`;
		const result = verifyConsentToken(
			badHex,
			TEST_SECRET,
			7 * 24 * 60 * 60 * 1000,
			now,
		);
		expect(result).toBeNull();
	});
});
