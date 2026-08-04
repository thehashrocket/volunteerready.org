import {
	ArrowRight,
	CheckCircle2,
	FileCheck,
	Lock,
	Shield,
	ShieldCheck,
	Timer,
} from 'lucide-react';
import type { Metadata } from 'next';
import type { ScreenshotAnnotation } from '@/components/annotated-screenshot';
import { CTABanner } from '@/components/cta-banner';
import { FaqSection } from '@/components/faq-section';
import { JsonLdBreadcrumb } from '@/components/json-ld-breadcrumb';
import { PublicHero } from '@/components/public-hero';
import { ScreenshotSection } from '@/components/screenshot-section';
import { SwitchCostCalculator } from '@/components/switch-cost-calculator';
import { TestimonialSection } from '@/components/testimonial-section';
import { TrackedLink } from '@/components/tracked-link';
import { Button } from '@/components/ui/button';
import { FOUNDER_BOOKING_URL } from '@/lib/constants';
import { MARKETING_SCREENSHOTS } from '@/lib/marketing-screenshots';

export const metadata: Metadata = {
	title: 'Background Checks for Nonprofits — $29/mo | VolunteerReady',
	description:
		'Automated volunteer background checks with Checkr & Sterling integration, FCRA compliance, and credential tracking. Set up free by our founder.',
	openGraph: {
		title: 'Background Checks for Nonprofits — $29/mo | VolunteerReady',
		description:
			'Automated volunteer background checks with Checkr & Sterling integration, FCRA compliance, and credential tracking.',
		images: ['/api/og/page/screening'],
	},
};

// Marker coordinates are percentages of the 1280×720 capture frame — see the
// coordinate diagram in annotated-screenshot.tsx. Recapture via
// `pnpm screenshots` before adjusting (e2e/capture-scenarios.ts).
const screenerAnnotations: ScreenshotAnnotation[] = [
	{
		x: 29,
		y: 52,
		label:
			'The default question set opens with an age gate and background-check consent — screening starts compliant, not after the fact.',
	},
	{
		x: 30,
		y: 71,
		label:
			"Question types go beyond yes/no — numeric and multiple-choice fields capture eligibility details a simple toggle can't.",
	},
	{
		x: 88,
		y: 23,
		label:
			"Add a question the moment a program's screening needs change, without opening a support ticket.",
	},
];

const features = [
	{
		icon: ShieldCheck,
		heading: 'Checkr + Sterling built in',
		body: 'Connect your Checkr or Sterling account in minutes. We handle the API integration, status tracking, and webhook processing — you just click "Run Check."',
	},
	{
		icon: FileCheck,
		heading: 'Full FCRA compliance workflow',
		body: 'Pre-adverse action notices, waiting periods, final adverse action letters — the entire legally required process, automated. No compliance gaps.',
	},
	{
		icon: Lock,
		heading: 'Encrypted token storage',
		body: 'OAuth tokens and API keys are encrypted at rest with AES-256-GCM. Key rotation supported. Your provider credentials never sit in plaintext.',
	},
	{
		icon: Timer,
		heading: 'Credential tracking and expiry',
		body: 'Background check results become portable credentials with an expiry date you set. Your credential list shows what is current and what has lapsed, and volunteers see anything expiring within 30 days on their own dashboard. They carry the credential between orgs.',
	},
];

const screeningFaqs = [
	{
		question: 'What background check providers does VolunteerReady support?',
		answer:
			'VolunteerReady integrates with Checkr and Sterling. Connect your existing account in minutes — we handle API integration, status tracking, and webhook processing.',
	},
	{
		question: 'Is the background check process FCRA compliant?',
		answer:
			'Yes. VolunteerReady automates the full FCRA compliance workflow including pre-adverse action notices, waiting periods, and final adverse action letters.',
	},
	{
		question: 'How are API keys and credentials stored?',
		answer:
			'OAuth tokens and API keys are encrypted at rest with AES-256-GCM. Key rotation is supported. Your provider credentials never sit in plaintext.',
	},
	{
		question: 'Do background check results carry between organizations?',
		answer:
			'Yes. Background check results become portable credentials that volunteers carry across every organization on the platform, with configurable expiration dates.',
	},
	{
		question: 'What does this cost?',
		answer:
			'Running background checks through VolunteerReady requires the Pro plan ($149/month), which also includes ESG reporting and the advanced analytics dashboard. There is no platform fee per check — you pay Checkr or Sterling their per-check cost directly. Setup is free either way: our founder configures your screening questions and connects your provider on a call, before you pay anything.',
	},
];

const painPoints = [
	'Manually emailing background check links to each volunteer',
	'Tracking check statuses in a spreadsheet',
	'Missing FCRA compliance steps and creating legal exposure',
	'Re-running checks when volunteers move between programs',
	'No single place showing which credentials have already lapsed',
];

