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
 * Key: CHECKR_TOKEN_ENCRYPTION_KEY env var (32 bytes / 64 hex chars).
 */

import crypto from 'node:crypto';

const PREFIX = 'aes256gcm:';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits — recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

function getEncryptionKey(): Buffer {
	const keyHex = process.env.CHECKR_TOKEN_ENCRYPTION_KEY;
	if (!keyHex) {
		throw new Error(
			'CHECKR_TOKEN_ENCRYPTION_KEY is not set. Required for token encryption.',
		);
	}
	const keyBuf = Buffer.from(keyHex, 'hex');
	if (keyBuf.length !== 32) {
		throw new Error(
			`CHECKR_TOKEN_ENCRYPTION_KEY must be 32 bytes (64 hex chars), got ${keyBuf.length} bytes.`,
		);
	}
	return keyBuf;
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

/**
 * Decrypts a value previously encrypted by encrypt().
 * Expects the "aes256gcm:{iv}:{authTag}:{ciphertext}" format.
 *
 * @throws if format is invalid, key is wrong, or data is corrupted
 */
export function decrypt(ciphertext: string): string {
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
	const key = getEncryptionKey();
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
