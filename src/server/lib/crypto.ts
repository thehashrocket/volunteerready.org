/**
 * crypto.ts — AES-256-GCM encryption utilities for secrets at rest.
 *
 * Used to encrypt OAuth access tokens (e.g., Checkr) before DB storage
 * and decrypt them on read.
 *
 * Format:
 *   "aes256gcm:{iv_hex}:{authTag_hex}:{ciphertext_hex}"
 *
 * The "aes256gcm:" prefix acts as a sentinel for tryDecrypt to distinguish
 * encrypted values from legacy plaintext values (zero-downtime migration).
 *
 *   encrypt(plaintext) ──► "aes256gcm:abc123:def456:789..."
 *   decrypt(ciphertext) ──► plaintext
 *   tryDecrypt(value)   ──► plaintext (encrypted) or value as-is (plaintext)
 *
 * Key rotation (5-step zero-downtime sequence):
 *
 *   Step 1: Set CHECKR_TOKEN_ENCRYPTION_KEY_NEW with new key value
 *   Step 2: Deploy — decrypt() tries primary key first, falls back to _NEW
 *           encrypt() always uses primary key
 *   Step 3: Run re-encrypt script (scripts/reencrypt-tokens.ts) to re-encrypt
 *           all tokens with the NEW key
 *   Step 4: Swap env vars — move _NEW value into primary, remove _NEW
 *   Step 5: Deploy — back to single-key mode
 *
 * Key: CHECKR_TOKEN_ENCRYPTION_KEY env var (32 bytes / 64 hex chars).
 * Rotation key: CHECKR_TOKEN_ENCRYPTION_KEY_NEW (optional, same format).
 */

import crypto from 'node:crypto';

const PREFIX = 'aes256gcm:';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits — recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

function parseKeyHex(keyHex: string, label: string): Buffer {
	const keyBuf = Buffer.from(keyHex, 'hex');
	if (keyBuf.length !== 32) {
		throw new Error(
			`${label} must be 32 bytes (64 hex chars), got ${keyBuf.length} bytes.`,
		);
	}
	return keyBuf;
}

function getEncryptionKey(): Buffer {
	const keyHex = process.env.CHECKR_TOKEN_ENCRYPTION_KEY;
	if (!keyHex) {
		throw new Error(
			'CHECKR_TOKEN_ENCRYPTION_KEY is not set. Required for token encryption.',
		);
	}
	return parseKeyHex(keyHex, 'CHECKR_TOKEN_ENCRYPTION_KEY');
}

/** Returns the rotation key if set, or null. */
function getRotationKey(): Buffer | null {
	const keyHex = process.env.CHECKR_TOKEN_ENCRYPTION_KEY_NEW;
	if (!keyHex) return null;
	return parseKeyHex(keyHex, 'CHECKR_TOKEN_ENCRYPTION_KEY_NEW');
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns a prefixed string: "aes256gcm:{iv}:{authTag}:{ciphertext}"
 *
 * @throws if plaintext is empty or key is invalid
 */
export function encrypt(plaintext: string): string {
	if (!plaintext) {
		throw new Error('Cannot encrypt empty value.');
	}

	const key = getEncryptionKey();
	const iv = crypto.randomBytes(IV_LENGTH);
	const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
		authTagLength: AUTH_TAG_LENGTH,
	});

	const encrypted = Buffer.concat([
		cipher.update(plaintext, 'utf-8'),
		cipher.final(),
	]);
	const authTag = cipher.getAuthTag();

	return `${PREFIX}${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/** Decrypt with a specific key. Throws on failure. */
function decryptWithKey(ciphertext: string, key: Buffer): string {
	if (!ciphertext.startsWith(PREFIX)) {
		throw new Error(
			'Value is not in encrypted format (missing aes256gcm: prefix).',
		);
	}

	const parts = ciphertext.slice(PREFIX.length).split(':');
	if (parts.length !== 3) {
		throw new Error(
			'Malformed encrypted value — expected iv:authTag:ciphertext.',
		);
	}

	const ivHex = parts[0] as string;
	const authTagHex = parts[1] as string;
	const encryptedHex = parts[2] as string;
	const iv = Buffer.from(ivHex, 'hex');
	const authTag = Buffer.from(authTagHex, 'hex');
	const encrypted = Buffer.from(encryptedHex, 'hex');

	const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
		authTagLength: AUTH_TAG_LENGTH,
	});
	decipher.setAuthTag(authTag);

	const decrypted = Buffer.concat([
		decipher.update(encrypted),
		decipher.final(),
	]);

	return decrypted.toString('utf-8');
}

/**
 * Decrypts a value previously encrypted by encrypt().
 * Expects the "aes256gcm:{iv}:{authTag}:{ciphertext}" format.
 *
 * During key rotation: tries the primary key first, then falls back to
 * the rotation key (CHECKR_TOKEN_ENCRYPTION_KEY_NEW). This allows
 * decryption of tokens encrypted with either key during the migration window.
 *
 * @throws if format is invalid or neither key can decrypt
 */
export function decrypt(ciphertext: string): string {
	const primaryKey = getEncryptionKey();
	try {
		return decryptWithKey(ciphertext, primaryKey);
	} catch (primaryErr) {
		const rotationKey = getRotationKey();
		if (!rotationKey) throw primaryErr;

		// Try the rotation key — if this also fails, throw the original error
		// so the caller sees the primary key failure message
		try {
			return decryptWithKey(ciphertext, rotationKey);
		} catch {
			throw primaryErr;
		}
	}
}

/**
 * Attempts to decrypt a value. If the value is not in encrypted format
 * (no "aes256gcm:" prefix), returns it as-is — this supports the
 * zero-downtime migration path where existing plaintext tokens are
 * read without modification.
 *
 * If the value IS in encrypted format but decryption fails (wrong key,
 * corrupted data), the error is thrown — not silently swallowed.
 */
export function tryDecrypt(value: string): string {
	if (!value.startsWith(PREFIX)) {
		return value; // Legacy plaintext — migration path
	}
	return decrypt(value);
}

/**
 * Re-encrypts a ciphertext value with the current primary key.
 * Decrypts (using primary or rotation key fallback), then re-encrypts
 * with the primary key. Used by the key rotation migration script.
 *
 * Returns null if the value is already encrypted with the primary key
 * (no-op optimization to avoid unnecessary DB writes).
 */
export function reEncrypt(ciphertext: string): string | null {
	const plaintext = decrypt(ciphertext);
	const reEncrypted = encrypt(plaintext);
	// Verify roundtrip — belt-and-suspenders for key rotation safety
	const verified = decrypt(reEncrypted);
	if (verified !== plaintext) {
		throw new Error(
			'Re-encryption verification failed — plaintext mismatch after roundtrip.',
		);
	}
	return reEncrypted;
}
