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
};

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

	if (!realUserId || !cookieValue) {
		return {
			realUserId,
			effectiveUserId: realUserId,
			isImpersonating: false,
			sessionId: null,
			expiresAt: null,
			targetUser: null,
		};
	}

	const resolved = await resolveImpersonation(realUserId, cookieValue);
	if (!resolved.effective) {
		return {
			realUserId,
			effectiveUserId: realUserId,
			isImpersonating: false,
			sessionId: null,
			expiresAt: null,
			targetUser: null,
		};
	}

	// Small targeted lookup for the banner.
	const { prisma } = await import('@/server/repositories/prisma');
	const target = await prisma.user.findUnique({
		where: { id: resolved.effective.userId },
		select: { id: true, email: true, name: true },
	});

	return {
		realUserId,
		effectiveUserId: resolved.effective.userId,
		isImpersonating: true,
		sessionId: resolved.effective.impersonationSessionId,
		expiresAt: resolved.effective.expiresAt,
		targetUser: target,
	};
}
