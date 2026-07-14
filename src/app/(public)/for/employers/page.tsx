import {
	BarChart3,
	Building2,
	FileSpreadsheet,
	HandHeart,
	Shield,
	Users,
} from 'lucide-react';
import type { Metadata } from 'next';
import { CTABanner } from '@/components/cta-banner';
import { FadeInOnScroll } from '@/components/fade-in-on-scroll';
import { FaqSection } from '@/components/faq-section';
import { JsonLdBreadcrumb } from '@/components/json-ld-breadcrumb';
import { PlatformStatsBar } from '@/components/platform-stats-bar';
import { PublicHero } from '@/components/public-hero';
import { ScreenshotSection } from '@/components/screenshot-section';
import { TrackedLink } from '@/components/tracked-link';
import { Button } from '@/components/ui/button';
import { FOUNDER_BOOKING_URL } from '@/lib/constants';
import { MARKETING_SCREENSHOTS } from '@/lib/marketing-screenshots';

export const revalidate = 3600;

export const metadata: Metadata = {
	title: 'For Employers — Corporate Volunteering & ESG | VolunteerReady',
	description:
		'Track employee volunteering, partner with vetted nonprofits, and export ESG impact reports. Built for corporate CSR programs.',
	openGraph: {
		title: 'For Employers — Corporate Volunteering & ESG | VolunteerReady',
		description:
			'Track employee volunteering, partner with vetted nonprofits, and export ESG impact reports. Built for corporate CSR programs.',
		images: ['/api/og/page/for-employers'],
	},
};

const features = [
	{
		icon: BarChart3,
		heading: 'ESG reporting dashboard',
		body: 'Aggregate volunteer hours, participation rates, and impact metrics across your entire workforce. Export CSV reports for board decks, sustainability filings, and stakeholder updates.',
	},
	{
		icon: Users,
		heading: 'Employee volunteering at scale',
		body: 'Create a branded company profile. Employees discover and sign up for opportunities through the same platform nonprofits already use — no separate app, no double entry.',
	},
	{
		icon: HandHeart,
		heading: 'Nonprofit partnership management',
		body: 'Link your company to specific nonprofits on the platform. See which organizations your employees support, track cross-org impact, and deepen community relationships.',
	},
	{
		icon: Shield,
		heading: 'Background checks included',
		body: 'Checkr & Sterling-powered screening with FCRA compliance is built into the platform. Your employees get the same trusted vetting process nonprofits rely on.',
	},
	{
		icon: FileSpreadsheet,
		heading: 'CSV exports and data portability',
		body: 'Export raw data anytime — volunteer hours, credentials issued, shifts completed. Your data is yours. No lock-in, no premium export fees.',
	},
];

const differentiators = [
	{
		label: 'Not another app for employees to download',
		detail:
			'VolunteerReady is the platform nonprofits already use. Your employees join the same ecosystem — no adoption friction, no chicken-and-egg problem.',
	},
	{
		label: 'Real credentials, not self-reported hours',
		detail:
			'Volunteer hours and credentials are verified by nonprofits, not self-attested by employees. Your ESG data is audit-ready from day one.',
	},
	{
		label: 'Works for companies of any size',
		detail:
			'Whether you have 50 employees or 50,000, the platform scales. Start with a single nonprofit partnership and grow from there.',
	},
];

const employerFaqs = [
	{
		question: 'How does ESG reporting work?',
		answer:
			'VolunteerReady aggregates volunteer hours, participation rates, and impact metrics across your workforce into a dashboard. Export CSV reports anytime for board decks, sustainability filings, and stakeholder updates.',
	},
	{
		question: 'Can employees use their existing VolunteerReady accounts?',
		answer:
			'Yes. If an employee already has a VolunteerReady profile, they can link it to your company. Their existing credentials and volunteer history carry over seamlessly.',
	},
	{
		question: 'What data can I export?',
		answer:
			'Everything — volunteer hours, credentials issued, shifts completed, participation rates, and impact by nonprofit partner. CSV exports are available on Pro plans.',
	},
	{
		question: 'How do nonprofit partnerships work?',
		answer:
			'Link your company to specific nonprofits on the platform. See which organizations your employees support, track cross-org impact, and coordinate volunteer days directly.',
	},
	{
		question: 'Is there a free trial for companies?',
		answer:
			'Yes. Start with a free company profile and explore the platform. Our founder will personally walk you through the setup and help you connect with nonprofit partners.',
	},
	{
		question: 'What size companies use VolunteerReady?',
		answer:
			'Companies of all sizes — from startups with 20 employees to enterprises with thousands. The platform scales with your program, and pricing is based on features, not headcount.',
	},
];

