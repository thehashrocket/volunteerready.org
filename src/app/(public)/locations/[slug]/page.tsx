import { Check } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ComparisonTable } from '@/components/comparison-table';
import { CTABanner } from '@/components/cta-banner';
import { FaqSection } from '@/components/faq-section';
import { JsonLdBreadcrumb } from '@/components/json-ld-breadcrumb';
import { LeadCaptureForm } from '@/components/lead-capture-form';
import { LocalProofSection } from '@/components/local-proof-section';
import { LocationHero } from '@/components/location-hero';
import { Button } from '@/components/ui/button';
import { BASE_URL, FOUNDER_BOOKING_URL } from '@/lib/constants';
import { getLocation, getLocationSlugs } from '@/lib/locations';
import { LocationProviders } from '../providers';

export const dynamicParams = false;

export function generateStaticParams() {
	return getLocationSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug: string }>;
}): Promise<Metadata> {
	const { slug } = await params;
	const location = getLocation(slug);
	if (!location) return {};

	return {
		title: location.metaTitle,
		description: location.metaDescription,
		openGraph: {
			title: location.metaTitle,
			description: location.metaDescription,
			url: `${BASE_URL}/locations/${slug}`,
			images: [{ url: `${BASE_URL}/api/og/location/${slug}` }],
		},
		alternates: {
			canonical: `${BASE_URL}/locations/${slug}`,
		},
	};
}

export default async function LocationPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const location = getLocation(slug);
	if (!location) notFound();

	return (
		<LocationProviders>
			<JsonLdBreadcrumb
				items={[
					{ label: 'Home', href: '/' },
					{ label: 'Locations', href: '/locations' },
					{ label: location.name, href: `/locations/${slug}` },
				]}
			/>

			{/* 1. Hero */}
			<LocationHero
				region={location.region}
				headline={location.heroHeadline}
				description={location.heroDescription}
			/>

			{/* 2. Pain acknowledgment */}
			<section className="px-4 py-16">
				<div className="mx-auto max-w-2xl">
					<h2 className="font-display mb-6 text-2xl font-bold text-foreground">
						Sound familiar?
					</h2>
					<ul className="space-y-3">
						{location.painPoints.map((point) => (
							<li
								key={point}
								className="flex items-start gap-3 text-sm text-foreground"
							>
								<Check className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
								<span>{point}</span>
							</li>
						))}
					</ul>
				</div>
			</section>

			{/* 3. Lead capture form */}
			<Suspense>
				<LeadCaptureForm locationSlug={slug} />
			</Suspense>

			{/* 4. Comparison table */}
			<ComparisonTable items={location.comparisonItems} />

			{/* 5. Local proof (conditional) */}
			{location.localProof && <LocalProofSection {...location.localProof} />}

			{/* 6. FAQ */}
			<section className="px-4 py-16">
				<FaqSection faqs={location.faqs} />
			</section>

			{/* 7. CTA banner */}
			<CTABanner
				heading={`Be the first nonprofit in ${location.name} on VolunteerReady`}
				description="Founding organizations get white-glove onboarding, priority support, and a locked-in rate. We're looking for our first partners in your area."
				actions={
					<>
						<Button
							size="lg"
							variant="secondary"
							className="rounded-full px-8"
							asChild
						>
							<Link href="#lead-form">Get Set Up Free</Link>
						</Button>
						<Button
							size="lg"
							variant="outline"
							className="rounded-full border-white/30 bg-transparent px-8 text-white hover:bg-white/10"
							asChild
						>
							<a
								href={FOUNDER_BOOKING_URL}
								target="_blank"
								rel="noopener noreferrer"
							>
								Book a Call
							</a>
						</Button>
					</>
				}
			/>
		</LocationProviders>
	);
}
