/**
 * Who an audited action is attributed to, and who really performed it.
 *
 * Extracted because the same two expressions were being written a third time.
 * `routers/volunteers.ts` had them as named helpers, `routers/company.ts` has
 * the `impersonatedBy` ternary inlined at four call sites, and E1a needs both in
 * `routers/screener.ts`. Getting the second one subtly wrong is silent — see the
 * warning on `impersonatedBy` — so it should exist once.
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
 * ones (`trpc/init.ts:42`), so it must be compared against the effective user
 * before being stamped. Stamping it unconditionally would mark every audit row
 * as impersonated and make `queryAuditLog`'s `impersonatedOnly` filter useless.
 */
export function impersonatedBy(ctx: AuditCtx): string | null {
	const effective = effectiveUserId(ctx);
	return ctx.realUserId && ctx.realUserId !== effective ? ctx.realUserId : null;
}
