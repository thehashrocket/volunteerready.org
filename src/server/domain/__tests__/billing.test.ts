import { describe, expect, it } from 'vitest';
import {
	assertPlanAtLeast,
	getPlanFeatures,
	getPlanLimits,
	getPlanUpgrade,
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
 *
 * `canESGReports` joined them a round later: ESG is gated on
 * `CompanyAccount.planTier`, so the flag on the ORG tier was never consulted by
 * anything that refuses. These very assertions are how that was confirmed —
 * they kept passing after the field lost all meaning.
 */
describe('getPlanLimits', () => {
	it('returns correct limits for FREE', () => {
		const limits = getPlanLimits('FREE');
		expect(limits.maxShiftTemplates).toBe(0);
		expect(limits.canBackgroundChecks).toBe(false);
	});

	it('returns correct limits for STARTER', () => {
		const limits = getPlanLimits('STARTER');
		expect(limits.maxShiftTemplates).toBe(10);
		expect(limits.canBackgroundChecks).toBe(false);
	});

	it('returns unlimited for PRO', () => {
		const limits = getPlanLimits('PRO');
		expect(limits.maxShiftTemplates).toBeNull();
		expect(limits.canBackgroundChecks).toBe(true);
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

	/**
	 * The `null` branch of the detail callback. STARTER covers the numeric branch
	 * and FREE covers the `0 -> undefined` branch; without this the unlimited
	 * case — the one the Pro card actually renders — was never executed.
	 */
	it('renders the unlimited branch of a per-tier detail', () => {
		expect(
			getPlanFeatures('PRO').find((f) => f.label.includes('shift templates'))
				?.detail,
		).toBe('Unlimited');
	});

	/**
	 * STARTER is the only tier that is neither the floor nor the ceiling, so it is
	 * the only one where an off-by-one in the rank comparison shows up: it must
	 * include its own tier and everything below, and exclude PRO.
	 */
	it('resolves the middle tier on both sides of the boundary', () => {
		const starter = getPlanFeatures('STARTER');
		for (const feature of PLAN_FEATURES) {
			const row = starter.find((f) => f.label === feature.label);
			expect(row?.included, `${feature.label} on STARTER`).toBe(
				feature.requiredTier === 'FREE' || feature.requiredTier === 'STARTER',
			);
		}
		expect(
			starter.some((f) => f.label.includes('background checks') && f.included),
			'STARTER must not include a PRO feature',
		).toBe(false);
	});
});

/**
 * The in-app upgrade card shipped computing "features whose requiredTier is
 * exactly this tier", which an independent review caught: a STARTER org looking
 * at PRO was shown only PRO-tier rows, so shift templates improving from
 * `Up to 10` to `Unlimited` — a real, paid-for gain — vanished from the pitch.
 */
describe('getPlanUpgrade', () => {
	it('includes a feature whose detail improves without crossing a tier', () => {
		const gained = getPlanUpgrade('STARTER', 'PRO');
		const templates = gained.find((f) => f.label.includes('shift templates'));
		expect(
			templates,
			'STARTER→PRO must still surface the shift-template increase',
		).toBeDefined();
		expect(templates?.detail).toBe('Unlimited');
		expect(templates?.wasDetail).toBe('Up to 10');
	});

	it('includes features newly unlocked by the target tier', () => {
		const labels = getPlanUpgrade('STARTER', 'PRO').map((f) => f.label);
		expect(labels).toContain('FCRA-compliant background checks');
		expect(labels).toContain('Advanced analytics dashboard');
	});

	it('excludes everything the current tier already has unchanged', () => {
		const labels = getPlanUpgrade('STARTER', 'PRO').map((f) => f.label);
		expect(labels).not.toContain('Custom screening forms');
		expect(labels).not.toContain('Volunteer roster CSV export');
	});

	it('marks a newly unlocked feature with no prior detail', () => {
		const templates = getPlanUpgrade('FREE', 'STARTER').find((f) =>
			f.label.includes('shift templates'),
		);
		expect(templates?.detail).toBe('Up to 10');
		// FREE never had it, so there is no "was" to show.
		expect(templates?.wasDetail).toBeUndefined();
	});

	it('returns nothing for a no-op upgrade', () => {
		expect(getPlanUpgrade('PRO', 'PRO')).toEqual([]);
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
