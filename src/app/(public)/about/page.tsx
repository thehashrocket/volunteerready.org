import { Heart, Shield, TrendingUp, Zap } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import { CTABanner } from '@/components/cta-banner';
import { FadeInOnScroll } from '@/components/fade-in-on-scroll';
import { JsonLdBreadcrumb } from '@/components/json-ld-breadcrumb';
import { PublicHero } from '@/components/public-hero';
import { TrackedLink } from '@/components/tracked-link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export const metadata: Metadata = {
	title: 'About Us — VolunteerReady',
	description:
		'The story behind VolunteerReady — why we built the trusted infrastructure for volunteer engagement.',
	openGraph: {
		title: 'About Us — VolunteerReady',
		description:
			'The story behind VolunteerReady — why we built the trusted infrastructure for volunteer engagement.',
	},
};

const values = [
	{
		icon: Heart,
		name: 'Connection',
		description:
			'Every volunteer deserves to feel genuinely connected to the cause they serve — not just assigned to a task.',
	},
	{
		icon: Zap,
		name: 'Simplicity',
		description:
			'Volunteering should be straightforward. We remove friction from every step of the journey.',
	},
	{
		icon: TrendingUp,
		name: 'Impact',
		description:
			'We measure success by the lives improved — for the nonprofits we serve and the volunteers who power them.',
	},
	{
		icon: Shield,
		name: 'Trust',
		description:
			'Nonprofits trust us with their most important resource. Volunteers trust us with their time. We earn both every day.',
	},
];

const milestones = [
	{
		label: 'Skill-based matching engine',
		detail:
			'Volunteers are matched to opportunities based on verified skills, certifications, and availability.',
	},
	{
		label: 'FCRA-compliant background checks',
		detail:
			'Checkr-powered screening with encrypted tokens and full adverse action workflows.',
	},
	{
		label: 'Portable credentials',
		detail:
			'Verified badges that travel across every organization on the platform.',
	},
	{
		label: 'Shift scheduling and attendance',
		detail:
			'Create shifts, manage capacity, and track attendance without spreadsheets.',
	},
	{
		label: 'Corporate ESG reporting',
		detail:
			'Aggregate volunteer impact dashboards and CSV exports for corporate sponsors.',
	},
];

