import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { cache } from 'react';
import { authOptions } from '@/server/auth';
import type { MatchResult } from '@/server/domain/volunteer-matching';
import { rankOpportunities } from '@/server/domain/volunteer-matching';
import { listAllPublishedOpportunities } from '@/server/repositories/publicOpportunityRepo';
import { getSkillsForUser } from '@/server/repositories/volunteerSkillRepo';
import { BrowseOpportunities } from './BrowseOpportunities';

const getOpportunities = cache(listAllPublishedOpportunities);

export const metadata: Metadata = {
	title: 'Browse Opportunities',
	description: 'Discover volunteer opportunities across all organizations.',
};

export default async function BrowsePage() {
	const opportunities = await getOpportunities();

	// Build match results for the current user
	let matchResults: Record<string, MatchResult> | undefined;
	const session = await getServerSession(authOptions);
	const userId = session?.user?.id;

	if (userId) {
		const userSkills = await getSkillsForUser(userId);
		if (userSkills.length > 0) {
			const skillIds = userSkills.map((s) => s.skillId);
			const requirementSets = opportunities.map((opp) => ({
				opportunityId: opp.id,
				requirements: opp.requirements.map((r) => ({
					skillId: r.skillId ?? undefined,
					familyId: r.familyId ?? undefined,
					familySkillIds: r.family?.skills.map((s) => s.id),
					level: r.level,
					label: r.skill?.name ?? r.family?.name ?? '',
				})),
			}));

			const ranked = rankOpportunities({ skillIds }, requirementSets);
			matchResults = Object.fromEntries(
				ranked.map((r) => [r.opportunityId, r]),
			);
		}
	}

	return (
		<BrowseOpportunities
			opportunities={opportunities}
			matchResults={matchResults}
		/>
	);
}
