/**
 * Resolve the org a Server Component should act as.
 *
 * tRPC does this in `createTRPCContext`, but Server
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
 * `createTRPCContext` and the NextAuth session callback apply the same rule
 * through `resolveOrgContext` below.
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
	return resolveOrgContext({
		currentOrgId: isImpersonating ? null : sessionOrgId,
		memberships: membershipOrgIds.map((organizationId) => ({
			organizationId,
			role: null,
		})),
	}).orgId;
}

/**
 * Resolve the org context (org and role) for a session from its saved
 * `currentOrgId` and the user's memberships. Used by both `createTRPCContext`
 * and the NextAuth session callback so the two cannot disagree.
 *
 * The saved org counts only while the user is a member of it. Anything else
 * (a stale selection, or an org the session never had a membership for) falls
 * back to the oldest membership, so an org context always comes with a role.
 * `currentOrgId` is returned healed, so the org switcher marks the org
 * actually in use.
 */
export function resolveOrgContext<R>(input: {
	currentOrgId: string | null;
	/** Oldest first. */
	memberships: ReadonlyArray<{ organizationId: string; role: R }>;
}): { currentOrgId: string | null; orgId: string | null; role: R | null } {
	const { currentOrgId, memberships } = input;
	const match = currentOrgId
		? memberships.find((m) => m.organizationId === currentOrgId)
		: undefined;
	const chosen = match ?? memberships[0];
	if (!chosen) return { currentOrgId: null, orgId: null, role: null };
	return {
		currentOrgId: chosen.organizationId,
		orgId: chosen.organizationId,
		role: chosen.role,
	};
}
