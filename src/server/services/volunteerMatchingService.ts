import type { OpportunityRequirementSet } from '@/server/domain/volunteer-matching';
import { rankOpportunities } from '@/server/domain/volunteer-matching';
import { writeAuditLogTx } from '@/server/repositories/auditRepo';
import { prisma } from '@/server/repositories/prisma';
import { listPublishedOpportunities } from '@/server/repositories/publicOpportunityRepo';
import {
	getSkillsForUser,
	setSkillsForUser,
} from '@/server/repositories/volunteerSkillRepo';

/**
 * Replace a volunteer's skill list, with audit logging.
 */
export async function updateVolunteerSkills(userId: string, skills: string[]) {
	await prisma.$transaction(async (tx) => {
		await setSkillsForUser(tx, userId, skills);
		await writeAuditLogTx(tx, {
			// Skills are cross-org; use a sentinel orgId for the audit log
			orgId: 'SYSTEM',
			actorId: userId,
			action: 'VOLUNTEER_SKILLS_UPDATED',
			entityType: 'User',
			entityId: userId,
			metadata: { skillCount: skills.length },
		});
	});
}

/**
 * Get published opportunities for an org, scored against a volunteer's skills.
 * Returns opportunities sorted by match quality.
 */
export async function getMatchedOpportunities(userId: string, orgSlug: string) {
	const [skills, listing] = await Promise.all([
		getSkillsForUser(userId),
		listPublishedOpportunities(orgSlug),
	]);

	if (!listing) return null;

	const requirementSets: OpportunityRequirementSet[] =
		listing.opportunities.map((opp) => ({
			opportunityId: opp.id,
			requirements: opp.requirements.map((r) => ({
				skill: r.skill,
				level: r.level,
			})),
		}));

	const ranked = rankOpportunities({ skills }, requirementSets);

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
