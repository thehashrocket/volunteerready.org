import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth';
import { IMPERSONATION_COOKIE } from '@/server/domain/impersonation';
import { resolveImpersonation } from '@/server/services/impersonationService';

export type ImpersonationContext = {
	realUserId: string | null;
	effectiveUserId: string | null;
	isImpersonating: boolean;
	sessionId: string | null;
	expiresAt: Date | null;
	targetUser: { id: string; email: string | null; name: string | null } | null;
	/**
	 * True when a cookie was present but resolution threw. Read-then-write
	 * consumers (a page that renders org/company data from this context, then
	 * lets the user submit a mutation based on what rendered) MUST treat this
	 * as "refuse to render any org's data" rather than falling back to the
	 * real admin's own session-derived org — otherwise the rendered form can
	 * seed a later mutation that writes to a DIFFERENT org than what's shown.
	 * Pure read-only/navigational consumers (nav, banner) may ignore it.
	 */
	resolutionFailed: boolean;
};

/** Result of resolving impersonation for a given real user + cookie value. */
export type ResolvedEffectiveUser = {
	effectiveUserId: string | null;
	isImpersonating: boolean;
	/** Real admin user id when impersonating, else null — for audit trails. */
	impersonatedBy: string | null;
	impersonationSessionId: string | null;
	expiresAt: Date | null;
	/**
	 * True only when an impersonation cookie was present but resolution threw
	 * (e.g. a transient DB error). Callers — especially on mutating/write
	 * paths — MUST treat a null `effectiveUserId` here as "refuse the
	 * request," not fall back to any other cached identity. Distinct from
	 * `isImpersonating: false`, which means impersonation legitimately isn't
	 * active (no cookie, or the session validly expired/ended).
	 */
	resolutionFailed: boolean;
};

const NOT_IMPERSONATING = {
	isImpersonating: false as const,
	impersonatedBy: null,
	impersonationSessionId: null,
	expiresAt: null,
	resolutionFailed: false as const,
};

/**
 * Pure(ish) resolver for the effective (possibly-impersonated) user id.
 * Takes the already-extracted real user id and impersonation cookie value —
 * no `getServerSession()`/`cookies()` inside — so it works identically from
 * Server Components, Route Handlers, and tRPC's context.
 *
 * Resolves to the real user (not impersonating) when there's no cookie or
 * the impersonation session has legitimately ended. Fails CLOSED — returns
 * `effectiveUserId: null` — when a cookie was present but resolution itself
 * errored, so a transient failure can't silently execute a request under
 * the wrong identity.
 */
export async function resolveEffectiveUserId(
	realUserId: string | null,
	cookieValue: string | null,
): Promise<ResolvedEffectiveUser> {
	if (!realUserId || !cookieValue) {
		return { effectiveUserId: realUserId, ...NOT_IMPERSONATING };
	}

	let resolved: Awaited<ReturnType<typeof resolveImpersonation>>;
	try {
		resolved = await resolveImpersonation(realUserId, cookieValue);
	} catch (err) {
		const { captureException } = await import('@sentry/nextjs');
		captureException(err, { tags: { source: 'IMPERSONATION_RESOLVE_FAILED' } });
		return {
			effectiveUserId: null,
			isImpersonating: false,
			impersonatedBy: null,
			impersonationSessionId: null,
			expiresAt: null,
			resolutionFailed: true,
		};
	}

	if (!resolved.effective) {
		return { effectiveUserId: realUserId, ...NOT_IMPERSONATING };
	}

	return {
		effectiveUserId: resolved.effective.userId,
		isImpersonating: true,
		impersonatedBy: resolved.effective.impersonatedBy,
		impersonationSessionId: resolved.effective.impersonationSessionId,
		expiresAt: resolved.effective.expiresAt,
		resolutionFailed: false,
	};
}

/**
 * Server-side helper for Server Components to understand impersonation
 * state. Returns the real admin user id plus the effective (target) user id
 * and basic target info for banner rendering.
 */
export async function getImpersonationContext(): Promise<ImpersonationContext> {
	const session = await getServerSession(authOptions);
	const realUserId = session?.user?.id ?? null;

	const cookieStore = await cookies();
	const cookieValue = cookieStore.get(IMPERSONATION_COOKIE)?.value ?? null;

	const resolved = await resolveEffectiveUserId(realUserId, cookieValue);

	if (!resolved.isImpersonating) {
		return {
			realUserId,
			effectiveUserId: resolved.effectiveUserId,
			isImpersonating: false,
			sessionId: null,
			expiresAt: null,
			targetUser: null,
			resolutionFailed: resolved.resolutionFailed,
		};
	}

	// Small targeted lookup for the banner.
	const { prisma } = await import('@/server/repositories/prisma');
	const target = await prisma.user.findUnique({
		where: { id: resolved.effectiveUserId as string },
		select: { id: true, email: true, name: true },
	});

	return {
		realUserId,
		effectiveUserId: resolved.effectiveUserId,
		isImpersonating: true,
		sessionId: resolved.impersonationSessionId,
		expiresAt: resolved.expiresAt,
		targetUser: target,
		resolutionFailed: false,
	};
}
