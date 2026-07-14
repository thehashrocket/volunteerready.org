import type { Metadata } from 'next';
import { JsonLdBreadcrumb } from '@/components/json-ld-breadcrumb';
import { LinkRowList } from '@/components/link-row-list';
import { BASE_URL } from '@/lib/constants';
import { LOCATIONS } from '@/lib/locations';

export const metadata: Metadata = {
	title: 'Volunteer Screening by Location | VolunteerReady',
	description:
		"Find volunteer screening and management tools for nonprofits in your area. We're building local partnerships across California's Central Valley.",
	openGraph: {
		title: 'Volunteer Screening by Location | VolunteerReady',
		description:
			'Find volunteer screening and management tools for nonprofits in your area.',
		url: `${BASE_URL}/locations`,
	},
	alternates: {
		canonical: `${BASE_URL}/locations`,
	},
};

export default function LocationsIndexPage() {
	return (
		<>
			<JsonLdBreadcrumb
				items={[
					{ label: 'Home', href: '/' },
					{ label: 'Locations', href: '/locations' },
				]}
			/>

			<section className="px-4 py-16 sm:py-20">
				<div className="mx-auto max-w-3xl">
					<h1 className="font-display mb-3 text-center text-4xl font-bold text-foreground [text-wrap:balance]">
						Volunteer Screening by Location
					</h1>
					<p className="mb-12 text-center text-lg text-muted-foreground">
						We're building local partnerships across California's Central
						Valley.
					</p>

					<LinkRowList
						items={LOCATIONS.map((location) => ({
							href: `/locations/${location.slug}`,
							heading: location.name,
							description: location.summary,
						}))}
					/>
				</div>
			</section>
		</>
	);
}
