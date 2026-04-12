import { ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { JsonLdBreadcrumb } from '@/components/json-ld-breadcrumb';
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

					<div className="divide-y divide-border/40">
						{LOCATIONS.map((location, i) => (
							<Link
								key={location.slug}
								href={`/locations/${location.slug}`}
								className={`flex items-center justify-between py-4 transition-colors hover:bg-muted/50 ${
									i % 2 === 1 ? 'bg-muted/30' : ''
								}`}
							>
								<div>
									<h2 className="font-display text-xl font-bold text-foreground sm:text-2xl">
										{location.name}
									</h2>
									<p className="mt-0.5 text-sm text-muted-foreground">
										{location.heroDescription.split('.')[0]}.
									</p>
								</div>
								<ArrowRight className="h-5 w-5 shrink-0 text-primary" />
							</Link>
						))}
					</div>
				</div>
			</section>
		</>
	);
}
