import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth';
import { resolveActiveOrgId } from '@/server/domain/active-org';
import { STAFF_CREATED_VOLUNTEERS_FLAG } from '@/server/domain/feature-flags';
import { getImpersonationContext } from '@/server/lib/impersonation-context';
import { listMembershipOrgIds } from '@/server/repositories/membershipRepo';
import { isFeatureEnabled } from '@/server/services/featureFlagService';

/**
 * Route guard for the volunteer roster.
 *
 * The sidebar already hides the nav item when the flag is off, but that is
 * cosmetic — anyone can type the URL. This closes the route independently, so
 * "is the feature off?" has exactly one answer regardless of how you arrived.
 *
 * Fails CLOSED: if impersonation resolution failed, or no org resolves, or the
 * flag is off, redirect. The one thing this must never do is fall back to the
 * real admin's org while impersonating and gate on the wrong tenant's flag.
 */
export default async function VolunteersLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const session = await getServerSession(authOptions);
	const impersonation = await getImpersonationContext();

	// MUST come before deriving effectiveUserId. On a resolution failure
	// `resolveEffectiveUserId` returns `isImpersonating: false` alongside
	// `resolutionFailed: true` (impersonation-context.ts:79-86), so the ternary
	// below would take the session branch and yield the REAL ADMIN's id — then
	// resolve the flag against the admin's own tenant mid-impersonation, which
	// is the one thing this guard must never do. CLAUDE.md requires read-then-act
	// paths to refuse rather than fall back.
	if (impersonation.resolutionFailed) redirect('/app');

	const effectiveUserId = impersonation.isImpersonating
		? impersonation.effectiveUserId
		: (session?.user?.id ?? null);

	if (!effectiveUserId) redirect('/app');

	const membershipOrgIds = await listMembershipOrgIds(effectiveUserId);
	// `orgId` is declared on Session in src/types/next-auth.d.ts — no cast needed.
	const sessionOrgId = session?.orgId ?? null;
	const orgId = resolveActiveOrgId({
		membershipOrgIds,
		sessionOrgId,
		isImpersonating: impersonation.isImpersonating,
	});

	if (!orgId) redirect('/app');

	const enabled = await isFeatureEnabled(orgId, STAFF_CREATED_VOLUNTEERS_FLAG);
	if (!enabled) redirect('/app');

	return <>{children}</>;
}
