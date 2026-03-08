// ---------------------------------------------------------------------------
// Volunteer ↔ Opportunity Matching — Pure Domain Logic
// ---------------------------------------------------------------------------
// Zero framework imports. All functions are pure and side-effect free.
// ---------------------------------------------------------------------------

/** A volunteer's normalized skill set. */
export interface VolunteerSkillSet {
	skills: string[];
}

/** An opportunity's requirements (demand side). */
export interface OpportunityRequirementSet {
	opportunityId: string;
	requirements: {
		skill: string;
		level: 'REQUIRED' | 'PREFERRED';
	}[];
}

export type MatchType = 'PERFECT' | 'PARTIAL' | 'NONE';

/** Result of scoring one opportunity against a volunteer's skills. */
export interface MatchResult {
	opportunityId: string;
	/** 0–100 inclusive */
	score: number;
	matchType: MatchType;
	matchedRequired: string[];
	missingRequired: string[];
	matchedPreferred: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalize(s: string): string {
	return s.trim().toLowerCase();
}

function toSet(skills: string[]): Set<string> {
	return new Set(skills.map(normalize));
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/**
 * Score a single opportunity against the volunteer's skill set.
 *
 * Algorithm (MVP):
 *   - If opportunity has no requirements → score 100, PERFECT
 *   - If any REQUIRED skill is missing   → score 0, NONE
 *   - Otherwise base 50 + up to 50 bonus for PREFERRED matches
 *   - PERFECT = all required + all preferred matched
 *   - PARTIAL = all required, some preferred missing
 */
export function scoreOpportunity(
	volunteer: VolunteerSkillSet,
	opportunity: OpportunityRequirementSet,
): MatchResult {
	const volunteerSet = toSet(volunteer.skills);
	const required = opportunity.requirements.filter(
		(r) => r.level === 'REQUIRED',
	);
	const preferred = opportunity.requirements.filter(
		(r) => r.level === 'PREFERRED',
	);

	// Classify each requirement
	const matchedRequired: string[] = [];
	const missingRequired: string[] = [];
	for (const r of required) {
		if (volunteerSet.has(normalize(r.skill))) {
			matchedRequired.push(r.skill);
		} else {
			missingRequired.push(r.skill);
		}
	}

	const matchedPreferred: string[] = [];
	for (const p of preferred) {
		if (volunteerSet.has(normalize(p.skill))) {
			matchedPreferred.push(p.skill);
		}
	}

	// No requirements at all → automatic perfect match
	if (required.length === 0 && preferred.length === 0) {
		return {
			opportunityId: opportunity.opportunityId,
			score: 100,
			matchType: 'PERFECT',
			matchedRequired: [],
			missingRequired: [],
			matchedPreferred: [],
		};
	}

	// Missing any required skill → NONE
	if (missingRequired.length > 0) {
		return {
			opportunityId: opportunity.opportunityId,
			score: 0,
			matchType: 'NONE',
			matchedRequired,
			missingRequired,
			matchedPreferred,
		};
	}

	// All required met — calculate preferred bonus
	const preferredRatio =
		preferred.length > 0 ? matchedPreferred.length / preferred.length : 1;

	// Base 50 for meeting all required, up to 50 more for preferred
	const score = Math.round(50 + preferredRatio * 50);

	const matchType: MatchType = score === 100 ? 'PERFECT' : 'PARTIAL';

	return {
		opportunityId: opportunity.opportunityId,
		score,
		matchType,
		matchedRequired,
		missingRequired,
		matchedPreferred,
	};
}

/**
 * Score and rank multiple opportunities, sorted by score descending.
 * Ties are broken by opportunityId for stable ordering.
 */
export function rankOpportunities(
	volunteer: VolunteerSkillSet,
	opportunities: OpportunityRequirementSet[],
): MatchResult[] {
	return opportunities
		.map((opp) => scoreOpportunity(volunteer, opp))
		.sort((a, b) => {
			if (b.score !== a.score) return b.score - a.score;
			return a.opportunityId.localeCompare(b.opportunityId);
		});
}
