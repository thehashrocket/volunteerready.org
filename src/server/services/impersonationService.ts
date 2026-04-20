import { TRPCError } from '@trpc/server';
import {
	type EffectiveUser,
	type EndedReason,
	IMPERSONATION_END_ACTION,
	IMPERSONATION_ENTITY,
	IMPERSONATION_MAX_DURATION_MS,
	IMPERSONATION_START_ACTION,
} from '@/server/domain/impersonation';
import { isPlatformAdmin } from '@/server/domain/platform-admin';
import { sendImpersonationStartAlert } from '@/server/lib/admin-alerts';
import {
	writeAuditLog,
	writeAuditLogTx,
} from '@/server/repositories/auditRepo';
import {
	createImpersonationSessionTx,
	endImpersonationSession,
	findActiveImpersonationSession,
	getImpersonationHistory,
} from '@/server/repositories/impersonationRepo';
import { prisma } from '@/server/repositories/prisma';

/**
 * Start an impersonation session.
 *
 * Invariants:
 *   - admin must be a platform admin (re-checked, never trust UI)
 *   - target must exist and not be a platform admin (no privilege chains)
 *   - admin != target (obvious, but explicit)
 *   - session + audit row are written in the same transaction
 */
export async function startImpersonation(
	adminUserId: string,
	targetUserId: string,
	reason: string,
) {
	if (adminUserId === targetUserId) {
		throw new TRPCError({
			code: 'BAD_REQUEST',
			message: 'You cannot impersonate yourself.',
		});
	}

	const adminIsPlatformAdmin = await isPlatformAdmin(adminUserId);
	if (!adminIsPlatformAdmin) {
		throw new TRPCError({
			code: 'FORBIDDEN',
			message: 'Platform admin access required.',
		});
	}

	const target = await prisma.user.findUnique({
		where: { id: targetUserId },
		select: { id: true, isPlatformAdmin: true, email: true },
	});
	if (!target) {
		throw new TRPCError({
			code: 'NOT_FOUND',
			message: 'Target user not found.',
		});
	}

	const targetIsPlatformAdmin = await isPlatformAdmin(targetUserId);
	if (target.isPlatformAdmin || targetIsPlatformAdmin) {
		throw new TRPCError({
			code: 'FORBIDDEN',
			message: 'Cannot impersonate another platform admin.',
		});
	}

	const expiresAt = new Date(Date.now() + IMPERSONATION_MAX_DURATION_MS);

	const result = await prisma.$transaction(async (tx) => {
		const session = await createImpersonationSessionTx(tx, {
			adminUserId,
			targetUserId,
			reason,
			expiresAt,
		});

		await writeAuditLogTx(tx, {
			actorId: adminUserId,
			action: IMPERSONATION_START_ACTION,
			entityType: IMPERSONATION_ENTITY,
			entityId: session.id,
			metadata: {
				targetUserId,
				targetEmail: target.email,
				reason,
				expiresAt: expiresAt.toISOString(),
			},
		});

		return {
			sessionId: session.id,
			targetUserId,
			expiresAt,
		};
	});

	// Fire-and-forget alert to other platform admins. Never blocks the action;
	// audit row is the source of truth, alert is best-effort.
	void (async () => {
		try {
			const admin = await prisma.user.findUnique({
				where: { id: adminUserId },
				select: { email: true },
			});
			await sendImpersonationStartAlert({
				adminEmail: admin?.email ?? null,
				adminUserId,
				targetEmail: target.email ?? null,
				targetUserId,
				reason,
				expiresAt,
				sessionId: result.sessionId,
			});
		} catch (err) {
			console.error('[impersonationService] Alert failed:', err);
		}
	})();

	return result;
}

/**
 * End an impersonation session.
 *
 * Idempotent — ending an already-ended session is a no-op.
 * Writes a separate (non-transactional) audit row; audit is the source of
 * truth for "what happened," the session table holds live state.
 */
export async function endImpersonation(
	sessionId: string,
	adminUserId: string | null,
	endedReason: EndedReason,
) {
	const existing = await findActiveImpersonationSession(sessionId);
	if (!existing || existing.endedAt) {
		return { ok: true as const, alreadyEnded: true };
	}

	// Ownership check: only the admin who started the session (or a system
	// caller with adminUserId=null for expiry) may end it. Prevents one
	// platform admin from terminating another's impersonation by passing a
	// known sessionId (e.g., from the audit log).
	if (adminUserId !== null && adminUserId !== existing.adminUserId) {
		throw new TRPCError({
			code: 'FORBIDDEN',
			message: 'Cannot end another admin’s impersonation session.',
		});
	}

	const result = await endImpersonationSession(sessionId, endedReason);
	if (result.count === 0) {
		return { ok: true as const, alreadyEnded: true };
	}

	await writeAuditLog({
		actorId: adminUserId ?? existing.adminUserId,
		action: IMPERSONATION_END_ACTION,
		entityType: IMPERSONATION_ENTITY,
		entityId: sessionId,
		metadata: {
			targetUserId: existing.targetUserId,
			endedReason,
			durationMs: Date.now() - existing.startedAt.getTime(),
		},
	});

	return { ok: true as const, alreadyEnded: false };
}

/**
 * Resolve the effective user for a request, given the admin's real session
 * user id and the impersonation cookie (if any).
 *
 * Returns `null` when no cookie is present or impersonation is inactive —
 * callers should then treat the admin as the acting user.
 *
 * SECURITY: if the cookie's admin binding doesn't match the caller, the
 * cookie is treated as invalid. Cookie theft cannot cross users.
 */
export async function resolveImpersonation(
	realUserId: string,
	impersonationCookieId: string | null,
): Promise<
	| {
			effective: EffectiveUser;
			shouldClearCookie: boolean;
			sessionId: string;
	  }
	| { effective: null; shouldClearCookie: boolean }
> {
	if (!impersonationCookieId) {
		return { effective: null, shouldClearCookie: false };
	}

	const session = await findActiveImpersonationSession(impersonationCookieId);

	if (!session) {
		return { effective: null, shouldClearCookie: true };
	}

	if (session.adminUserId !== realUserId) {
		// Cookie bound to a different admin — treat as invalid.
		return { effective: null, shouldClearCookie: true };
	}

	const now = new Date();
	const expired = session.expiresAt.getTime() <= now.getTime();

	if (session.endedAt || expired) {
		if (expired && !session.endedAt) {
			// Fire-and-forget — next admin request will complete the transition.
			await endImpersonation(session.id, realUserId, 'expired');
		}
		return { effective: null, shouldClearCookie: true };
	}

	return {
		effective: {
			userId: session.targetUserId,
			isImpersonation: true,
			impersonatedBy: session.adminUserId,
			impersonationSessionId: session.id,
			expiresAt: session.expiresAt,
		},
		shouldClearCookie: false,
		sessionId: session.id,
	};
}

export async function getCurrentImpersonation(sessionId: string) {
	const row = await findActiveImpersonationSession(sessionId);
	if (!row || row.endedAt) return null;
	if (row.expiresAt.getTime() <= Date.now()) return null;
	return row;
}

export async function listImpersonationHistory(options: {
	adminUserId?: string;
	targetUserId?: string;
	limit?: number;
}) {
	return getImpersonationHistory(options);
}
