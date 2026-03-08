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
		const skills = await getSkillsForUser(userId);
		if (skills.length > 0) {
			const requirementSets = result.opportunities.map((opp) => ({
				opportunityId: opp.id,
				requirements: opp.requirements.map((r) => ({
					skill: r.skill,
					level: r.level,
				})),
			}));

			const ranked = rankOpportunities({ skills }, requirementSets);
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