export default function ScreeningPage() {
	return (
		<div className="flex flex-col">
			<JsonLdBreadcrumb
				items={[
					{ label: 'Home', href: '/' },
					{ label: 'Background Checks', href: '/screening' },
				]}
			/>
			{/* ── Hero ── */}
			<PublicHero
				eyebrow="Background Checks for Nonprofits"
				heading={
					<>
						Stop tracking background checks{' '}
						<em className="italic text-primary">in spreadsheets.</em>
					</>
				}
				description="Automated volunteer screening with Checkr & Sterling integration, FCRA-compliant workflows, and portable credentials. Set up free by our founder."
				actions={
					<>
						<Button asChild size="lg" className="rounded-full px-8">
							<TrackedLink
								href={FOUNDER_BOOKING_URL}
								eventLabel="Get set up free (hero)"
								eventPage="screening"
							>
								<ArrowRight className="h-4 w-4" />
								Get Set Up Free by Our Founder
							</TrackedLink>
						</Button>
						<Button
							asChild
							variant="outline"
							size="lg"
							className="rounded-full px-8"
						>
							<TrackedLink
								href="/how-it-works"
								eventLabel="See how it works"
								eventPage="screening"
							>
								See how it works
							</TrackedLink>
						</Button>
					</>
				}
			/>

			{/* ── Pain points ── */}
			<section className="mx-auto w-full max-w-2xl px-4 py-20">
				<h2 className="font-display mb-4 text-2xl font-bold text-foreground [text-wrap:balance]">
					Sound familiar?
				</h2>
				<ul className="space-y-3">
					{painPoints.map((point) => (
						<li key={point} className="flex gap-3">
							<CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
							<span className="text-muted-foreground">{point}</span>
						</li>
					))}
				</ul>
				<p className="mt-6 leading-relaxed text-muted-foreground">
					Every hour your staff spends on manual check coordination is an hour
					not spent on your mission. VolunteerReady automates the entire
					pipeline — from intake to credential issuance.
				</p>
			</section>

			{/* ── Features ── */}
			<section className="bg-muted px-4 py-16">
				<div className="mx-auto max-w-4xl">
					<h2 className="font-display mb-3 text-[32px] font-bold text-foreground [text-wrap:balance]">
						What you get
					</h2>
					<p className="mb-12 text-muted-foreground">
						Enterprise-grade screening tools at a price built for nonprofits.
					</p>
					<div className="flex flex-col gap-8">
						{features.map((f) => {
							const Icon = f.icon;
							return (
								<div key={f.heading} className="flex gap-5">
									<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
										<Icon className="h-5 w-5 text-primary" />
									</div>
									<div>
										<p className="mb-1 text-lg font-semibold text-foreground">
											{f.heading}
										</p>
										<p className="text-sm leading-relaxed text-muted-foreground">
											{f.body}
										</p>
									</div>
								</div>
							);
						})}
					</div>
				</div>
			</section>

			{/* ── Screenshot ── */}
			<ScreenshotSection
				src={MARKETING_SCREENSHOTS.screener.src}
				darkSrc={MARKETING_SCREENSHOTS.screener.darkSrc}
				alt="VolunteerReady screener questions builder showing the default screening questions, toggles, and consent step"
				caption="Every opportunity's screening questions — age gate, background-check consent, and anything role-specific — configured in one screen."
				sectionBg="white"
				containerBg="sand"
				annotations={screenerAnnotations}
			/>

			{/* ── Switch Cost Calculator ── */}
			<section className="mx-auto w-full max-w-xl px-4 py-20">
				<h2 className="font-display mb-2 text-[32px] font-bold text-foreground [text-wrap:balance]">
					What's it really costing you?
				</h2>
				<p className="mb-8 text-muted-foreground">
					Drag the sliders to see how much your organization spends on manual
					volunteer management.
				</p>
				<SwitchCostCalculator />
			</section>

			{/* ── Social proof (live testimonials from consented orgs) ── */}
			<TestimonialSection />

			{/* ── FAQ ── */}
			<section className="px-4 py-20">
				<FaqSection faqs={screeningFaqs} />
			</section>

			{/* ── CTA ── */}
			<CTABanner
				icon={Shield}
				heading="Ready to automate your background checks?"
				description="Our founder will personally set up your account — free. No contract, no credit card."
				actions={
					<Button
						asChild
						size="lg"
						className="rounded-full bg-white px-8 text-primary hover:bg-white/90"
					>
						<TrackedLink
							href={FOUNDER_BOOKING_URL}
							eventLabel="Get set up free (bottom CTA)"
							eventPage="screening"
						>
							Get Set Up Free by Our Founder
						</TrackedLink>
					</Button>
				}
			/>
		</div>
	);
}
