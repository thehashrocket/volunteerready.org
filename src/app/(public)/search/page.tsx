import type { Metadata } from 'next';
import { GoogleCSE } from '@/components/google-cse';
import { JsonLdBreadcrumb } from '@/components/json-ld-breadcrumb';
import { PublicHero } from '@/components/public-hero';

export const metadata: Metadata = {
	title: 'Search — VolunteerReady',
	description:
		'Search VolunteerReady for volunteer opportunities, organizations, and resources.',
	openGraph: {
		title: 'Search — VolunteerReady',
		description:
			'Search VolunteerReady for volunteer opportunities, organizations, and resources.',
		images: [{ url: '/api/og/page/search', width: 1200, height: 630 }],
	},
};

export default function SearchPage() {
	return (
		<div className="flex flex-col">
			<JsonLdBreadcrumb
				items={[
					{ name: 'Home', href: '/' },
					{ name: 'Search', href: '/search' },
				]}
			/>
			<PublicHero
				eyebrow="Find What You Need"
				heading="Search VolunteerReady"
				description="Search across opportunities, organizations, and resources."
			/>
			<section className="mx-auto w-full max-w-4xl px-4 py-16">
				<GoogleCSE />
			</section>
		</div>
	);
}
