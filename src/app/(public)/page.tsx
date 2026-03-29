import {
	Award,
	BarChart3,
	Building2,
	CalendarDays,
	Heart,
	Search,
	Shield,
	Users,
} from 'lucide-react';
import type { Metadata } from 'next';
import { CTABanner } from '@/components/cta-banner';
import { FadeInOnScroll } from '@/components/fade-in-on-scroll';
import { JsonLdBreadcrumb } from '@/components/json-ld-breadcrumb';
import { PlatformStatsBar } from '@/components/platform-stats-bar';
import { PublicHero } from '@/components/public-hero';
import { TrackedLink } from '@/components/tracked-link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export const revalidate = 3600;

export const metadata: Metadata = {
	title: 'VolunteerReady — Trusted Infrastructure for Volunteer Engagement',
	description:
		'Screen, credential, match, and schedule volunteers with the platform that nonprofits, corporations, and volunteers trust.',
	openGraph: {
		title: 'VolunteerReady — Trusted Infrastructure for Volunteer Engagement',
		description:
			'Screen, credential, match, and schedule volunteers with the platform that nonprofits, corporations, and volunteers trust.',
		images: ['/api/og/page/home'],
	},
};

const pillars = [
	{
		icon: Search,
		heading: 'Skill-Based Matching',
		body: 'Volunteers are matched to opportunities based on verified skills, not guesswork.',
	},
	{
		icon: Shield,
		heading: 'Background Checks',
		body: 'Checkr & Sterling-powered screening with full FCRA compliance, built in — not bolted on.',
	},
	{
		icon: CalendarDays,
		heading: 'Shift Scheduling',
		body: 'Create shifts, track attendance, and manage capacity without spreadsheets.',
	},
	{
		icon: Award,
		heading: 'Portable Credentials',
		body: 'Volunteers earn verified badges that travel across every organization they serve.',
	},
	{
		icon: Users,
		heading: 'Compliance Documentation',
		body: 'Audit logs, credential records, and volunteer hour tracking — always current, always exportable. Everything you need if a funder, insurer, or regulator ever asks for proof.',
	},
	{
		icon: BarChart3,
		heading: 'ESG Reporting',
		body: 'Corporate sponsors get aggregate volunteer impact dashboards and CSV exports.',
	},
];

const differentiators = [
	{
		heading: 'Founder-led setup',
		body: 'Our founder personally onboards every organization. No ticket queue, no chatbot — a real conversation about what you need.',
	},
	{
		heading: 'Grant-ready by default',
		body: 'Volunteer hours, headcount, and credential status are always documented and exportable. No more compiling data from paper sign-in sheets the week before a funder report is due.',
	},
	{
		heading: 'Real-time platform data',
		body: 'Live stats from real organizations, not vanity numbers. Every metric you see on this site comes from production data.',
	},
];

