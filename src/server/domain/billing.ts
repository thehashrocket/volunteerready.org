import { z } from 'zod';
import type { PlanTier } from '@/prisma/generated/client';

// ---------------------------------------------------------------------------
// Plan limits — pure function, no DB, used by pricing UI and plan gates
// ---------------------------------------------------------------------------

/**
 * Plan limits — every field here MUST have an enforcement point.
 *
 * `maxOpportunities`, `maxMembers` and `canMatching` used to live here and were
 * removed in the v0.41 claims audit: nothing in the product ever read them
 * except the two pages that advertised them, so a Free org could create
 * unlimited opportunities, invite unlimited members, and use the matching
 * engine while both pricing surfaces said otherwise. Rather than retro-fit
 * caps onto orgs who signed up without them, the claims were dropped and the
 * fields with them.
 *
 * `canESGReports` went the same way, one round later and for a subtler reason:
 * **there are TWO plan ladders and this type is only the org one.**
 * `planTierProcedure` reads `Organization.planTier` (`getOrgPlanTier`), while
 * ESG reporting is gated by `companyScopedProcedure({ minPlanTier: 'PRO' })`
 * against `CompanyAccount.planTier` — a different row on a different table for
 * a different customer. So a nonprofit upgrading its ORG to Pro never gained
 * ESG reporting, and `canESGReports: true` on the PRO org tier was display-only
 * fiction that three marketing surfaces then repeated. Company-ladder features
 * are sold through the corporate band on `/pricing`, not this list.
 *
 * The rule that keeps this honest: **a field belongs here only if a service or
 * procedure refuses on it.** Anything the pricing page wants to say about a
 * tier goes through `PLAN_FEATURES` below, which is pinned to the real gates by
 * `plan-features.guard.test.ts`. A number nobody enforces is not a limit, it is
 * a sentence.
 */
export type PlanLimits = {
	/** Enforced by `shiftTemplates.create` (`routers/shift-templates.ts`). */
	maxShiftTemplates: number | null;
	/** Enforced by `backgroundChecks.initiate` (`planTierProcedure('PRO')`). */
	canBackgroundChecks: boolean;
};

const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
	FREE: {
		maxShiftTemplates: 0,
		canBackgroundChecks: false,
	},
	STARTER: {
		maxShiftTemplates: 10,
		canBackgroundChecks: false,
	},
	PRO: {
		maxShiftTemplates: null, // unlimited
		canBackgroundChecks: true,
	},
};

export function getPlanLimits(tier: PlanTier): PlanLimits {
	return PLAN_LIMITS[tier];
}

// ---------------------------------------------------------------------------
// Plan tier ordering — used by assertPlanAtLeast
// ---------------------------------------------------------------------------

const PLAN_TIER_RANK: Record<PlanTier, number> = {
	FREE: 0,
	STARTER: 1,
	PRO: 2,
};

/**
 * Throws a plain Error if `current` is below `required`.
 * Callers inside tRPC middleware must catch and re-throw as TRPCError.
 */
export function assertPlanAtLeast(current: PlanTier, required: PlanTier): void {
	if (PLAN_TIER_RANK[current] < PLAN_TIER_RANK[required]) {
		throw new Error(
			`Plan ${current} does not meet the required tier ${required}`,
		);
	}
}

// ---------------------------------------------------------------------------
// Marketed plan features — the single source for BOTH pricing surfaces
// ---------------------------------------------------------------------------

/**
 * What each plan is sold as including.
 *
 * This list exists because the pricing page used to carry TWO descriptions of
 * the same plans: tier cards derived from `getPlanLimits()`, and a hand-typed
 * `featureComparison` table underneath them. They disagreed — the table said
 * CSV export was Pro-only while `domain/roster-export.ts` deliberately ships
 * the roster export on every tier, and it omitted two features that really are
 * gated (shift templates, the analytics dashboard). Same defect the `/privacy`
 * third-party table had before a test walked the enum: a hand-maintained copy
 * of something the code defines.
 *
 * Two rules:
 *
 * 1. **`requiredTier` must name a real refusal.** `FREE` means "no gate" —
 *    every plan has it. Anything higher must correspond to a
 *    `planTierProcedure(...)` or a `minPlanTier` on a procedure/route, and
 *    `plan-features.guard.test.ts` fails if a gate exists with no row here.
 *    That check is what would have caught the two missing rows.
 * 2. **`detail` is per-tier prose, not a second source of truth.** It reads
 *    `getPlanLimits(tier)` rather than restating a number.
 * 3. **`note` covers availability that is not about the PLAN at all.** A plan
 *    row answers "which tier buys this"; it cannot express "and it is still
 *    behind a rollout flag". The roster export needed exactly that: it is free
 *    on every plan by design AND gated by `staff_created_volunteers`, which
 *    `defaultEnabled: false`, so the route 404s for any org outside the pilot.
 *    Selling it unqualified promised most orgs a capability they could not
 *    reach. `plan-features.guard.test.ts` ties the note to the flag's real
 *    default, so the qualifier disappears when the flag ships rather than
 *    lingering as the next stale claim.
 */
