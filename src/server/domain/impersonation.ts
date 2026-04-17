import { z } from 'zod';

/**
 * Cookie name that carries the active impersonation session id.
 *
 * The cookie is set after `impersonation.start` succeeds and cleared on
 * `end`, on expiry, or on any server-side binding mismatch.
 */
export const IMPERSONATION_COOKIE = 'impersonation-session-id';

/** Hard cap — no refresh, start a new session if you need more time. */
export const IMPERSONATION_MAX_DURATION_MS = 30 * 60 * 1000;

/** Reason length bounds — matches the plan's UX constraint. */
export const IMPERSONATION_REASON_MIN = 10;
export const IMPERSONATION_REASON_MAX = 200;

export const reasonSchema = z
	.string()
	.trim()
	.min(IMPERSONATION_REASON_MIN, {
		message: `Reason must be at least ${IMPERSONATION_REASON_MIN} characters.`,
	})
	.max(IMPERSONATION_REASON_MAX, {
		message: `Reason must be at most ${IMPERSONATION_REASON_MAX} characters.`,
	});

export const startImpersonationSchema = z.object({
	targetId: z.string().cuid(),
	reason: reasonSchema,
});

export const endImpersonationSchema = z.object({
	sessionId: z.string().cuid().optional(),
});

export type EndedReason = 'expired' | 'manual' | 'admin-logout';

/** Effective user resolved from admin session + impersonation cookie. */
export type EffectiveUser = {
	userId: string;
	isImpersonation: boolean;
	impersonatedBy: string | null;
	impersonationSessionId: string | null;
	expiresAt: Date | null;
};

/** Audit action constants — the audit log is the forever record. */
export const IMPERSONATION_START_ACTION = 'IMPERSONATION_START';
export const IMPERSONATION_END_ACTION = 'IMPERSONATION_END';
export const IMPERSONATION_ENTITY = 'ImpersonationSession';
