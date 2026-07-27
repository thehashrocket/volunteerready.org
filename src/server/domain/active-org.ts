/**
 * Resolve the org a Server Component should act as.
 *
 * tRPC does this in `createTRPCContext` (`trpc/init.ts:77-150`), but Server
 * Components have no tRPC context, and `app/(app)/app/layout.tsx` deliberately
 * only ever counted memberships — it never had an orgId to hand anything.
 * Anything doing per-org work during SSR (feature flags, route guards) needs
 * this, and needs it to agree with tRPC or the page and its queries disagree
 * about which tenant they are.
 *
 * The rule:
 *   1. the session's active org, when the user actually still belongs to it
 *   2. otherwise the oldest membership
 *   3. otherwise null
 *
 * Step 1 is deliberately STRICTER than the two existing resolvers. Both
 * `createTRPCContext` and the NextAuth session callback assign `currentOrgId`
 * unconditionally and only derive `role` from the membership match, so a user
 * removed from their current org still resolves to that org there. Here they
 * fall through to their oldest membership instead. That divergence is
 * intentional — this value gates a feature flag and a route, and honouring a
 * membership the user no longer holds is the wrong default for an access
 * decision — but it IS a divergence, so do not assume parity.
 *
 * IMPERSONATION: `session.orgId` belongs to the REAL admin, not the person
 * being impersonated, so it must be ignored entirely in that case and the
 * target's own memberships used instead. Reading it anyway is how a page ends
 * up resolving a flag — or a tenant — against the wrong org.
 */
export function resolveActiveOrgId(input: {
	/** Org ids the effective user belongs to, oldest first. */
	membershipOrgIds: string[];
	/** `session.orgId` from NextAuth. Ignored when impersonating. */
	sessionOrgId: string | null;
	isImpersonating: boolean;
}): string | null {
	const { membershipOrgIds, sessionOrgId, isImpersonating } = input;

	if (!isImpersonating && sessionOrgId) {
		// Only honour it if the membership still exists — a user removed from an
		// org keeps a stale orgId on their session until it refreshes.
		if (membershipOrgIds.includes(sessionOrgId)) return sessionOrgId;
	}

	return membershipOrgIds[0] ?? null;
}
