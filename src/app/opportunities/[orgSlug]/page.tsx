import type { Metadata } from 'next';
import { Playfair_Display } from 'next/font/google';
import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { cache } from 'react';
import { authOptions } from '@/server/auth';
import type { MatchResult } from '@/server/domain/volunteer-matching';
import { rankOpportunities } from '@/server/domain/volunteer-matching';
import { listPublishedOpportunities } from '@/server/repositories/publicOpportunityRepo';
import { getSkillsForUser } from '@/server/repositories/volunteerSkillRepo';
import { OpportunitiesListing } from './OpportunitiesListing';

// Deduplicate the DB call between generateMetadata and the page component
// within a single render pass.
const getOpportunities = cache(listPublishedOpportunities);

const playfair = Playfair_Display({
	subsets: ['latin'],
	variable: '--font-playfair',
	display: 'swap',
});

type Props = { params: Promise<{ orgSlug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { orgSlug } = await params;
	const result = await getOpportunities(orgSlug);
	if (!result) return { title: 'Not Found' };
	return {
		title: `Volunteer with ${result.org.name}`,
		description: `Browse open volunteer opportunities at ${result.org.name}.`,
	};
}

export default async function OpportunitiesPage({ params }: Props) {
	const { orgSlug } = await params;
	const result = await getOpportunities(orgSlug);

	if (!result) notFound();

	// Build match results for authenticated volunteers
	let matchResults: Record<string, MatchResult> | undefined;
	const session = await getServerSession(authOptions);
	const userId = session?.user?.id;

	if (userId) {
		const userSkills = await getSkillsForUser(userId);
		if (userSkills.length > 0) {
			const skillIds = userSkills.map((s) => s.skillId);
			const requirementSets = result.opportunities.map((opp) => ({
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

	// The outer div injects --font-playfair CSS variable into the subtree for use via style prop.
	return (
		<div className={playfair.variable}>
			<OpportunitiesListing
				org={result.org}
				opportunities={result.opportunities}
				matchResults={matchResults}
			/>
		</div>
	);
}
