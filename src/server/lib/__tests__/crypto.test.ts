import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { decrypt, encrypt, tryDecrypt } from '../crypto';

// A valid 32-byte key (64 hex chars)
const TEST_KEY =
	'0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

// A different valid 32-byte key
const WRONG_KEY =
	'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';

describe('encrypt/decrypt', () => {
	beforeEach(() => {
		vi.stubEnv('CHECKR_TOKEN_ENCRYPTION_KEY', TEST_KEY);
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it('roundtrips: encrypt then decrypt returns original', () => {
		const plaintext = 'my-secret-oauth-token-12345';
		const encrypted = encrypt(plaintext);
		expect(encrypted).not.toBe(plaintext);
		expect(encrypted.startsWith('aes256gcm:')).toBe(true);
		expect(decrypt(encrypted)).toBe(plaintext);
	});

	it('produces different ciphertext each time (random IV)', () => {
		const plaintext = 'same-value-twice';
		const a = encrypt(plaintext);
		const b = encrypt(plaintext);
		expect(a).not.toBe(b);
		// Both should decrypt to the same value
		expect(decrypt(a)).toBe(plaintext);
		expect(decrypt(b)).toBe(plaintext);
	});

	it('throws on empty plaintext', () => {
		expect(() => encrypt('')).toThrow('Cannot encrypt empty value');
	});

	it('throws on decrypt with wrong key', () => {
		const encrypted = encrypt('secret');
		vi.stubEnv('CHECKR_TOKEN_ENCRYPTION_KEY', WRONG_KEY);
		expect(() => decrypt(encrypted)).toThrow();
	});

	it('throws on decrypt with malformed format (missing parts)', () => {
		expect(() => decrypt('aes256gcm:only-one-part')).toThrow(
			'Malformed encrypted value',
		);
	});

	it('throws on decrypt of non-encrypted value', () => {
		expect(() => decrypt('plain-text-value')).toThrow(
			'not in encrypted format',
		);
	});
});

describe('encrypt key validation', () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it('throws when key env var is missing', () => {
		vi.stubEnv('CHECKR_TOKEN_ENCRYPTION_KEY', '');
		expect(() => encrypt('test')).toThrow(
			'CHECKR_TOKEN_ENCRYPTION_KEY is not set',
		);
	});

	it('throws when key is wrong length (too short)', () => {
		vi.stubEnv('CHECKR_TOKEN_ENCRYPTION_KEY', 'abcdef');
		expect(() => encrypt('test')).toThrow('must be 32 bytes');
	});
});

describe('tryDecrypt', () => {
	beforeEach(() => {
		vi.stubEnv('CHECKR_TOKEN_ENCRYPTION_KEY', TEST_KEY);
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it('decrypts encrypted values', () => {
		const plaintext = 'oauth-token-xyz';
		const encrypted = encrypt(plaintext);
		expect(tryDecrypt(encrypted)).toBe(plaintext);
	});

	it('returns plaintext values as-is (migration path)', () => {
		const plaintext = 'legacy-unencrypted-token';
		expect(tryDecrypt(plaintext)).toBe(plaintext);
	});

	it('throws on encrypted format with wrong key (not silent)', () => {
		const encrypted = encrypt('secret');
		vi.stubEnv('CHECKR_TOKEN_ENCRYPTION_KEY', WRONG_KEY);
		expect(() => tryDecrypt(encrypted)).toThrow();
	});

	it('throws on encrypted format with missing key', () => {
		const encrypted = encrypt('secret');
		vi.stubEnv('CHECKR_TOKEN_ENCRYPTION_KEY', '');
		expect(() => tryDecrypt(encrypted)).toThrow(
			'CHECKR_TOKEN_ENCRYPTION_KEY is not set',
		);
	});
});
