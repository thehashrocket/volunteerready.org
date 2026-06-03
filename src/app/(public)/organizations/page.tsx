import type { Metadata } from 'next';
import { JsonLdBreadcrumb } from '@/components/json-ld-breadcrumb';
import { BASE_URL } from '@/lib/constants';
import { listMarketplaceOrgs } from '@/server/repositories/publicOpportunityRepo';
import { OrgsListing } from './OrgsListing';

export const metadata: Metadata = {
	title: 'Nonprofit Organizations — VolunteerReady',
	description:
		'Discover nonprofits looking for volunteers. Browse organizations by cause, location, and verification status.',
	openGraph: {
		title: 'Nonprofit Organizations — VolunteerReady',
		description:
			'Discover nonprofits looking for volunteers on VolunteerReady.',
		images: [`${BASE_URL}/api/og/pages/organizations`],
	},
};

export default async function MarketplaceOrgsPage() {
	const initial = await listMarketplaceOrgs({ limit: 20 });

	return (
		<>
			<JsonLdBreadcrumb
				items={[
					{ label: 'Home', href: '/' },
					{ label: 'Organizations', href: '/organizations' },
				]}
			/>
			<OrgsListing
				initialItems={initial.items}
				initialNextCursor={initial.nextCursor}
			/>
		</>
	);
}
