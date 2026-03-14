import { describe, expect, it } from 'vitest';
import { assertPlanAtLeast, getPlanLimits, isWithinTrial } from '../billing';

describe('getPlanLimits', () => {
	it('returns correct limits for FREE', () => {
		const limits = getPlanLimits('FREE');
		expect(limits.maxOpportunities).toBe(3);
		expect(limits.maxMembers).toBe(3);
		expect(limits.canMatching).toBe(false);
		expect(limits.canESGReports).toBe(false);
	});

	it('returns correct limits for STARTER', () => {
		const limits = getPlanLimits('STARTER');
		expect(limits.maxOpportunities).toBe(25);
		expect(limits.canMatching).toBe(true);
		expect(limits.canESGReports).toBe(false);
	});

	it('returns unlimited for PRO', () => {
		const limits = getPlanLimits('PRO');
		expect(limits.maxOpportunities).toBeNull();
		expect(limits.maxMembers).toBeNull();
		expect(limits.canESGReports).toBe(true);
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
