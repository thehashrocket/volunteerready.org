import { Briefcase, Building2, Heart, PawPrint } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { JsonLdBreadcrumb } from '@/components/json-ld-breadcrumb';
import { PublicHero } from '@/components/public-hero';
import { Card } from '@/components/ui/card';
import { BASE_URL } from '@/lib/constants';

export const metadata: Metadata = {
	title: 'Who VolunteerReady Is For | VolunteerReady',
	description:
		'VolunteerReady serves nonprofits, volunteers, employers, and specialized verticals like animal shelters. Find the right page for your organization.',
	openGraph: {
		title: 'Who VolunteerReady Is For',
		description:
			'VolunteerReady serves nonprofits, volunteers, employers, and specialized verticals.',
		url: `${BASE_URL}/for`,
	},
	alternates: {
		canonical: `${BASE_URL}/for`,
	},
};

const audiences = [
	{
		icon: Building2,
		label: 'Nonprofits',
		description:
			'Screen applicants, run background checks, track credentials, and document volunteer hours for funder reporting.',
		href: '/for/nonprofits',
	},
	{
		icon: Heart,
		label: 'Volunteers',
		description:
			'Find opportunities, earn portable credentials, and build a verified service record that travels with you.',
		href: '/for/volunteers',
	},
	{
		icon: Briefcase,
		label: 'Employers',
		description:
			'Track employee volunteering, measure ESG impact, and support community engagement programs.',
		href: '/for/employers',
	},
	{
		icon: PawPrint,
		label: 'Animal Shelters',
		description:
			'FCRA-compliant screening for volunteers who handle animals, with role-based credentials and insurance-ready documentation.',
		href: '/for/animal-shelters',
	},
];

export default function ForIndexPage() {
	return (
		<>
			<JsonLdBreadcrumb
				items={[
					{ label: 'Home', href: '/' },
					{ label: 'For', href: '/for' },
				]}
			/>

			<PublicHero
				eyebrow="Who it's for"
				heading="Built for every part of the volunteer ecosystem"
				description="Whether you run a nonprofit, manage corporate volunteering, or want to get involved — VolunteerReady has a place for you."
			/>

			<section className="px-4 py-16">
				<div className="mx-auto grid max-w-3xl gap-6 sm:grid-cols-2">
					{audiences.map((a) => {
						const Icon = a.icon;
						return (
							<Link key={a.href} href={a.href} className="group">
								<Card className="h-full p-6 transition-shadow group-hover:shadow-md">
									<div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
										<Icon className="h-5 w-5 text-primary" />
									</div>
									<h2 className="mb-2 text-lg font-semibold text-foreground">
										{a.label}
									</h2>
									<p className="text-sm leading-relaxed text-muted-foreground">
										{a.description}
									</p>
								</Card>
							</Link>
						);
					})}
				</div>
			</section>
		</>
	);
}
