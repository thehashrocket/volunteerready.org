import { z } from 'zod';
import type { PlanTier } from '@/prisma/generated/client';

// ---------------------------------------------------------------------------
// Plan limits — pure function, no DB, used by pricing UI and plan gates
// ---------------------------------------------------------------------------

export type PlanLimits = {
	maxOpportunities: number | null;
	maxMembers: number | null;
	canMatching: boolean;
	canESGReports: boolean;
	canBackgroundChecks: boolean;
};

const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
	FREE: {
		maxOpportunities: 3,
		maxMembers: 3,
		canMatching: false,
		canESGReports: false,
		canBackgroundChecks: false,
	},
	STARTER: {
		maxOpportunities: 25,
		maxMembers: 10,
		canMatching: true,
		canESGReports: false,
		canBackgroundChecks: false,
	},
	PRO: {
		maxOpportunities: null, // unlimited
		maxMembers: null, // unlimited
		canMatching: true,
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
