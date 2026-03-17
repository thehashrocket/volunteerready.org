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
import { PublicHero } from '@/components/public-hero';
import { TrackedLink } from '@/components/tracked-link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getPlatformStats } from '@/server/repositories/statsRepo';

export const revalidate = 3600;

export const metadata: Metadata = {
	title: 'VolunteerReady — Trusted Infrastructure for Volunteer Engagement',
	description:
		'Screen, credential, match, and schedule volunteers with the platform that nonprofits, corporations, and volunteers trust.',
	openGraph: {
		title: 'VolunteerReady — Trusted Infrastructure for Volunteer Engagement',
		description:
			'Screen, credential, match, and schedule volunteers with the platform that nonprofits, corporations, and volunteers trust.',
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
		body: 'Checkr-powered screening with full FCRA compliance, built in — not bolted on.',
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
		heading: 'Team Management',
		body: 'Role-based access, team invitations, and audit logging for every action.',
	},
	{
		icon: BarChart3,
		heading: 'ESG Reporting',
		body: 'Corporate sponsors get aggregate volunteer impact dashboards and CSV exports.',
	},
];

function formatStat(n: number): string {
	if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
	return n.toString();
}

export default async function Home() {
	const stats = await getPlatformStats();

	const statItems = [
		{ label: 'Organizations', value: stats.orgCount },
		{ label: 'Verified Credentials', value: stats.credentialCount },
		{ label: 'Shifts Completed', value: stats.shiftCount },
		{ label: 'Volunteers', value: stats.volunteerCount },
	].filter((s) => s.value > 0);

	return (
		<div className="flex flex-col">
			<PublicHero
				eyebrow="VolunteerReady"
				heading={
					<>
						The platform where credentials{' '}
						<em className="italic text-primary">travel with you.</em>
					</>
				}
				description="Screen volunteers, issue portable credentials, run background checks, and schedule shifts — all in one place. For nonprofits, corporations, and the volunteers who power them."
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
			{statItems.length > 0 && (
				<section className="border-b border-border/40 bg-[#F5F4F0] px-4 py-10">
					<div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-8 sm:gap-16">
						{statItems.map((s) => (
							<div key={s.label} className="text-center">
								<p className="text-3xl font-bold text-primary">
									{formatStat(s.value)}
								</p>
								<p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
							</div>
						))}
					</div>
				</section>
			)}

			{/* ── Three-path cards ── */}
			<section className="mx-auto w-full max-w-4xl px-4 py-20">
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
									className="mt-auto w-full rounded-lg"
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
										Screen applicants, run background checks, schedule shifts,
										and issue credentials — all in one place.
									</p>
								</div>
								<Button
									asChild
									className="mt-auto w-full rounded-lg bg-white text-primary hover:bg-white/90"
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
									className="mt-auto w-full rounded-lg"
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

			{/* ── Platform pillars ── */}
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
