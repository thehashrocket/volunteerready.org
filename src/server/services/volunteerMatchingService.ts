import type {
	MatchResult,
	OpportunityRequirement,
	OpportunityRequirementSet,
} from '@/server/domain/volunteer-matching';
import {
	rankOpportunities,
	scoreOpportunity,
} from '@/server/domain/volunteer-matching';
import { writeAuditLogTx } from '@/server/repositories/auditRepo';
import { getOpportunity } from '@/server/repositories/opportunityRepo';
import { prisma } from '@/server/repositories/prisma';
import { listPublishedOpportunities } from '@/server/repositories/publicOpportunityRepo';
import { listApplicationsWithSkills } from '@/server/repositories/volunteer-applications';
import {
	getSkillsForUser,
	setSkillsForUser,
} from '@/server/repositories/volunteerSkillRepo';

/**
 * Replace a volunteer's skill list, with audit logging.
 */
export async function updateVolunteerSkills(
	userId: string,
	skillIds: string[],
) {
	await prisma.$transaction(async (tx) => {
		await setSkillsForUser(tx, userId, skillIds);
		await writeAuditLogTx(tx, {
			actorId: userId,
			action: 'VOLUNTEER_SKILLS_UPDATED',
			entityType: 'User',
			entityId: userId,
			metadata: { skillCount: skillIds.length },
		});
	});
}

/** Convert a repository requirement row to domain OpportunityRequirement. */
function toRequirement(r: {
	skillId: string | null;
	familyId: string | null;
	level: 'REQUIRED' | 'PREFERRED';
	skill: { id: string; name: string } | null;
	family: { id: string; name: string; skills: { id: string }[] } | null;
}): OpportunityRequirement {
	if (r.skillId && r.skill) {
		return {
			skillId: r.skillId,
			level: r.level,
			label: r.skill.name,
		};
	}
	if (r.familyId && r.family) {
		return {
			familyId: r.familyId,
			familySkillIds: r.family.skills.map((s) => s.id),
			level: r.level,
			label: r.family.name,
		};
	}
	// Fallback: no match possible
	return { level: r.level, label: '(unknown)' };
}

/**
 * Get published opportunities for an org, scored against a volunteer's skills.
 * Returns opportunities sorted by match quality.
 */
export async function getMatchedOpportunities(userId: string, orgSlug: string) {
	const [userSkills, listing] = await Promise.all([
		getSkillsForUser(userId),
		listPublishedOpportunities(orgSlug),
	]);

	if (!listing) return null;

	const skillIds = userSkills.map((s) => s.skillId);

	const requirementSets: OpportunityRequirementSet[] =
		listing.opportunities.map((opp) => ({
			opportunityId: opp.id,
			requirements: opp.requirements.map(toRequirement),
		}));

	const ranked = rankOpportunities({ skillIds }, requirementSets);

	// Build a lookup for match results
	const scoreMap = new Map(ranked.map((r) => [r.opportunityId, r]));

	// Merge opportunity data with match scores, sorted by score
	const scored = listing.opportunities
		.map((opp) => ({
			...opp,
			matchResult: scoreMap.get(opp.id) ?? null,
		}))
		.sort((a, b) => {
			const sa = a.matchResult?.score ?? 0;
			const sb = b.matchResult?.score ?? 0;
			return sb - sa;
		});

	return { org: listing.org, opportunities: scored };
}

/**
 * Score all applicants for an opportunity against its skill requirements.
 * Applications without a linked user return a null matchResult.
 */
export async function scoreApplicationsForOpportunity(
	orgId: string,
	opportunityId: string,
): Promise<{ applicationId: string; matchResult: MatchResult | null }[]> {
	const [opportunity, applications] = await Promise.all([
		getOpportunity(opportunityId, orgId),
		listApplicationsWithSkills(orgId, opportunityId),
	]);

	if (!opportunity) return [];

	const requirementSet: OpportunityRequirementSet = {
		opportunityId,
		requirements: opportunity.requirements.map(toRequirement),
	};

	return applications.map((app) => {
		if (!app.submittedByUserId || !app.submittedByUser) {
			return { applicationId: app.id, matchResult: null };
		}
		const skillIds = app.submittedByUser.volunteerSkills.map((s) => s.skillId);
		return {
			applicationId: app.id,
			matchResult: scoreOpportunity({ skillIds }, requirementSet),
		};
	});
}
