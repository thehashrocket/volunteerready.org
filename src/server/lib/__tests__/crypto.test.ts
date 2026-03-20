import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { decrypt, encrypt, reEncrypt, tryDecrypt } from '../crypto';

// A valid 32-byte key (64 hex chars)
const TEST_KEY =
	'0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

// A different valid 32-byte key
const OTHER_KEY =
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
		vi.stubEnv('CHECKR_TOKEN_ENCRYPTION_KEY', OTHER_KEY);
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
		vi.stubEnv('CHECKR_TOKEN_ENCRYPTION_KEY', OTHER_KEY);
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

describe('dual-key rotation', () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it('decrypts with primary key when no rotation key is set', () => {
		vi.stubEnv('CHECKR_TOKEN_ENCRYPTION_KEY', TEST_KEY);
		const encrypted = encrypt('secret');
		expect(decrypt(encrypted)).toBe('secret');
	});

	it('decrypts tokens encrypted with rotation key via fallback', () => {
		// Encrypt with OTHER_KEY as primary
		vi.stubEnv('CHECKR_TOKEN_ENCRYPTION_KEY', OTHER_KEY);
		const encrypted = encrypt('rotation-secret');

		// Now switch: TEST_KEY is primary, OTHER_KEY is rotation
		vi.stubEnv('CHECKR_TOKEN_ENCRYPTION_KEY', TEST_KEY);
		vi.stubEnv('CHECKR_TOKEN_ENCRYPTION_KEY_NEW', OTHER_KEY);

		// Should decrypt via fallback to rotation key
		expect(decrypt(encrypted)).toBe('rotation-secret');
	});

	it('prefers primary key over rotation key', () => {
		vi.stubEnv('CHECKR_TOKEN_ENCRYPTION_KEY', TEST_KEY);
		vi.stubEnv('CHECKR_TOKEN_ENCRYPTION_KEY_NEW', OTHER_KEY);

		// Encrypt with primary
		const encrypted = encrypt('primary-secret');

		// Decrypt — should work with primary key (no fallback needed)
		expect(decrypt(encrypted)).toBe('primary-secret');
	});

	it('throws when neither key works', () => {
		vi.stubEnv('CHECKR_TOKEN_ENCRYPTION_KEY', TEST_KEY);
		const encrypted = encrypt('secret');

		// Set both keys to something different
		const thirdKey =
			'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
		vi.stubEnv('CHECKR_TOKEN_ENCRYPTION_KEY', thirdKey);
		vi.stubEnv('CHECKR_TOKEN_ENCRYPTION_KEY_NEW', thirdKey);

		expect(() => decrypt(encrypted)).toThrow();
	});

	it('tryDecrypt uses dual-key fallback for encrypted values', () => {
		vi.stubEnv('CHECKR_TOKEN_ENCRYPTION_KEY', OTHER_KEY);
		const encrypted = encrypt('try-decrypt-rotation');

		vi.stubEnv('CHECKR_TOKEN_ENCRYPTION_KEY', TEST_KEY);
		vi.stubEnv('CHECKR_TOKEN_ENCRYPTION_KEY_NEW', OTHER_KEY);

		expect(tryDecrypt(encrypted)).toBe('try-decrypt-rotation');
	});

	it('validates rotation key format', () => {
		vi.stubEnv('CHECKR_TOKEN_ENCRYPTION_KEY', TEST_KEY);
		vi.stubEnv('CHECKR_TOKEN_ENCRYPTION_KEY_NEW', 'too-short');

		// Encrypt something with a valid primary
		const encrypted = encrypt('test');

		// Primary key works fine
		expect(decrypt(encrypted)).toBe('test');

		// But if primary fails and rotation key is malformed, throw primary error
		vi.stubEnv('CHECKR_TOKEN_ENCRYPTION_KEY', OTHER_KEY);
		expect(() => decrypt(encrypted)).toThrow();
	});
});

describe('reEncrypt', () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it('re-encrypts a token with the current primary key', () => {
		vi.stubEnv('CHECKR_TOKEN_ENCRYPTION_KEY', OTHER_KEY);
		const original = encrypt('re-encrypt-me');

		// Switch primary to TEST_KEY, OLD key as rotation
		vi.stubEnv('CHECKR_TOKEN_ENCRYPTION_KEY', TEST_KEY);
		vi.stubEnv('CHECKR_TOKEN_ENCRYPTION_KEY_NEW', OTHER_KEY);

		const reEncrypted = reEncrypt(original);
		expect(reEncrypted).not.toBeNull();
		expect(reEncrypted).not.toBe(original);

		// Should now be decryptable with just the new primary key (no rotation)
		vi.stubEnv('CHECKR_TOKEN_ENCRYPTION_KEY', TEST_KEY);
		vi.stubEnv('CHECKR_TOKEN_ENCRYPTION_KEY_NEW', '');
		expect(decrypt(reEncrypted!)).toBe('re-encrypt-me');
	});

	it('re-encrypts tokens already on the primary key (new IV)', () => {
		vi.stubEnv('CHECKR_TOKEN_ENCRYPTION_KEY', TEST_KEY);
		const original = encrypt('already-primary');

		const reEncrypted = reEncrypt(original);
		expect(reEncrypted).not.toBeNull();
		expect(reEncrypted).not.toBe(original); // Different IV
		expect(decrypt(reEncrypted!)).toBe('already-primary');
	});

	it('verifies roundtrip integrity', () => {
		vi.stubEnv('CHECKR_TOKEN_ENCRYPTION_KEY', TEST_KEY);
		const original = encrypt('integrity-check');

		const reEncrypted = reEncrypt(original);
		expect(reEncrypted).not.toBeNull();
		expect(decrypt(reEncrypted!)).toBe('integrity-check');
	});
});
