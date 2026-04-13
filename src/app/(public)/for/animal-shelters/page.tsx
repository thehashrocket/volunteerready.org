import { Check, Heart, PawPrint, Shield } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { ComparisonTable } from '@/components/comparison-table';
import { CTABanner } from '@/components/cta-banner';
import { FadeInOnScroll } from '@/components/fade-in-on-scroll';
import { FaqSection } from '@/components/faq-section';
import { JsonLdBreadcrumb } from '@/components/json-ld-breadcrumb';
import { LeadCaptureForm } from '@/components/lead-capture-form';
import { PublicHero } from '@/components/public-hero';
import { ScreeningFlowDiagram } from '@/components/screening-flow-diagram';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { BASE_URL, FOUNDER_BOOKING_URL } from '@/lib/constants';
import { ForProviders } from '../providers';

export const metadata: Metadata = {
	title: 'Volunteer Screening for Animal Shelters | VolunteerReady',
	description:
		'FCRA-compliant background checks and volunteer management built for animal shelters. Screen volunteers who work with animals, track credentials, and stay compliant — without the spreadsheet chaos.',
	openGraph: {
		title: 'Volunteer Screening for Animal Shelters | VolunteerReady',
		description:
			'FCRA-compliant background checks and volunteer management built for animal shelters.',
		url: `${BASE_URL}/for/animal-shelters`,
		images: [{ url: `${BASE_URL}/api/og/page/for-animal-shelters` }],
	},
	alternates: {
		canonical: `${BASE_URL}/for/animal-shelters`,
	},
};

const painPoints = [
	'Volunteers handle animals with bite risk — but you have no formal screening process',
	"Insurance requires background checks and you're tracking them in a spreadsheet",
	'Seasonal adoption events bring 20+ new volunteers who need onboarding fast',
	"You can't tell which volunteers have current clearances versus expired ones",
	'Grant funders ask for volunteer documentation and you scramble to compile it',
];

const comparisonItems = [
	{
		before: 'Paper applications filed in a binder behind the front desk',
		after: 'Online applications with built-in screening and auto-evaluation',
	},
	{
		before: 'Background checks tracked in a spreadsheet (or not at all)',
		after: 'Automated FCRA-compliant screening with real-time status tracking',
	},
	{
		before:
			"No way to know who's cleared for animal handling vs. front-desk only",
		after:
			'Role-based credentials: animal handling, medical, front desk, events',
	},
	{
		before:
			'Insurance renewal requires assembling screening docs from email threads',
		after: 'One-click compliance export for insurers and funders',
	},
	{
		before: 'New volunteer onboarding takes weeks of coordinator time',
		after: 'Self-service apply flow with screening built in — days, not weeks',
	},
];

const faqs = [
	{
		question: 'Do animal shelters need to run background checks on volunteers?',
		answer:
			'It depends on your state and insurance requirements. Many shelter insurance policies require background checks for volunteers who handle animals or work unsupervised. Some grants also mandate screening. Even when not legally required, background checks protect your organization, your animals, and the public.',
	},
	{
		question: 'How does VolunteerReady handle high-volume adoption events?',
		answer:
			'Volunteers apply online and screening runs automatically. For adoption events with 20+ new volunteers, coordinators can process applications in bulk rather than one email at a time. Cleared volunteers get notified automatically.',
	},
	{
		question: 'Can we screen for different volunteer roles?',
		answer:
			"Yes. Build custom screening questionnaires for each role — animal handling, medical support, front desk, foster care, events. Set different pass/fail criteria based on the role's risk level.",
	},
	{
		question: 'What does setup look like for a shelter?',
		answer:
			'Our founder personally sets up your account in under 15 minutes. We configure your screening questions, connect your background check provider (Checkr or Sterling), and import your existing volunteer list if you have one.',
	},
	{
		question: 'Is there a free plan?',
		answer:
			'Yes. The Free plan includes unlimited volunteers, custom screening questions, and basic credential tracking. Background checks and advanced features are available on paid plans starting at $29/month.',
	},
];

