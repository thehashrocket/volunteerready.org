// ---------------------------------------------------------------------------
// Volunteer ↔ Opportunity Matching — Pure Domain Logic
// ---------------------------------------------------------------------------
// Zero framework imports. All functions are pure and side-effect free.
// ---------------------------------------------------------------------------

import type { AvailabilityType, CredentialType } from './volunteer-profile';

/** Additive tiebreaker bonus awarded per context signal (availability or credential match). */
const CONTEXT_BONUS = 5;

/** A volunteer's canonical skill ID set, with optional context signals. */
export interface VolunteerSkillSet {
	skillIds: string[];
	/** VERIFIED credential types the volunteer holds (for bonus scoring). */
	verifiedCredentialTypes?: CredentialType[];
	/** Volunteer's stated availability preference (for alignment bonus). */
	availability?: AvailabilityType | null;
}

/** A single requirement on the demand side. */
export interface OpportunityRequirement {
	/** Set for specific-skill requirements. */
	skillId?: string;
	/** Set for family-level requirements. All child skill IDs for matching. */
	familyId?: string;
	/** Populated by the service layer for family requirements. */
	familySkillIds?: string[];
	level: 'REQUIRED' | 'PREFERRED';
	/** Human-readable label: skill name or family name. */
	label: string;
}

/** An opportunity's requirements (demand side). */
export interface OpportunityRequirementSet {
	opportunityId: string;
	requirements: OpportunityRequirement[];
	/**
	 * Credential types that are preferred for this opportunity.
	 * Each VERIFIED match adds a +5 bonus (up to the cap).
	 */
	preferredCredentialTypes?: CredentialType[];
	/**
	 * The shift schedule pattern — used for availability alignment.
	 * Populated by the service layer from the opportunity's shifts.
	 */
	shiftSchedule?: 'WEEKDAYS' | 'WEEKENDS' | 'EVENINGS' | null;
}

export type MatchType = 'PERFECT' | 'PARTIAL' | 'NONE';

/** Result of scoring one opportunity against a volunteer's skills. */
export interface MatchResult {
	opportunityId: string;
	/** 0–100 inclusive */
	score: number;
	matchType: MatchType;
	/** Labels of matched required requirements. */
	matchedRequired: string[];
	/** Labels of missing required requirements. */
	missingRequired: string[];
	/** Labels of matched preferred requirements. */
	matchedPreferred: string[];
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

function requirementMatched(
	req: OpportunityRequirement,
	volunteerSet: Set<string>,
): boolean {
	if (req.skillId) {
		return volunteerSet.has(req.skillId);
	}
	if (req.familySkillIds && req.familySkillIds.length > 0) {
		return req.familySkillIds.some((id) => volunteerSet.has(id));
	}
	return false;
}

/**
 * Score a single opportunity against the volunteer's skill set.
 *
 * Algorithm (MVP):
 *   - If opportunity has no requirements → score 100, PERFECT
 *   - If any REQUIRED skill/family is missing → score 0, NONE
 *   - Otherwise base 50 + up to 50 bonus for PREFERRED matches
 *   - PERFECT = all required + all preferred matched
 *   - PARTIAL = all required, some preferred missing
 */
export function scoreOpportunity(
	volunteer: VolunteerSkillSet,
	opportunity: OpportunityRequirementSet,
): MatchResult {
	const volunteerSet = new Set(volunteer.skillIds);
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
		if (requirementMatched(r, volunteerSet)) {
			matchedRequired.push(r.label);
		} else {
			missingRequired.push(r.label);
		}
	}

	const matchedPreferred: string[] = [];
	for (const p of preferred) {
		if (requirementMatched(p, volunteerSet)) {
			matchedPreferred.push(p.label);
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

	// Base 50 for meeting all required, up to 50 more for preferred skills.
	// This preserves existing scoring behavior.
	const skillScore = Math.round(50 + preferredRatio * 50);

	// Context bonuses (availability +5, credential match +5) act as tiebreakers.
	// They do NOT affect matchType — PERFECT is determined by skill matching only.
	const availabilityBonus = computeAvailabilityBonus(
		volunteer.availability ?? null,
		opportunity.shiftSchedule ?? null,
	);
	const credentialBonus = computeCredentialBonus(
		volunteer.verifiedCredentialTypes ?? [],
		opportunity.preferredCredentialTypes ?? [],
	);

	const score = Math.min(100, skillScore + availabilityBonus + credentialBonus);

	// matchType is based on skill score only, not total (bonuses don't change the match verdict)
	const matchType: MatchType = skillScore === 100 ? 'PERFECT' : 'PARTIAL';

	return {
		opportunityId: opportunity.opportunityId,
		score,
		matchType,
		matchedRequired,
		missingRequired,
		matchedPreferred,
	};
}

function computeAvailabilityBonus(
	availability: AvailabilityType | null,
	shiftSchedule: 'WEEKDAYS' | 'WEEKENDS' | 'EVENINGS' | null,
): number {
	if (!availability || !shiftSchedule) return 0;
	if (availability === 'FLEXIBLE') return CONTEXT_BONUS;
	if (availability === shiftSchedule) return CONTEXT_BONUS;
	return 0;
}

function computeCredentialBonus(
	volunteerCredentials: CredentialType[],
	preferredTypes: CredentialType[],
): number {
	if (preferredTypes.length === 0) return 0;
	const volunteerSet = new Set(volunteerCredentials);
	const hasMatch = preferredTypes.some((t) => volunteerSet.has(t));
	return hasMatch ? CONTEXT_BONUS : 0;
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
