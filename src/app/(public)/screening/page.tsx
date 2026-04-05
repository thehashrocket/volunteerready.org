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
		body: 'Background check results become portable credentials. Set expiration dates. Get notified before they lapse. Volunteers carry them between orgs.',
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
];

const painPoints = [
	'Manually emailing background check links to each volunteer',
	'Tracking check statuses in a spreadsheet',
	'Missing FCRA compliance steps and creating legal exposure',
	'Re-running checks when volunteers move between programs',
	'No visibility into which credentials are about to expire',
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
				src="/marketing/screener.png"
				alt="VolunteerReady screening dashboard showing application review queue"
				caption="The screening dashboard — review applications, run checks, and track credentials in one view."
				sectionBg="white"
				containerBg="sand"
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
