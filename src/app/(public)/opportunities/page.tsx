import type { Metadata } from 'next';
import { JsonLdBreadcrumb } from '@/components/json-ld-breadcrumb';
import { BASE_URL } from '@/lib/constants';
import {
	getThisWeekendOpportunities,
	searchMarketplaceOpportunities,
} from '@/server/repositories/publicOpportunityRepo';
import { MarketplaceListing } from './MarketplaceListing';

export const metadata: Metadata = {
	title: 'Volunteer Opportunities — VolunteerReady',
	description:
		'Browse volunteer opportunities across nonprofits. Find your perfect match by skills, location, and cause area.',
	openGraph: {
		title: 'Volunteer Opportunities — VolunteerReady',
		description:
			'Browse volunteer opportunities across nonprofits. Find your perfect match.',
		images: [`${BASE_URL}/api/og/pages/opportunities`],
	},
};

export default async function MarketplaceOpportunitiesPage() {
	const [initial, thisWeekend] = await Promise.all([
		searchMarketplaceOpportunities({ limit: 20 }),
		getThisWeekendOpportunities(),
	]);

	return (
		<>
			<JsonLdBreadcrumb
				items={[
					{ label: 'Home', href: '/' },
					{ label: 'Opportunities', href: '/opportunities' },
				]}
			/>
			<MarketplaceListing
				initialItems={initial.items}
				initialNextCursor={initial.nextCursor}
				thisWeekend={thisWeekend}
			/>
		</>
	);
}
