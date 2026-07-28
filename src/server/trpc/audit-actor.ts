/**
 * Who an audited action is attributed to, and who really performed it.
 *
 * Shared so the impersonation comparison exists once — getting it wrong is
 * silent. See the warning on `impersonatedBy`.
 */
export type AuditCtx = {
	session?: { user?: { id?: string | null } | null } | null;
	realUserId?: string | null;
};

/** The user the action is attributed to — the impersonated target, if any. */
export function effectiveUserId(ctx: AuditCtx): string | null {
	return ctx.session?.user?.id ?? null;
}

/**
 * The real admin behind an impersonated action, or null.
 *
 * `ctx.realUserId` is set for EVERY logged-in request, not only impersonated
 * ones, so it must be compared against the effective user before being stamped.
 * Stamping it unconditionally would mark every audit row as impersonated and make
 * `queryAuditLog`'s `impersonatedOnly` filter useless.
 */
export function impersonatedBy(ctx: AuditCtx): string | null {
	const effective = effectiveUserId(ctx);
	return ctx.realUserId && ctx.realUserId !== effective ? ctx.realUserId : null;
}
