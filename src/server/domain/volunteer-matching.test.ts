/**
 * Tests for volunteer-matching.ts — pure domain logic.
 *
 * Covers: scoreOpportunity (skill matching, availability bonus,
 * credential bonus), rankOpportunities.
 */
import { describe, expect, it } from 'vitest';
import {
	type OpportunityRequirementSet,
	rankOpportunities,
	scoreOpportunity,
	type VolunteerSkillSet,
} from './volunteer-matching';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function opp(
	id: string,
	required: string[] = [],
	preferred: string[] = [],
	extra: Partial<OpportunityRequirementSet> = {},
): OpportunityRequirementSet {
	return {
		opportunityId: id,
		requirements: [
			...required.map((skillId) => ({
				skillId,
				level: 'REQUIRED' as const,
				label: skillId,
			})),
			...preferred.map((skillId) => ({
				skillId,
				level: 'PREFERRED' as const,
				label: skillId,
			})),
		],
		...extra,
	};
}

function vol(
	skillIds: string[],
	extra: Partial<VolunteerSkillSet> = {},
): VolunteerSkillSet {
	return { skillIds, ...extra };
}

// ---------------------------------------------------------------------------
// scoreOpportunity — skill matching
// ---------------------------------------------------------------------------

describe('scoreOpportunity — skill matching', () => {
	it('returns 100 PERFECT when opportunity has no requirements', () => {
		const result = scoreOpportunity(vol(['skill-a']), opp('opp-1'));
		expect(result.score).toBe(100);
		expect(result.matchType).toBe('PERFECT');
	});

	it('returns 0 NONE when volunteer is missing a required skill', () => {
		const result = scoreOpportunity(
			vol(['skill-a']),
			opp('opp-1', ['skill-b']),
		);
		expect(result.score).toBe(0);
		expect(result.matchType).toBe('NONE');
		expect(result.missingRequired).toContain('skill-b');
	});

	it('returns 50 PARTIAL when all required met but preferred missing (skill-only)', () => {
		const result = scoreOpportunity(
			vol(['skill-a']),
			opp('opp-1', ['skill-a'], ['skill-b']),
		);
		// 50 base + 0 preferred (0%) + no context bonuses
		expect(result.score).toBe(50);
		expect(result.matchType).toBe('PARTIAL');
	});

	it('returns 100 PERFECT when all required AND preferred met (skill-only)', () => {
		const result = scoreOpportunity(
			vol(['skill-a', 'skill-b']),
			opp('opp-1', ['skill-a'], ['skill-b']),
		);
		// 50 + 50 (100% preferred) = 100
		expect(result.score).toBe(100);
		expect(result.matchType).toBe('PERFECT');
	});

	it('context bonuses act as tiebreakers on top of skill score (capped at 100)', () => {
		// All required + all preferred gives 100. Context bonuses stay capped at 100.
		const result = scoreOpportunity(
			vol(['skill-a', 'skill-b'], {
				availability: 'WEEKENDS',
				verifiedCredentialTypes: ['BACKGROUND_CHECK'],
			}),
			opp('opp-1', ['skill-a'], ['skill-b'], {
				shiftSchedule: 'WEEKENDS',
				preferredCredentialTypes: ['BACKGROUND_CHECK'],
			}),
		);
		expect(result.score).toBe(100);
		expect(result.matchType).toBe('PERFECT');
	});

	it('context bonuses push partial skill match higher (serve as tiebreakers)', () => {
		// Only required met (no preferred) → base 100 (no preferred = ratio 1)
		// With one preferred unmet: 50 + 0 = 50, plus 5+5 bonuses → 60
		const withBonus = scoreOpportunity(
			vol(['skill-a'], {
				availability: 'WEEKDAYS',
				verifiedCredentialTypes: ['BACKGROUND_CHECK'],
			}),
			opp('opp-1', ['skill-a'], ['skill-b'], {
				shiftSchedule: 'WEEKDAYS',
				preferredCredentialTypes: ['BACKGROUND_CHECK'],
			}),
		);
		const withoutBonus = scoreOpportunity(
			vol(['skill-a']),
			opp('opp-1', ['skill-a'], ['skill-b']),
		);
		expect(withBonus.score).toBe(withoutBonus.score + 10);
	});

	it('populates matchedRequired and matchedPreferred correctly', () => {
		const result = scoreOpportunity(
			vol(['skill-a', 'skill-b']),
			opp('opp-1', ['skill-a'], ['skill-b', 'skill-c']),
		);
		expect(result.matchedRequired).toContain('skill-a');
		expect(result.matchedPreferred).toContain('skill-b');
		expect(result.matchedPreferred).not.toContain('skill-c');
	});
});

// ---------------------------------------------------------------------------
// scoreOpportunity — availability bonus
// ---------------------------------------------------------------------------

