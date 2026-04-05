import {
	Award,
	Building2,
	CalendarDays,
	ClipboardList,
	Clock,
	HandHeart,
	Shield,
	Star,
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
import { Card, CardContent } from '@/components/ui/card';
import { FOUNDER_BOOKING_URL } from '@/lib/constants';

export const revalidate = 3600;

export const metadata: Metadata = {
	title: 'For Nonprofits — VolunteerReady',
	description:
		'Meet your grant and insurer requirements. Screen applicants, run FCRA-compliant background checks, track credentials, and document volunteer hours for funder reporting — all in one platform.',
	openGraph: {
		title: 'For Nonprofits — VolunteerReady',
		description:
			'Meet your grant and insurer requirements. Screen applicants, run FCRA-compliant background checks, track credentials, and document volunteer hours for funder reporting — all in one platform.',
		images: ['/api/og/page/for-nonprofits'],
	},
};

const features = [
	{
		icon: ClipboardList,
		heading: 'Smart screening with auto-pass/fail rules',
		body: 'Build custom screening questionnaires. VolunteerReady evaluates answers against your rules and surfaces qualified candidates automatically — so you spend time on the right applicants.',
	},
	{
		icon: Shield,
		heading: 'FCRA-compliant background checks',
		body: 'Checkr & Sterling-powered screening built in — not bolted on. Full adverse action workflow, encrypted tokens, and audit trails. Protect your organization and the people you serve.',
	},
	{
		icon: CalendarDays,
		heading: 'Shift scheduling and attendance',
		body: 'Create shifts, set capacity, let volunteers sign up directly. Track who showed up and mark attendance with one click. No more coordinating via group texts.',
	},
	{
		icon: Award,
		heading: 'Issue portable credentials',
		body: 'Grant verified badges for background checks, orientation, training, and ID verification. Credentials travel with volunteers across every organization on the platform.',
	},
	{
		icon: Users,
		heading: 'Audit-ready documentation',
		body: "Every approval, rejection, and credential change is logged with timestamps and attribution. If a funder, insurer, or regulator ever asks for documentation, you'll have it — instantly.",
	},
];

const outcomes = [
	{
		icon: Clock,
		heading: 'Hours saved',
		body: "Automated screening and online scheduling eliminate the back-and-forth that eats your staff's time.",
	},
	{
		icon: HandHeart,
		heading: 'Fewer no-shows',
		body: 'Qualified volunteers who went through a real screening process are more committed to showing up.',
	},
	{
		icon: Shield,
		heading: 'Grant-ready reporting',
		body: 'Volunteer hours, headcount, and credential status are always current and exportable. No more compiling from sign-in sheets the week before a funder report is due.',
	},
	{
		icon: Building2,
		heading: 'Deeper relationships',
		body: 'A clear volunteer record — applications, shifts, credentials — means you know who your most reliable people are.',
	},
];

const nonprofitFaqs = [
	{
		question: 'How long does setup take?',
		answer:
			'Most organizations are fully set up in under 15 minutes. Our founder personally walks you through the process — create your org, customize screening questions, and invite your team.',
	},
	{
		question: 'Can I customize screening questions?',
		answer:
			'Yes. Build custom questionnaires with multiple question types and auto-pass/fail rules. Tailor screening criteria to your organization\u2019s specific needs.',
	},
	{
		question: 'How do background checks work?',
		answer:
			'Connect your Checkr or Sterling account and run checks directly from the platform. We handle the full FCRA compliance workflow — pre-adverse action notices, waiting periods, and final letters.',
	},
	{
		question: 'Is there a free plan for small nonprofits?',
		answer:
			'Yes. The Free plan includes unlimited volunteers, custom screening questions, and basic credential tracking. Background checks and advanced features are available on paid plans.',
	},
	{
		question: 'How does shift scheduling work?',
		answer:
			'Create shifts with dates, times, and capacity limits. Volunteers browse and sign up directly. Track attendance with one-click check-in — no more spreadsheets or group texts.',
	},
	{
		question: 'Can volunteers apply from their phone?',
		answer:
			'Absolutely. The entire apply flow — screening form and status tracking — works on any device. Volunteers can even install VolunteerReady as a mobile app.',
	},
	{
		question:
			'Our grant requires us to track volunteer background checks and hours — does VolunteerReady help with that?',
		answer:
			'Yes — this is exactly what VolunteerReady is built for. Background check records, credential status, and volunteer hours are tracked automatically and can be exported for funder reports at any time. Your documentation is always current, not compiled at the last minute.',
	},
];

export default async function ForNonprofitsPage() {
	return (
		<div className="flex flex-col">
			<JsonLdBreadcrumb
				items={[
					{ label: 'Home', href: '/' },
					{ label: 'For Nonprofits', href: '/for-nonprofits' },
				]}
			/>
			<PublicHero
				eyebrow="For Nonprofits"
				heading={
					<>
						Your mission is too important to manage{' '}
						<em className="italic text-primary">from a spreadsheet.</em>
					</>
				}
				description="If your grant requires it, your funder expects it, or your insurer mandates it — VolunteerReady handles the screening, documentation, and reporting so you're always ready to show your work."
				actions={
					<>
						<Button asChild size="lg" className="rounded-full px-8">
							<TrackedLink
								href={FOUNDER_BOOKING_URL}
								eventLabel="See it in action"
								eventPage="for-nonprofits"
							>
								<Building2 className="h-4 w-4" />
								See It In Action — Free Setup
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
								eventPage="for-nonprofits"
							>
								See how it works
							</TrackedLink>
						</Button>
					</>
				}
			/>

			{/* ── Platform stats ── */}
			<PlatformStatsBar />

			{/* ── Pain acknowledgment ── */}
			<section className="bg-muted px-4 py-14">
				<div className="mx-auto max-w-2xl">
					<h2 className="font-display mb-4 text-2xl font-bold text-foreground [text-wrap:balance]">
						We've heard the stories
					</h2>
					<p className="leading-relaxed text-muted-foreground">
						Volunteers who sign up and never show. Application emails buried in
						a shared inbox. Staff spending half their week on coordination that
						should take minutes. New volunteers who weren't properly screened,
						creating risk for your organization and the people you serve.
					</p>
					<p className="mt-4 leading-relaxed text-muted-foreground">
						Or you have a grant that requires volunteer background checks and
						you're tracking clearances on a spreadsheet — knowing that if your
						funder ever asks for documentation, you'd be scrambling to pull it
						together.
					</p>
					<p className="mt-4 leading-relaxed text-muted-foreground">
						You didn't start a nonprofit to manage logistics. VolunteerReady
						handles it — so you can focus on the work that only you can do.
					</p>
				</div>
			</section>

			{/* ── Features ── */}
			<section className="mx-auto w-full max-w-4xl px-4 py-20">
				<h2 className="font-display mb-3 text-[32px] font-bold text-foreground [text-wrap:balance]">
					Built for the way nonprofits actually work
				</h2>
				<p className="mb-12 text-muted-foreground">
					Everything from intake to compliance — without switching tools.
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
			</section>

			{/* ── Screenshot ── */}
			<ScreenshotSection
				src="/marketing/dashboard.png"
				alt="VolunteerReady org dashboard showing real-time stats and recent applications"
				caption="Your org dashboard — real-time stats, recent applications, and quick actions."
				sectionBg="sand"
				containerBg="white"
			/>

			{/* ── Outcomes ── */}
			<section className="bg-muted px-4 py-16">
				<div className="mx-auto max-w-3xl">
					<h2 className="font-display mb-10 text-center text-[32px] font-bold text-foreground [text-wrap:balance]">
						What you get back
					</h2>
					<div className="grid gap-10 sm:grid-cols-3">
						{outcomes.map((o) => {
							const Icon = o.icon;
							return (
								<div key={o.heading}>
									<div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
										<Icon className="h-5 w-5 text-primary" />
									</div>
									<h3 className="mb-1 font-semibold text-foreground [text-wrap:balance]">
										{o.heading}
									</h3>
									<p className="text-sm leading-relaxed text-muted-foreground">
										{o.body}
									</p>
								</div>
							);
						})}
					</div>
				</div>
			</section>

			{/* ── Testimonial ── */}
			<section className="mx-auto w-full max-w-2xl px-4 py-20">
				<FadeInOnScroll>
					<Card className="border-border/70">
						<CardContent className="px-8 py-8">
							<Star className="mb-4 h-5 w-5 text-accent" />
							<blockquote className="text-lg leading-relaxed text-foreground">
								"Before VolunteerReady, our coordinator was spending 12+ hours a
								week just on intake and scheduling. Now we can focus that time
								on actually training and supporting volunteers. The smart
								screening alone saved us from placing three unqualified
								candidates in sensitive roles."
							</blockquote>
							<div className="mt-5 flex items-center gap-3">
								<div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
									TP
								</div>
								<div>
									<p className="text-sm font-semibold text-foreground">
										Teresa P.
									</p>
									<p className="text-xs text-muted-foreground">
										Executive Director · Bright Futures Community Center
									</p>
								</div>
							</div>
						</CardContent>
					</Card>
				</FadeInOnScroll>
				<p className="mt-4 text-center text-sm text-muted-foreground/60">
					More stories coming soon
				</p>
			</section>

			{/* ── FAQ ── */}
			<section className="px-4 py-16">
				<FaqSection faqs={nonprofitFaqs} />
			</section>

			<CTABanner
				icon={Building2}
				heading="Ready to build your volunteer team?"
				description="Set up your organization in minutes. No contract, no credit card required to get started."
				actions={
					<Button
						asChild
						size="lg"
						className="rounded-full bg-white px-8 text-primary hover:bg-white/90"
					>
						<TrackedLink
							href={FOUNDER_BOOKING_URL}
							eventLabel="See it in action (bottom CTA)"
							eventPage="for-nonprofits"
						>
							See It In Action — Free Setup
						</TrackedLink>
					</Button>
				}
			/>
		</div>
	);
}
