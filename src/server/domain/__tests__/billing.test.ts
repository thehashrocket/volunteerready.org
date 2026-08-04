import { describe, expect, it } from 'vitest';
import {
	assertPlanAtLeast,
	getPlanFeatures,
	getPlanLimits,
	isWithinTrial,
	PLAN_FEATURES,
} from '../billing';

/**
 * These assertions used to cover `maxOpportunities`, `maxMembers` and
 * `canMatching`, and they passed for months while no service refused on any of
 * them — the test asserted the CONSTANT, never the behaviour, so it was green
 * the whole time the pricing page was advertising caps that did not exist. The
 * fields are gone (see the `PlanLimits` docstring); what remains here is
 * limited to values with an enforcement point, and the gate-to-copy
 * correspondence is pinned by `plan-features.guard.test.ts`.
 */
describe('getPlanLimits', () => {
	it('returns correct limits for FREE', () => {
		const limits = getPlanLimits('FREE');
		expect(limits.maxShiftTemplates).toBe(0);
		expect(limits.canBackgroundChecks).toBe(false);
		expect(limits.canESGReports).toBe(false);
	});

	it('returns correct limits for STARTER', () => {
		const limits = getPlanLimits('STARTER');
		expect(limits.maxShiftTemplates).toBe(10);
		expect(limits.canBackgroundChecks).toBe(false);
		expect(limits.canESGReports).toBe(false);
	});

	it('returns unlimited for PRO', () => {
		const limits = getPlanLimits('PRO');
		expect(limits.maxShiftTemplates).toBeNull();
		expect(limits.canBackgroundChecks).toBe(true);
		expect(limits.canESGReports).toBe(true);
	});
});

describe('getPlanFeatures', () => {
	it('includes every feature on PRO', () => {
		expect(getPlanFeatures('PRO').every((f) => f.included)).toBe(true);
	});

	it('gives FREE every ungated feature and nothing else', () => {
		const free = getPlanFeatures('FREE');
		for (const feature of PLAN_FEATURES) {
			const row = free.find((f) => f.label === feature.label);
			expect(row?.included).toBe(feature.requiredTier === 'FREE');
		}
	});

	/**
	 * The roster export is FREE by deliberate product decision — see the header
	 * of `domain/roster-export.ts`. The pricing table sold it as Pro-only until
	 * the v0.41 claims audit, which is the exact inverse of the promise that
	 * module exists to make, so it gets its own regression test rather than
	 * riding on the generic tier check above.
	 */
	it('ships the roster CSV export on the free plan', () => {
		const row = getPlanFeatures('FREE').find((f) =>
			f.label.includes('roster CSV'),
		);
		expect(row?.included).toBe(true);
	});

	/** Only paid rows carry a detail string, and only when the tier includes them. */
	it('suppresses per-tier detail for a feature the tier does not include', () => {
		const templates = getPlanFeatures('FREE').find((f) =>
			f.label.includes('shift templates'),
		);
		expect(templates?.included).toBe(false);
		expect(templates?.detail).toBeUndefined();
		expect(
			getPlanFeatures('STARTER').find((f) =>
				f.label.includes('shift templates'),
			)?.detail,
		).toBe('Up to 10');
	});
});

describe('assertPlanAtLeast', () => {
	it('passes when current meets required', () => {
		expect(() => assertPlanAtLeast('STARTER', 'STARTER')).not.toThrow();
		expect(() => assertPlanAtLeast('PRO', 'STARTER')).not.toThrow();
		expect(() => assertPlanAtLeast('PRO', 'FREE')).not.toThrow();
	});

	it('throws when current is below required', () => {
		expect(() => assertPlanAtLeast('FREE', 'STARTER')).toThrow();
		expect(() => assertPlanAtLeast('FREE', 'PRO')).toThrow();
		expect(() => assertPlanAtLeast('STARTER', 'PRO')).toThrow();
	});
});

describe('isWithinTrial', () => {
	it('returns false for null', () => {
		expect(isWithinTrial(null)).toBe(false);
	});

	it('returns true for future date', () => {
		const future = new Date(Date.now() + 1000 * 60 * 60);
		expect(isWithinTrial(future)).toBe(true);
	});

	it('returns false for past date', () => {
		const past = new Date(Date.now() - 1000);
		expect(isWithinTrial(past)).toBe(false);
	});
});