export type PlanFeature = {
	label: string;
	/** Lowest tier that can use it. `FREE` = included on every plan. */
	requiredTier: PlanTier;
	/** Optional per-tier qualifier, derived from `PLAN_LIMITS`. */
	detail?: (tier: PlanTier) => string | undefined;
	/**
	 * Availability caveat that is NOT about the plan (rollout flag, beta).
	 * Rendered as a footnote on every surface that lists this feature.
	 */
	note?: string;
};

export const PLAN_FEATURES: readonly PlanFeature[] = [
	{ label: 'Custom screening forms', requiredTier: 'FREE' },
	{ label: 'Shift scheduling & attendance', requiredTier: 'FREE' },
	{ label: 'Portable volunteer credentials', requiredTier: 'FREE' },
	/**
	 * Ungated on purpose. `routers/matching.ts` uses `protectedProcedure` /
	 * `staffProcedure` with no tier check, so selling this as a Starter feature
	 * (which the old table did) described a refusal that never happens.
	 */
	{ label: 'Skill-based volunteer matching', requiredTier: 'FREE' },
	/**
	 * FREE deliberately — see the header of `domain/roster-export.ts`. An org
	 * that cannot get its roster back out has not chosen to stay.
	 *
	 * The `note` is the rollout half: the volunteer roster is still behind
	 * `staff_created_volunteers` (default off), so the export route 404s for orgs
	 * outside the pilot. Drop the note when that flag defaults on — the guard
	 * test will tell you, in both directions.
	 */
	{
		label: 'Volunteer roster CSV export',
		requiredTier: 'FREE',
		note: 'Volunteer roster is rolling out; enabled per organization.',
	},
	{ label: 'Audit logging', requiredTier: 'FREE' },
	{ label: 'Role-based access control', requiredTier: 'FREE' },
	{
		label: 'Reusable shift templates',
		requiredTier: 'STARTER',
		detail: (tier) => {
			const max = getPlanLimits(tier).maxShiftTemplates;
			if (max === null) return 'Unlimited';
			return max > 0 ? `Up to ${max}` : undefined;
		},
	},
	{ label: 'FCRA-compliant background checks', requiredTier: 'PRO' },
	{ label: 'Advanced analytics dashboard', requiredTier: 'PRO' },
	/**
	 * Deliberately absent: ESG reporting. It is gated on `CompanyAccount.planTier`,
	 * not `Organization.planTier` — see the `PlanLimits` docstring. Listing it
	 * here sold nonprofits an upgrade that would not have given it to them.
	 * `plan-features.guard.test.ts` enforces the split by scope.
	 */
] as const;

/** Does `tier` include `feature`? */
export function isFeatureIncluded(
	feature: PlanFeature,
	tier: PlanTier,
): boolean {
	return PLAN_TIER_RANK[tier] >= PLAN_TIER_RANK[feature.requiredTier];
}

/** Every marketed feature, resolved for one tier. Used by both pricing surfaces. */
export function getPlanFeatures(
	tier: PlanTier,
): { label: string; included: boolean; detail?: string; note?: string }[] {
	return PLAN_FEATURES.map((f) => ({
		label: f.label,
		included: isFeatureIncluded(f, tier),
		detail: isFeatureIncluded(f, tier) ? f.detail?.(tier) : undefined,
		// The caveat travels with the row: a surface cannot list the feature and
		// silently drop the reason it might not work yet.
		note: isFeatureIncluded(f, tier) ? f.note : undefined,
	}));
}

/**
 * What moving from `from` to `to` actually buys you.
 *
 * Not the same as "features introduced at `to`", which is the shape the in-app
 * upgrade card shipped with and got wrong: a STARTER org looking at the PRO
 * card was shown only PRO-tier rows, so the one upgrade it could already
 * measure — shift templates going from `Up to 10` to `Unlimited` — silently
 * vanished from the pitch. A tier boundary is not the only place value changes;
 * a per-tier `detail` can improve without the row crossing a boundary.
 *
 * So a feature counts as gained when it becomes included, OR when it was
 * already included and its detail changes.
 */
export function getPlanUpgrade(
	from: PlanTier,
	to: PlanTier,
): { label: string; detail?: string; wasDetail?: string }[] {
	const before = new Map(getPlanFeatures(from).map((f) => [f.label, f]));
	return getPlanFeatures(to)
		.filter((f) => {
			if (!f.included) return false;
			const prior = before.get(f.label);
			if (!prior?.included) return true;
			return prior.detail !== f.detail;
		})
		.map((f) => ({
			label: f.label,
			detail: f.detail,
			wasDetail: before.get(f.label)?.included
				? before.get(f.label)?.detail
				: undefined,
		}));
}

// ---------------------------------------------------------------------------
// Trial helpers
// ---------------------------------------------------------------------------

export function isWithinTrial(trialEndsAt: Date | null): boolean {
	if (!trialEndsAt) return false;
	return trialEndsAt > new Date();
}

// ---------------------------------------------------------------------------
// Zod schemas (exported for tRPC input validation)
// ---------------------------------------------------------------------------

export const createCompanySchema = z.object({
	name: z.string().min(2).max(80),
});

export const switchCompanySchema = z.object({
	companyId: z.string().cuid(),
});

export const linkNonprofitSchema = z.object({
	orgId: z.string().cuid(),
});
