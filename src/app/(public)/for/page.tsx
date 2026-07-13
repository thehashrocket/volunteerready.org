import { ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { JsonLdBreadcrumb } from '@/components/json-ld-breadcrumb';
import { PublicHero } from '@/components/public-hero';
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
		label: 'Nonprofits',
		description:
			'Screen applicants, run background checks, track credentials, and document volunteer hours for funder reporting.',
		href: '/for/nonprofits',
	},
	{
		label: 'Volunteers',
		description:
			'Find opportunities, earn portable credentials, and build a verified service record that travels with you.',
		href: '/for/volunteers',
	},
	{
		label: 'Employers',
		description:
			'Track employee volunteering, measure ESG impact, and support community engagement programs.',
		href: '/for/employers',
	},
	{
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
				<div className="mx-auto max-w-3xl">
					<div className="divide-y divide-border/40">
						{audiences.map((a, i) => (
							<Link
								key={a.href}
								href={a.href}
								className={`flex items-center justify-between py-4 transition-colors hover:bg-muted/50 ${
									i % 2 === 1 ? 'bg-muted/30' : ''
								}`}
							>
								<div>
									<h2 className="font-display text-xl font-bold text-foreground sm:text-2xl">
										{a.label}
									</h2>
									<p className="mt-0.5 text-sm text-muted-foreground">
										{a.description}
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
