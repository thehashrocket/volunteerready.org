import { Heart, Shield, TrendingUp, Zap } from 'lucide-react';
import type { Metadata } from 'next';
import { CTABanner } from '@/components/cta-banner';
import { FadeInOnScroll } from '@/components/fade-in-on-scroll';
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

const team = [
	{
		name: 'Maya Chen',
		role: 'Co-Founder & CEO',
		bio: 'Former nonprofit director who spent years wishing for better tools. Built the platform she always needed.',
		initials: 'MC',
	},
	{
		name: 'James Okafor',
		role: 'Co-Founder & CTO',
		bio: 'Software engineer who volunteered his way through college and never forgot how hard it was to find the right fit.',
		initials: 'JO',
	},
	{
		name: 'Sofia Reyes',
		role: 'Head of Community',
		bio: 'Spent a decade running volunteer programs at food banks and shelters before joining to shape how we build for organizations.',
		initials: 'SR',
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
							Where we started
						</h2>
						<p className="leading-relaxed text-muted-foreground">
							Maya spent years running volunteer programs at a regional food
							bank. She watched passionate people show up for one shift and
							disappear — not because they stopped caring, but because the
							coordination was exhausting. Emails got lost. Paperwork piled up.
							The wrong people were sent to the wrong roles.
						</p>
						<p className="mt-4 leading-relaxed text-muted-foreground">
							James had been on the other side — a volunteer who genuinely
							wanted to help but couldn't figure out which organizations needed
							what, or how to even get started.
						</p>
					</div>
					<div>
						<h2 className="font-display mb-4 text-2xl font-bold text-foreground [text-wrap:balance]">
							What we built
						</h2>
						<p className="leading-relaxed text-muted-foreground">
							They met at a community tech night and realized they were
							describing the same problem from opposite sides. So they built the
							thing that should have already existed: a platform where
							nonprofits can screen for fit, schedule shifts, issue credentials,
							and manage their entire volunteer force — while volunteers can
							discover causes they care about and carry their record everywhere.
						</p>
						<p className="mt-4 leading-relaxed text-muted-foreground">
							VolunteerReady launched with one partner organization and a
							handful of beta volunteers. Today we support dozens of nonprofits,
							corporate CSR programs, and thousands of people who want to make a
							difference.
						</p>
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

			{/* ── Team ── */}
			<section className="bg-[#F5F4F0] px-4 py-16">
				<div className="mx-auto max-w-3xl">
					<h2 className="font-display mb-2 text-center text-[32px] font-bold text-foreground [text-wrap:balance]">
						The team
					</h2>
					<p className="mb-10 text-center text-muted-foreground">
						A small group with a big belief: that good people deserve a great
						way to give back.
					</p>
					<div className="grid gap-5 sm:grid-cols-3">
						{team.map((member, i) => (
							<FadeInOnScroll key={member.name} delay={i * 75}>
								<Card className="border-border/70 transition-all duration-300 hover:shadow-md hover:scale-[1.01]">
									<CardContent className="flex flex-col items-center gap-4 pb-7 pt-7 text-center">
										<div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
											{member.initials}
										</div>
										<div>
											<p className="font-semibold text-foreground">
												{member.name}
											</p>
											<p className="mb-2 text-xs text-primary/80">
												{member.role}
											</p>
											<p className="text-sm leading-relaxed text-muted-foreground">
												{member.bio}
											</p>
										</div>
									</CardContent>
								</Card>
							</FadeInOnScroll>
						))}
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
