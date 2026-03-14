import { describe, expect, it } from 'vitest';
import {
	type OpportunityRequirementSet,
	rankOpportunities,
	scoreOpportunity,
	type VolunteerSkillSet,
} from '../volunteer-matching';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function volunteer(skillIds: string[]): VolunteerSkillSet {
	return { skillIds };
}

function opportunity(
	id: string,
	requirements: { skill: string; level: 'REQUIRED' | 'PREFERRED' }[],
): OpportunityRequirementSet {
	return {
		opportunityId: id,
		requirements: requirements.map((r) => ({
			skillId: r.skill,
			level: r.level,
			label: r.skill,
		})),
	};
}

// ---------------------------------------------------------------------------
// scoreOpportunity
// ---------------------------------------------------------------------------

describe('scoreOpportunity', () => {
	it('returns PERFECT (100) when all required + all preferred matched', () => {
		const result = scoreOpportunity(
			volunteer(['JavaScript', 'React', 'CSS']),
			opportunity('opp-1', [
				{ skill: 'JavaScript', level: 'REQUIRED' },
				{ skill: 'React', level: 'REQUIRED' },
				{ skill: 'CSS', level: 'PREFERRED' },
			]),
		);

		expect(result.score).toBe(100);
		expect(result.matchType).toBe('PERFECT');
		expect(result.matchedRequired).toEqual(['JavaScript', 'React']);
		expect(result.missingRequired).toEqual([]);
		expect(result.matchedPreferred).toEqual(['CSS']);
	});

	it('returns PARTIAL when all required matched but some preferred missing', () => {
		const result = scoreOpportunity(
			volunteer(['JavaScript', 'React']),
			opportunity('opp-2', [
				{ skill: 'JavaScript', level: 'REQUIRED' },
				{ skill: 'React', level: 'PREFERRED' },
				{ skill: 'Node.js', level: 'PREFERRED' },
			]),
		);

		expect(result.score).toBe(75);
		expect(result.matchType).toBe('PARTIAL');
		expect(result.matchedRequired).toEqual(['JavaScript']);
		expect(result.matchedPreferred).toEqual(['React']);
	});

	it('returns NONE (0) when a required skill is missing', () => {
		const result = scoreOpportunity(
			volunteer(['CSS']),
			opportunity('opp-3', [
				{ skill: 'JavaScript', level: 'REQUIRED' },
				{ skill: 'CSS', level: 'PREFERRED' },
			]),
		);

		expect(result.score).toBe(0);
		expect(result.matchType).toBe('NONE');
		expect(result.missingRequired).toEqual(['JavaScript']);
		expect(result.matchedPreferred).toEqual(['CSS']);
	});

	it('matches skills case-insensitively', () => {
		const result = scoreOpportunity(
			volunteer(['javascript', 'REACT']),
			opportunity('opp-4', [
				{ skill: 'JavaScript', level: 'REQUIRED' },
				{ skill: 'react', level: 'REQUIRED' },
			]),
		);

		expect(result.score).toBe(100);
		expect(result.matchType).toBe('PERFECT');
	});

	it('handles whitespace in skill names', () => {
		const result = scoreOpportunity(
			volunteer([' JavaScript ', 'React']),
			opportunity('opp-5', [{ skill: 'javascript', level: 'REQUIRED' }]),
		);

		expect(result.score).toBe(100);
		expect(result.matchType).toBe('PERFECT');
	});

	it('returns PERFECT (100) when opportunity has no requirements', () => {
		const result = scoreOpportunity(
			volunteer(['JavaScript']),
			opportunity('opp-6', []),
		);

		expect(result.score).toBe(100);
		expect(result.matchType).toBe('PERFECT');
	});

	it('returns PERFECT (100) for empty skills + empty requirements', () => {
		const result = scoreOpportunity(volunteer([]), opportunity('opp-7', []));

		expect(result.score).toBe(100);
		expect(result.matchType).toBe('PERFECT');
	});

	it('returns NONE when volunteer has no skills but opportunity has required', () => {
		const result = scoreOpportunity(
			volunteer([]),
			opportunity('opp-8', [{ skill: 'JavaScript', level: 'REQUIRED' }]),
		);

		expect(result.score).toBe(0);
		expect(result.matchType).toBe('NONE');
	});

	it('scores 50 (PARTIAL) when all required met but no preferred matched', () => {
		const result = scoreOpportunity(
			volunteer(['JavaScript']),
			opportunity('opp-9', [
				{ skill: 'JavaScript', level: 'REQUIRED' },
				{ skill: 'React', level: 'PREFERRED' },
				{ skill: 'Node.js', level: 'PREFERRED' },
			]),
		);

		expect(result.score).toBe(50);
		expect(result.matchType).toBe('PARTIAL');
		expect(result.matchedPreferred).toEqual([]);
	});

	it('scores 100 when only required skills exist and all are matched', () => {
		const result = scoreOpportunity(
			volunteer(['JavaScript', 'Python']),
			opportunity('opp-10', [
				{ skill: 'JavaScript', level: 'REQUIRED' },
				{ skill: 'Python', level: 'REQUIRED' },
			]),
		);

		// No preferred → preferredRatio = 1 → 50 + 50 = 100
		expect(result.score).toBe(100);
		expect(result.matchType).toBe('PERFECT');
	});
});

// ---------------------------------------------------------------------------
// rankOpportunities
// ---------------------------------------------------------------------------

describe('rankOpportunities', () => {
	it('sorts opportunities by score descending', () => {
		const results = rankOpportunities(volunteer(['JavaScript', 'React']), [
			opportunity('low', [{ skill: 'Python', level: 'REQUIRED' }]),
			opportunity('high', [{ skill: 'JavaScript', level: 'REQUIRED' }]),
			opportunity('mid', [
				{ skill: 'JavaScript', level: 'REQUIRED' },
				{ skill: 'Python', level: 'PREFERRED' },
				{ skill: 'React', level: 'PREFERRED' },
			]),
		]);

		expect(results.map((r) => r.opportunityId)).toEqual(['high', 'mid', 'low']);
		expect(results[0].score).toBe(100);
		expect(results[1].score).toBe(75);
		expect(results[2].score).toBe(0);
	});

	it('breaks ties by opportunityId for stable sort', () => {
		const results = rankOpportunities(volunteer(['JavaScript']), [
			opportunity('bbb', [{ skill: 'JavaScript', level: 'REQUIRED' }]),
			opportunity('aaa', [{ skill: 'JavaScript', level: 'REQUIRED' }]),
		]);

		expect(results[0].opportunityId).toBe('aaa');
		expect(results[1].opportunityId).toBe('bbb');
	});

	it('returns empty array for empty opportunity list', () => {
		const results = rankOpportunities(volunteer(['JavaScript']), []);
		expect(results).toEqual([]);
	});

	it('ranks no-requirement opportunities as perfect matches', () => {
		const results = rankOpportunities(volunteer(['JavaScript']), [
			opportunity('has-req', [{ skill: 'Python', level: 'REQUIRED' }]),
			opportunity('no-req', []),
		]);

		expect(results[0].opportunityId).toBe('no-req');
		expect(results[0].score).toBe(100);
		expect(results[1].opportunityId).toBe('has-req');
		expect(results[1].score).toBe(0);
	});
});