export default function AboutPage() {
	return (
		<div className="flex flex-col">
			<JsonLdBreadcrumb
				items={[
					{ label: 'Home', href: '/' },
					{ label: 'About', href: '/about' },
				]}
			/>
			<PublicHero
				eyebrow="Our story"
				heading={
					<>
						We believe volunteering should feel as good{' '}
						<em className="italic text-primary">as it looks on paper.</em>
					</>
				}
				description="Too many people who want to give back get stuck in outdated systems. Too many nonprofits lose great volunteers to friction. We built VolunteerReady to change that."
			/>

			{/* ── Origin Story ── */}
			<section className="mx-auto w-full max-w-3xl px-4 py-20">
				<div className="grid gap-12 sm:grid-cols-2 sm:gap-8">
					<div>
						<h2 className="font-display mb-4 text-2xl font-bold text-foreground [text-wrap:balance]">
							Why we built this
						</h2>
						<p className="leading-relaxed text-muted-foreground">
							For the past 35 years, we've shown up. At food banks. At animal
							rescues. At spay and neuter clinics in cities we've passed through
							and towns we've called home. No single cause, just a belief that
							if you have something to give — time, skill, a pair of hands — you
							give it.
						</p>
						<p className="mt-4 leading-relaxed text-muted-foreground">
							Trisha spent decades in animal rescue across California — on the
							ground, seeing firsthand what organizations need and where they
							struggle. Jason is a software engineer who put those skills to
							work for nonprofits that couldn't afford to hire anyone: building
							websites for animal rescues that needed a real presence without a
							real budget.
						</p>
						<div className="mt-6 overflow-hidden rounded-lg">
							<Image
								src="/team/mountain-lake-hike.jpg"
								alt="Jason and Trisha Shultz hiking at a mountain lake"
								width={600}
								height={450}
								className="h-auto w-full object-cover"
							/>
						</div>
					</div>
					<div>
						<h2 className="font-display mb-4 text-2xl font-bold text-foreground [text-wrap:balance]">
							What it became
						</h2>
						<p className="leading-relaxed text-muted-foreground">
							This site exists because connecting volunteers with the
							organizations that need them shouldn't be hard. It should be as
							easy as showing up.
						</p>
						<p className="mt-4 leading-relaxed text-muted-foreground">
							So we built the thing that should have already existed: a platform
							where nonprofits can screen for fit, schedule shifts, issue
							credentials, and manage their entire volunteer force — while
							volunteers can discover causes they care about and carry their
							record everywhere.
						</p>
						<div className="mt-6 overflow-hidden rounded-lg">
							<Image
								src="/team/hilltop-with-dog.jpg"
								alt="Jason and Trisha outdoors with their dog on a scenic hilltop"
								width={600}
								height={450}
								className="h-auto w-full object-cover"
							/>
						</div>
					</div>
				</div>
			</section>

			{/* ── Mission ── */}
			<section className="bg-primary px-4 py-16 text-primary-foreground">
				<div className="mx-auto max-w-2xl text-center">
					<p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-primary-foreground/60">
						Our mission
					</p>
					<blockquote className="font-display text-2xl font-bold leading-snug [text-wrap:balance] sm:text-3xl">
						"To make volunteering as easy as it is meaningful — for the people
						who give their time and the organizations that depend on it."
					</blockquote>
				</div>
			</section>

			{/* ── Platform maturity ── */}
			<section className="bg-[#F5F4F0] px-4 py-16">
				<div className="mx-auto max-w-3xl">
					<h2 className="font-display mb-3 text-[32px] font-bold text-foreground [text-wrap:balance]">
						What we've built so far
					</h2>
					<p className="mb-10 text-muted-foreground">
						VolunteerReady isn't a landing page with a waitlist. It's a
						production platform with real organizations and real volunteers.
					</p>
					<div className="flex flex-col gap-6">
						{milestones.map((m, i) => (
							<FadeInOnScroll key={m.label} delay={i * 75}>
								<div className="border-l-2 border-primary/30 pl-6">
									<p className="font-semibold text-foreground">{m.label}</p>
									<p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
										{m.detail}
									</p>
								</div>
							</FadeInOnScroll>
						))}
					</div>
				</div>
			</section>

			{/* ── Values ── */}
			<section className="mx-auto w-full max-w-4xl px-4 py-20">
				<h2 className="font-display mb-10 text-[32px] font-bold text-foreground [text-wrap:balance]">
					What guides us
				</h2>
				<div className="grid gap-8 sm:grid-cols-2">
					{values.map((value, i) => {
						const Icon = value.icon;
						return (
							<FadeInOnScroll key={value.name} delay={i * 75}>
								<div className="flex gap-5">
									<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
										<Icon className="h-5 w-5 text-primary" />
									</div>
									<div>
										<p className="mb-1 text-lg font-semibold text-foreground">
											{value.name}
										</p>
										<p className="text-sm leading-relaxed text-muted-foreground">
											{value.description}
										</p>
									</div>
								</div>
							</FadeInOnScroll>
						);
					})}
				</div>
			</section>

			{/* ── Founders ── */}
			<section className="bg-[#F5F4F0] px-4 py-16">
				<div className="mx-auto max-w-3xl">
					<h2 className="font-display mb-2 text-center text-[32px] font-bold text-foreground [text-wrap:balance]">
						The founders
					</h2>
					<p className="mb-10 text-center text-muted-foreground">
						Two people with a long history of showing up — and the conviction
						that it should be easier for everyone else to do the same.
					</p>
					<div className="grid gap-5 sm:grid-cols-2">
						<FadeInOnScroll>
							<Card className="border-border/70 transition-all duration-300 hover:shadow-md hover:scale-[1.01]">
								<CardContent className="flex flex-col items-center gap-5 pb-8 pt-8 text-center">
									<div className="relative h-24 w-24 overflow-hidden rounded-full">
										<Image
											src="/team/jason-shultz.jpg"
											alt="Jason Shultz"
											width={96}
											height={96}
											className="h-full w-full object-cover"
										/>
									</div>
									<div>
										<p className="text-lg font-semibold text-foreground">
											Jason Shultz
										</p>
										<p className="mb-3 text-xs text-primary/80">Cofounder</p>
										<p className="text-sm leading-relaxed text-muted-foreground">
											Software engineer and 35-year volunteer. Built websites
											for animal rescues and nonprofits that needed a real
											presence without a real budget. Built VolunteerReady
											because connecting volunteers with organizations shouldn't
											be hard.
										</p>
									</div>
								</CardContent>
							</Card>
						</FadeInOnScroll>
						<FadeInOnScroll delay={75}>
							<Card className="border-border/70 transition-all duration-300 hover:shadow-md hover:scale-[1.01]">
								<CardContent className="flex flex-col items-center gap-5 pb-8 pt-8 text-center">
									<div className="relative h-24 w-24 overflow-hidden rounded-full">
										<Image
											src="/team/trisha-shultz.jpg"
											alt="Trisha Shultz"
											width={96}
											height={96}
											className="h-full w-full object-cover"
										/>
									</div>
									<div>
										<p className="text-lg font-semibold text-foreground">
											Trisha Shultz
										</p>
										<p className="mb-3 text-xs text-primary/80">Cofounder</p>
										<p className="text-sm leading-relaxed text-muted-foreground">
											Decades of experience in animal rescue and volunteering
											across California. Brings the frontline perspective of
											what organizations actually need to make volunteer
											programs work.
										</p>
									</div>
								</CardContent>
							</Card>
						</FadeInOnScroll>
					</div>
				</div>
			</section>

			<CTABanner
				icon={Heart}
				heading="Ready to be part of it?"
				description="Join the people and organizations already making a difference through VolunteerReady."
				actions={
					<>
						<Button
							asChild
							size="lg"
							className="rounded-full bg-white px-8 text-primary hover:bg-white/90"
						>
							<TrackedLink
								href="/login?callbackUrl=/app/my-applications"
								eventLabel="Start volunteering (about)"
								eventPage="about"
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
								eventLabel="Set up org (about)"
								eventPage="about"
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
