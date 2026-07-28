import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth';
import { resolveActiveOrgId } from '@/server/domain/active-org';
import { STAFF_CREATED_VOLUNTEERS_FLAG } from '@/server/domain/feature-flags';
import { getImpersonationContext } from '@/server/lib/impersonation-context';
import { listMembershipOrgIds } from '@/server/repositories/membershipRepo';
import { isFeatureEnabled } from '@/server/services/featureFlagService';

/**
 * Resolve `staff_created_volunteers` for the org the current request is acting
 * as, for Server Components.
 *
 * There is no client read path for feature flags, and adding one for this would
 * flash the gated surfaces in after hydration and then remove them — which T16's
 * verify step explicitly forbids. So every gated surface resolves the flag on
 * the server and passes a boolean down, or redirects.
 *
 * Two consumers with different needs: `volunteers/layout.tsx` closes its whole
 * route on `false`, and `shifts/page.tsx` renders normally but withholds the
 * assign picker. They share this so the predicate — including the
 * fail-closed rules below — has one definition. The third resolution, in
 * `app/(app)/app/layout.tsx`, deliberately stays inline: it already holds
 * `membershipOrgIds` for its own `hasOrg` guard, so routing it through here
 * would issue that query twice per request.
 *
 * SECURITY: fails CLOSED at every step.
 *
 * The `resolutionFailed` check must come FIRST. On a failure
 * `resolveEffectiveUserId` returns `isImpersonating: false` alongside
 * `resolutionFailed: true` (impersonation-context.ts:79-86), so the ternary
 * below would take the session branch and yield the REAL ADMIN's id — then
 * resolve the flag against the admin's own tenant mid-impersonation, which is
 * the one thing this must never do. CLAUDE.md requires read-then-act paths to
 * refuse rather than fall back.
 */
export async function resolveVolunteerRosterFlag(): Promise<{
	orgId: string | null;
	enabled: boolean;
}> {
	const session = await getServerSession(authOptions);
	const impersonation = await getImpersonationContext();

	if (impersonation.resolutionFailed) return { orgId: null, enabled: false };

	const effectiveUserId = impersonation.isImpersonating
		? impersonation.effectiveUserId
		: (session?.user?.id ?? null);

	if (!effectiveUserId) return { orgId: null, enabled: false };

	const membershipOrgIds = await listMembershipOrgIds(effectiveUserId);
	// `orgId` is declared on Session in src/types/next-auth.d.ts — no cast needed.
	const orgId = resolveActiveOrgId({
		membershipOrgIds,
		sessionOrgId: session?.orgId ?? null,
		isImpersonating: impersonation.isImpersonating,
	});

	if (!orgId) return { orgId: null, enabled: false };

	return {
		orgId,
		enabled: await isFeatureEnabled(orgId, STAFF_CREATED_VOLUNTEERS_FLAG),
	};
}