const shelterSuccessContent = (
	<Card
		className="mx-auto max-w-xl p-8 text-center"
		role="status"
		aria-live="polite"
	>
		<PawPrint className="mx-auto mb-4 h-8 w-8 text-success" />
		<h2 className="font-display mb-2 text-2xl font-bold text-foreground">
			You're in. Let's get your shelter set up.
		</h2>
		<p className="mb-6 text-base text-muted-foreground">
			Our founder will personally email you within 24 hours to walk through
			setup — no sales pitch, just getting your screening process running.
		</p>
		<Button variant="outline" className="rounded-full px-8" asChild>
			<a href={FOUNDER_BOOKING_URL} target="_blank" rel="noopener noreferrer">
				Skip the wait — book a call now
			</a>
		</Button>
	</Card>
);

export default function AnimalSheltersPage() {
	return (
		<ForProviders>
			<JsonLdBreadcrumb
				items={[
					{ label: 'Home', href: '/' },
					{ label: 'For', href: '/for' },
					{ label: 'Animal Shelters', href: '/for/animal-shelters' },
				]}
			/>

			{/* 1. Hero */}
			<PublicHero
				eyebrow="For Animal Shelters"
				heading={
					<>
						Your volunteers handle living creatures.{' '}
						<em className="italic text-primary">
							Screen them like it matters.
						</em>
					</>
				}
				description="Animal shelters run on volunteer labor — dog walkers, cat socializers, foster families, adoption event staff. VolunteerReady gives you the screening infrastructure to protect your animals, your organization, and the people who walk through your doors."
				actions={
					<>
						<Button asChild size="lg" className="rounded-full px-8">
							<Link href="#lead-form">
								<PawPrint className="h-4 w-4" />
								Get Set Up Free
							</Link>
						</Button>
						<Button
							asChild
							variant="outline"
							size="lg"
							className="rounded-full px-8"
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

			{/* 2. Pain acknowledgment */}
			<section className="bg-muted px-4 py-14">
				<div className="mx-auto max-w-2xl">
					<h2 className="font-display mb-4 text-2xl font-bold text-foreground [text-wrap:balance]">
						Sound familiar?
					</h2>
					<ul className="space-y-3">
						{painPoints.map((point) => (
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

			{/* 3. Screening flow diagram */}
			<ScreeningFlowDiagram />

			{/* 4. Lead capture form */}
			<Suspense>
				<LeadCaptureForm
					locationSlug="vertical-animal-shelters"
					successContent={shelterSuccessContent}
				/>
			</Suspense>

			{/* 5. Comparison table */}
			<ComparisonTable
				items={comparisonItems}
				heading="Spreadsheets vs. VolunteerReady"
			/>

			{/* 6. Why shelters section */}
			<section className="px-4 py-16">
				<div className="mx-auto max-w-2xl">
					<FadeInOnScroll>
						<h2 className="font-display mb-6 text-center text-[32px] font-bold text-foreground [text-wrap:balance]">
							Built for shelters, not adapted from enterprise HR
						</h2>
						<div className="mt-8 grid gap-6 sm:grid-cols-3">
							<div className="text-center">
								<div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
									<Shield className="h-5 w-5 text-primary" />
								</div>
								<h3 className="mb-1 font-semibold text-foreground">
									Compliance-first
								</h3>
								<p className="text-sm text-muted-foreground">
									FCRA-compliant screening with full audit trails for insurers
									and funders.
								</p>
							</div>
							<div className="text-center">
								<div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
									<PawPrint className="h-5 w-5 text-primary" />
								</div>
								<h3 className="mb-1 font-semibold text-foreground">
									Role-aware
								</h3>
								<p className="text-sm text-muted-foreground">
									Different screening criteria for animal handlers, foster
									families, and event volunteers.
								</p>
							</div>
							<div className="text-center">
								<div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
									<Heart className="h-5 w-5 text-primary" />
								</div>
								<h3 className="mb-1 font-semibold text-foreground">
									Founder-supported
								</h3>
								<p className="text-sm text-muted-foreground">
									Our founder personally onboards every shelter. No chatbot, no
									ticket queue.
								</p>
							</div>
						</div>
					</FadeInOnScroll>
				</div>
			</section>

			{/* 7. FAQ */}
			<section className="px-4 py-16">
				<FaqSection faqs={faqs} heading="Shelter-specific questions" />
			</section>

			{/* 8. CTA banner */}
			<CTABanner
				icon={PawPrint}
				heading="Be one of our founding shelters"
				description="We're onboarding our first 5 animal shelters with white-glove setup, priority support, and a locked-in founding rate. Spots are limited."
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
		</ForProviders>
	);
}