export default async function Home() {
	return (
		<div className="flex flex-col">
			<JsonLdBreadcrumb items={[{ label: 'Home', href: '/' }]} />
			<PublicHero
				eyebrow="VolunteerReady"
				heading={
					<>
						The platform where credentials{' '}
						<em className="italic text-primary">travel with you.</em>
					</>
				}
				description="If your grant requires it, your funder expects it, or your insurer mandates it — VolunteerReady makes volunteer compliance easier. Screen volunteers, run background checks, track credentials, and document hours for funder reporting, all in one place."
				actions={
					<>
						<Button asChild size="lg" className="rounded-full px-8">
							<TrackedLink
								href="/login?callbackUrl=/app/my-applications"
								eventLabel="Start volunteering"
								eventPage="homepage"
							>
								<Heart className="h-4 w-4" />
								Start volunteering
							</TrackedLink>
						</Button>
						<Button
							asChild
							variant="outline"
							size="lg"
							className="rounded-full px-8"
						>
							<TrackedLink
								href="/login?callbackUrl=/app/onboarding"
								eventLabel="Set up your organization"
								eventPage="homepage"
							>
								Set up your organization
							</TrackedLink>
						</Button>
					</>
				}
			/>

			{/* ── Platform stats (social proof) ── */}
			<PlatformStatsBar />

			{/* ── Three-path cards ── */}
			<section className="mx-auto w-full max-w-4xl px-4 py-16">
				<h2 className="font-display mb-10 text-center text-[32px] font-bold leading-tight text-foreground [text-wrap:balance]">
					One platform, three audiences
				</h2>
				<div className="grid gap-5 sm:grid-cols-3">
					<FadeInOnScroll>
						<Card className="group relative overflow-hidden border-border/70 transition-all duration-300 hover:shadow-md hover:scale-[1.01]">
							<div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-success to-primary" />
							<CardContent className="flex flex-col gap-5 pb-7 pt-7">
								<div className="flex h-11 w-11 items-center justify-center rounded-full bg-success/15">
									<Heart className="h-5 w-5 text-success-foreground" />
								</div>
								<div className="space-y-1.5">
									<p className="font-semibold text-foreground">
										I'm a volunteer
									</p>
									<p className="text-sm leading-relaxed text-muted-foreground">
										Find opportunities matched to your skills, earn portable
										credentials, and track your entire volunteer journey.
									</p>
								</div>
								<Button
									asChild
									variant="outline"
									className="mt-auto min-h-[44px] w-full rounded-lg"
								>
									<TrackedLink
										href="/for-volunteers"
										eventLabel="Learn more — volunteer"
										eventPage="homepage"
									>
										Learn more
									</TrackedLink>
								</Button>
							</CardContent>
						</Card>
					</FadeInOnScroll>

					<FadeInOnScroll delay={75}>
						<Card className="group relative overflow-hidden border-primary/20 bg-primary text-primary-foreground transition-all duration-300 hover:shadow-md hover:scale-[1.01]">
							<CardContent className="flex flex-col gap-5 pb-7 pt-7">
								<div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15">
									<Building2 className="h-5 w-5 text-primary-foreground" />
								</div>
								<div className="space-y-1.5">
									<p className="font-semibold text-primary-foreground">
										I run a nonprofit
									</p>
									<p className="text-sm leading-relaxed text-primary-foreground/75">
										Meet your grant and insurer requirements. Screen applicants,
										run background checks, track credentials, and document
										volunteer hours — all in one place.
									</p>
								</div>
								<Button
									asChild
									className="mt-auto min-h-[44px] w-full rounded-lg bg-white text-primary hover:bg-white/90"
								>
									<TrackedLink
										href="/for-nonprofits"
										eventLabel="Learn more — nonprofit"
										eventPage="homepage"
									>
										Learn more
									</TrackedLink>
								</Button>
							</CardContent>
						</Card>
					</FadeInOnScroll>

					<FadeInOnScroll delay={150}>
						<Card className="group relative overflow-hidden border-[#C4A882]/30 bg-[#C4A882]/10 transition-all duration-300 hover:shadow-md hover:scale-[1.01]">
							<div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#C4A882] to-primary" />
							<CardContent className="flex flex-col gap-5 pb-7 pt-7">
								<div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#C4A882]/20">
									<BarChart3 className="h-5 w-5 text-[#8B7355]" />
								</div>
								<div className="space-y-1.5">
									<p className="font-semibold text-foreground">
										I manage a CSR program
									</p>
									<p className="text-sm leading-relaxed text-muted-foreground">
										Track employee volunteering, partner with nonprofits, and
										export ESG impact reports.
									</p>
								</div>
								<Button
									asChild
									variant="outline"
									className="mt-auto min-h-[44px] w-full rounded-lg"
								>
									<TrackedLink
										href="/for-employers"
										eventLabel="Learn more — employer"
										eventPage="homepage"
									>
										Learn more
									</TrackedLink>
								</Button>
							</CardContent>
						</Card>
					</FadeInOnScroll>
				</div>
			</section>

			{/* ── Platform pillars + differentiators ── */}
			<section className="bg-[#F5F4F0] px-4 py-20">
				<div className="mx-auto max-w-3xl">
					<h2 className="font-display mb-3 text-[32px] font-bold text-foreground [text-wrap:balance]">
						Built for trust, not just convenience
					</h2>
					<p className="mb-14 text-muted-foreground">
						Everything nonprofits, volunteers, and corporate sponsors need — in
						one platform.
					</p>
					<div className="space-y-10">
						{pillars.map((pillar, i) => {
							const Icon = pillar.icon;
							return (
								<FadeInOnScroll key={pillar.heading} delay={i * 75}>
									<div className="flex gap-5">
										<Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
										<div>
											<p className="mb-1 font-semibold text-foreground">
												{pillar.heading}
											</p>
											<p className="text-sm leading-relaxed text-muted-foreground">
												{pillar.body}
											</p>
										</div>
									</div>
								</FadeInOnScroll>
							);
						})}
					</div>

					{/* ── What makes us different ── */}
					<div className="mt-14">
						<h3 className="font-display mb-8 text-2xl font-bold text-foreground">
							What makes us different
						</h3>
						<div className="space-y-8">
							{differentiators.map((d, i) => (
								<FadeInOnScroll key={d.heading} delay={i * 75}>
									<div className="border-l-2 border-[#C4A882] pl-6">
										<p className="mb-1 font-semibold text-foreground">
											{d.heading}
										</p>
										<p className="text-sm leading-relaxed text-muted-foreground">
											{d.body}
										</p>
									</div>
								</FadeInOnScroll>
							))}
						</div>
					</div>
				</div>
			</section>

			<CTABanner
				icon={Heart}
				heading="Ready to get started?"
				description="Create a free account in under a minute. No credit card required."
				actions={
					<>
						<Button
							asChild
							size="lg"
							className="rounded-full bg-white px-8 text-primary hover:bg-white/90"
						>
							<TrackedLink
								href="/login?callbackUrl=/app/my-applications"
								eventLabel="Start volunteering (bottom CTA)"
								eventPage="homepage"
							>
								Start volunteering
							</TrackedLink>
						</Button>
						<Button
							asChild
							size="lg"
							variant="outline"
							className="rounded-full border-white/30 px-8 text-primary-foreground hover:bg-white/10"
						>
							<TrackedLink
								href="/login?callbackUrl=/app/onboarding"
								eventLabel="Set up org (bottom CTA)"
								eventPage="homepage"
							>
								Set up your organization
							</TrackedLink>
						</Button>
					</>
				}
			/>
		</div>
	);
}