describe('scoreOpportunity — availability bonus', () => {
	// Use an opp where volunteer meets required but misses a preferred — base score 50
	// so there's room for +5 bonus to be visible
	const baseOpp = opp('opp-1', ['skill-a'], ['skill-b']);
	const baseVol = vol(['skill-a']); // meets required, misses preferred → score 50

	it('adds +5 when volunteer availability matches shift schedule', () => {
		const withBonus = scoreOpportunity(
			{ ...baseVol, availability: 'WEEKDAYS' },
			{ ...baseOpp, shiftSchedule: 'WEEKDAYS' },
		);
		const without = scoreOpportunity(baseVol, baseOpp);
		expect(withBonus.score - without.score).toBe(5);
	});

	it('adds +5 when volunteer is FLEXIBLE (any schedule)', () => {
		const withBonus = scoreOpportunity(
			{ ...baseVol, availability: 'FLEXIBLE' },
			{ ...baseOpp, shiftSchedule: 'EVENINGS' },
		);
		const without = scoreOpportunity(baseVol, baseOpp);
		expect(withBonus.score - without.score).toBe(5);
	});

	it('adds 0 when availability does not match shift schedule', () => {
		const withMismatch = scoreOpportunity(
			{ ...baseVol, availability: 'WEEKDAYS' },
			{ ...baseOpp, shiftSchedule: 'EVENINGS' },
		);
		const without = scoreOpportunity(baseVol, baseOpp);
		expect(withMismatch.score).toBe(without.score);
	});

	it('adds 0 when shiftSchedule is null', () => {
		const withNull = scoreOpportunity(
			{ ...baseVol, availability: 'WEEKDAYS' },
			{ ...baseOpp, shiftSchedule: null },
		);
		const without = scoreOpportunity(baseVol, baseOpp);
		expect(withNull.score).toBe(without.score);
	});
});

// ---------------------------------------------------------------------------
// scoreOpportunity — credential bonus
// ---------------------------------------------------------------------------

describe('scoreOpportunity — credential bonus', () => {
	// Use an opp where volunteer meets required but misses a preferred — base score 50
	const baseOpp = opp('opp-1', ['skill-a'], ['skill-b']);
	const baseVol = vol(['skill-a']); // meets required, misses preferred → score 50

	it('adds +5 when volunteer has a preferred credential type', () => {
		const withBonus = scoreOpportunity(
			{ ...baseVol, verifiedCredentialTypes: ['BACKGROUND_CHECK'] },
			{ ...baseOpp, preferredCredentialTypes: ['BACKGROUND_CHECK'] },
		);
		const without = scoreOpportunity(baseVol, baseOpp);
		expect(withBonus.score - without.score).toBe(5);
	});

	it('adds 0 when volunteer lacks all preferred credential types', () => {
		const withMismatch = scoreOpportunity(
			{ ...baseVol, verifiedCredentialTypes: ['ID_VERIFIED'] },
			{ ...baseOpp, preferredCredentialTypes: ['BACKGROUND_CHECK'] },
		);
		const without = scoreOpportunity(baseVol, baseOpp);
		expect(withMismatch.score).toBe(without.score);
	});

	it('adds 0 when opportunity has no preferred credential types', () => {
		const with0 = scoreOpportunity(
			{ ...baseVol, verifiedCredentialTypes: ['BACKGROUND_CHECK'] },
			{ ...baseOpp, preferredCredentialTypes: [] },
		);
		const without = scoreOpportunity(baseVol, baseOpp);
		expect(with0.score).toBe(without.score);
	});

	it('score never exceeds 100', () => {
		// Give volunteer everything
		const result = scoreOpportunity(
			{
				...baseVol,
				availability: 'FLEXIBLE',
				verifiedCredentialTypes: ['BACKGROUND_CHECK', 'ID_VERIFIED'],
			},
			{
				opportunityId: 'opp-max',
				requirements: [],
				shiftSchedule: 'WEEKDAYS',
				preferredCredentialTypes: ['BACKGROUND_CHECK'],
			},
		);
		// No requirements → already 100; bonuses don't push above 100
		expect(result.score).toBe(100);
	});
});

// ---------------------------------------------------------------------------
// rankOpportunities
// ---------------------------------------------------------------------------

describe('rankOpportunities', () => {
	it('sorts by score descending', () => {
		const volunteer = vol(['skill-a', 'skill-b']);
		const results = rankOpportunities(volunteer, [
			opp('low', ['skill-a'], ['skill-b', 'skill-c']), // misses skill-c preferred
			opp('high', ['skill-a'], ['skill-b']), // hits all preferred
			opp('none', ['skill-z']), // missing required
		]);

		expect(results[0].opportunityId).toBe('high');
		expect(results[results.length - 1].opportunityId).toBe('none');
	});

	it('breaks score ties by opportunityId (stable sort)', () => {
		const volunteer = vol([]);
		const results = rankOpportunities(volunteer, [
			opp('zzz'),
			opp('aaa'),
			opp('mmm'),
		]);
		expect(results.map((r) => r.opportunityId)).toEqual(['aaa', 'mmm', 'zzz']);
	});

	it('returns empty array for empty opportunities', () => {
		expect(rankOpportunities(vol([]), [])).toHaveLength(0);
	});
});
