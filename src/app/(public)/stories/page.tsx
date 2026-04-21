import { BookOpen, Users } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { CTABanner } from '@/components/cta-banner';
import { JsonLdBreadcrumb } from '@/components/json-ld-breadcrumb';
import { Button } from '@/components/ui/button';
import { FOUNDER_BOOKING_URL } from '@/lib/constants';
import { listConsentedOrgSummaries } from '@/server/services/caseStudyService';

export const metadata: Metadata = {
	title: 'Customer Stories — VolunteerReady',
	description:
		'See how nonprofits are transforming their volunteer programs with VolunteerReady.',
	openGraph: {
		title: 'Customer Stories — VolunteerReady',
		description:
			'Real impact from real nonprofits using VolunteerReady to manage volunteers.',
		images: [`/api/og/pages/stories`],
	},
};

export default async function StoriesIndexPage() {
	const orgs = await listConsentedOrgSummaries();

	return (
		<>
			<JsonLdBreadcrumb
				items={[
					{ label: 'Home', href: '/' },
					{ label: 'Customer Stories', href: '/stories' },
				]}
			/>

			<section className="mx-auto max-w-5xl space-y-12 px-4 py-16 sm:px-6">
				<div className="space-y-4 text-center">
					<p className="text-sm font-semibold uppercase tracking-widest text-primary">
						Customer stories
					</p>
					<h1 className="font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
						Real impact from real nonprofits
					</h1>
					<p className="mx-auto max-w-xl text-lg text-muted-foreground">
						See how organizations are transforming their volunteer programs with
						VolunteerReady.
					</p>
				</div>

				{orgs.length === 0 ? (
					<div className="flex flex-col items-center gap-4 rounded-xl border border-dashed py-20 text-center text-muted-foreground">
						<BookOpen className="h-10 w-10 opacity-40" />
						<p className="text-sm">
							Stories coming soon. Check back after our first partners share
							their results.
						</p>
					</div>
				) : (
					<ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
						{orgs.map((org) => (
							<li key={org.slug}>
								<Link
									href={`/stories/${org.slug}`}
									className="group flex h-full flex-col rounded-xl border bg-card p-6 shadow-sm transition hover:shadow-md"
								>
									<div className="mb-4 flex h-12 items-center">
										{org.logoUrl ? (
											<Image
												src={org.logoUrl}
												alt={`${org.name} logo`}
												width={120}
												height={48}
												className="max-h-12 w-auto object-contain"
											/>
										) : (
											<span className="text-lg font-semibold text-foreground">
												{org.name}
											</span>
										)}
									</div>
									{org.logoUrl && (
										<p className="mb-2 text-sm font-medium text-foreground">
											{org.name}
										</p>
									)}
									{org.applicationsSubmitted > 0 && (
										<p className="mt-auto flex items-center gap-1 text-xs text-muted-foreground">
											<Users className="h-3 w-3" />
											{org.applicationsSubmitted.toLocaleString()} volunteer
											application
											{org.applicationsSubmitted !== 1 ? 's' : ''}
										</p>
									)}
									<p className="mt-3 text-sm font-medium text-primary group-hover:underline">
										Read story →
									</p>
								</Link>
							</li>
						))}
					</ul>
				)}
			</section>

			<CTABanner
				icon={BookOpen}
				heading="Want to be featured?"
				description="Share your volunteer program results and we'll tell your story."
				actions={
					<Button asChild size="lg" variant="secondary">
						<Link
							href={FOUNDER_BOOKING_URL}
							target="_blank"
							rel="noopener noreferrer"
						>
							Book a call
						</Link>
					</Button>
				}
			/>
		</>
	);
}
