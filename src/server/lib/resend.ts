/**
 * Shared Resend email client singleton.
 *
 * All email-sending code should import from here instead of
 * instantiating `new Resend()` directly.
 *
 * Lazy-initialized to avoid build-time errors when RESEND_API_KEY
 * is not set (e.g., during `next build` in CI).
 */

import { Resend } from 'resend';

let _resend: Resend | null = null;

/**
 * Returns the shared Resend client instance.
 * Lazily initialized on first call.
 */
export function getResend(): Resend {
	if (!_resend) {
		_resend = new Resend(process.env.RESEND_API_KEY);
	}
	return _resend;
}

/**
 * Returns the configured sender address.
 * Throws if RESEND_FROM_EMAIL is not set.
 */
export function getFromEmail(): string {
	const from = process.env.RESEND_FROM_EMAIL;
	if (!from) throw new Error('RESEND_FROM_EMAIL is not set');
	return from;
}