export default async function ForEmployersPage() {
	return (
		<div className="flex flex-col">
			<JsonLdBreadcrumb
				items={[
					{ label: 'Home', href: '/' },
					{ label: 'For Employers', href: '/for/employers' },
				]}
			/>
			<PublicHero
				eyebrow="For Employers"
				heading={
					<>
						Your CSR program deserves{' '}
						<em className="italic text-primary">
							more than a spreadsheet and good intentions.
						</em>
					</>
				}
				description="Track employee volunteering, partner with vetted nonprofits, and export audit-ready ESG reports. VolunteerReady is the infrastructure your corporate social responsibility program has been missing."
				gradientClass="from-accent/10 via-background to-primary/5"
				actions={
					<>
						<Button asChild size="lg" className="rounded-full px-8">
							<TrackedLink
								href={FOUNDER_BOOKING_URL}
								eventLabel="Schedule a demo"
								eventPage="for-employers"
							>
								<Building2 className="h-4 w-4" />
								Schedule a Demo
							</TrackedLink>
						</Button>
						<Button
							asChild
							variant="outline"
							size="lg"
							className="rounded-full px-8"
						>
							<TrackedLink
								href="/pricing"
								eventLabel="See corporate pricing"
								eventPage="for-employers"
							>
								See pricing
							</TrackedLink>
						</Button>
					</>
				}
			/>

			{/* ── Platform stats ── */}
			<PlatformStatsBar />

			{/* ── Features ── */}
			<FadeInOnScroll>
				<section className="mx-auto w-full max-w-4xl px-4 py-20">
					<h2 className="font-display mb-3 text-[32px] font-bold text-foreground [text-wrap:balance]">
						Built for corporate volunteering programs
					</h2>
					<p className="mb-12 text-muted-foreground">
						From employee engagement to board-ready reporting.
					</p>
					<div className="flex flex-col gap-8">
						{features.map((f) => {
							const Icon = f.icon;
							return (
								<div key={f.heading} className="flex gap-5">
									<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/15">
										<Icon className="h-5 w-5 text-accent" />
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
				</section>
			</FadeInOnScroll>

			{/* ── Screenshot ── */}
			{/* Marker coordinates are % of the 1280×720 capture — recapture via
			    `pnpm screenshots` before adjusting (e2e/capture-scenarios.ts) */}
			<ScreenshotSection
				src={MARKETING_SCREENSHOTS.esg.src}
				alt="VolunteerReady ESG dashboard showing aggregate volunteer hours and impact metrics"
				caption="The ESG dashboard — aggregate volunteer hours, impact metrics, and export-ready reports."
				sectionBg="sand"
				containerBg="white"
				annotations={[
					{
						x: 85.6,
						y: 21.8,
						label:
							'Board-ready exports — CSV for the analysts, PDF for the deck.',
					},
					{
						x: 87.3,
						y: 54.6,
						label:
							'Aggregate employee volunteer hours across every linked nonprofit.',
					},
					{
						x: 31.1,
						y: 88.2,
						label:
							'Impact broken down per nonprofit partner — attribution without chasing spreadsheets.',
					},
				]}
			/>

			{/* ── Differentiators ── */}
			<FadeInOnScroll>
				<section className="bg-muted px-4 py-16">
					<div className="mx-auto max-w-3xl">
						<h2 className="font-display mb-10 text-[32px] font-bold text-foreground [text-wrap:balance]">
							Why VolunteerReady for corporate programs
						</h2>
						<div className="flex flex-col gap-8">
							{differentiators.map((d) => (
								<div key={d.label}>
									<p className="mb-1 text-lg font-semibold text-foreground">
										{d.label}
									</p>
									<p className="text-sm leading-relaxed text-muted-foreground">
										{d.detail}
									</p>
								</div>
							))}
						</div>
					</div>
				</section>
			</FadeInOnScroll>

			{/* ── FAQ ── */}
			<section className="px-4 py-20">
				<FaqSection faqs={employerFaqs} />
			</section>

			<CTABanner
				icon={BarChart3}
				heading="Ready to measure your impact?"
				description="Set up your company profile and start tracking employee volunteering today."
				actions={
					<>
						<Button
							asChild
							size="lg"
							className="rounded-full bg-white px-8 text-primary hover:bg-white/90"
						>
							<TrackedLink
								href={FOUNDER_BOOKING_URL}
								eventLabel="Schedule a demo (bottom CTA)"
								eventPage="for-employers"
							>
								Schedule a Demo
							</TrackedLink>
						</Button>
						<Button
							asChild
							size="lg"
							variant="outline"
							className="rounded-full border-white/30 bg-transparent px-8 text-white hover:bg-white/10"
						>
							<TrackedLink
								href="mailto:hello@volunteerready.com?subject=Corporate%20pricing"
								eventLabel="Contact sales"
								eventPage="for-employers"
							>
								Contact sales
							</TrackedLink>
						</Button>
					</>
				}
			/>
		</div>
	);
}
