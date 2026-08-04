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
 * The rule that keeps this honest: **a field belongs here only if a service or
 * procedure refuses on it.** Anything the pricing page wants to say about a
 * tier goes through `PLAN_FEATURES` below, which is pinned to the real gates by
 * `plan-features.guard.test.ts`. A number nobody enforces is not a limit, it is
 * a sentence.
 */
export type PlanLimits = {
	/** Enforced by `shiftTemplates.create` (`routers/shift-templates.ts`). */
	maxShiftTemplates: number | null;
	/** Enforced by `companyScopedProcedure({ minPlanTier: 'PRO' })` + the ESG routes. */
	canESGReports: boolean;
	/** Enforced by `backgroundChecks.initiate` (`planTierProcedure('PRO')`). */
	canBackgroundChecks: boolean;
};

const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
	FREE: {
		maxShiftTemplates: 0,
		canESGReports: false,
		canBackgroundChecks: false,
	},
	STARTER: {
		maxShiftTemplates: 10,
		canESGReports: false,
		canBackgroundChecks: false,
	},
	PRO: {
		maxShiftTemplates: null, // unlimited
		canESGReports: true,
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
 */
export type PlanFeature = {
	label: string;
	/** Lowest tier that can use it. `FREE` = included on every plan. */
	requiredTier: PlanTier;
	/** Optional per-tier qualifier, derived from `PLAN_LIMITS`. */
	detail?: (tier: PlanTier) => string | undefined;
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
	 */
	{ label: 'Volunteer roster CSV export', requiredTier: 'FREE' },
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
	{ label: 'ESG reporting dashboard & export', requiredTier: 'PRO' },
	{ label: 'Advanced analytics dashboard', requiredTier: 'PRO' },
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
): { label: string; included: boolean; detail?: string }[] {
	return PLAN_FEATURES.map((f) => ({
		label: f.label,
		included: isFeatureIncluded(f, tier),
		detail: isFeatureIncluded(f, tier) ? f.detail?.(tier) : undefined,
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
