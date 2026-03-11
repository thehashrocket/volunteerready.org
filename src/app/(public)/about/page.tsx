import { Heart, Shield, TrendingUp, Zap } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

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
			'We measure success by the lives improved — both for the nonprofits we serve and the volunteers who power them.',
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

export default function AboutPage() {
	return (
		<div className="flex flex-col">
			{/* ── Hero ── */}
			<section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-accent/10 px-4 py-20 sm:py-28">
				<div
					aria-hidden="true"
					className="pointer-events-none absolute right-0 top-0 -translate-y-1/4 translate-x-1/4 opacity-[0.06]"
				>
					<svg
						aria-hidden="true"
						width="600"
						height="600"
						viewBox="0 0 600 600"
						fill="none"
					>
						<circle
							cx="300"
							cy="300"
							r="280"
							fill="currentColor"
							className="text-primary"
						/>
						<ellipse
							cx="300"
							cy="200"
							rx="120"
							ry="200"
							fill="currentColor"
							className="text-accent"
							transform="rotate(-20 300 200)"
						/>
					</svg>
				</div>

				<div className="relative mx-auto max-w-2xl text-center">
					<p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-primary/70">
						Our story
					</p>
					<h1 className="font-display text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl sm:leading-tight">
						We believe volunteering should feel as good{' '}
						<em className="italic text-primary">as it looks on paper.</em>
					</h1>
					<p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
						Too many people who want to give back get stuck in outdated systems.
						Too many nonprofits lose great volunteers to friction. We built
						VolunteerReady to change that.
					</p>
				</div>
			</section>

			{/* ── Origin Story ── */}
			<section className="mx-auto w-full max-w-3xl px-4 py-16">
				<div className="grid gap-12 sm:grid-cols-2 sm:gap-8">
					<div>
						<h2 className="font-display mb-4 text-2xl font-bold text-foreground">
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
							what, or how to even get started. He applied to three nonprofits
							and heard back from none.
						</p>
					</div>
					<div>
						<h2 className="font-display mb-4 text-2xl font-bold text-foreground">
							What we built
						</h2>
						<p className="leading-relaxed text-muted-foreground">
							They met at a community tech night and realized they were
							describing the same problem from opposite sides. So they built the
							thing that should have already existed: a platform where
							nonprofits can define exactly what they need, screen for fit, and
							manage their entire volunteer force — while volunteers can
							discover causes they care about and actually get matched.
						</p>
						<p className="mt-4 leading-relaxed text-muted-foreground">
							VolunteerReady launched with one partner organization and a
							handful of beta volunteers. Today we're proud to support dozens of
							nonprofits and thousands of people who want to make a difference.
						</p>
					</div>
				</div>
			</section>

			{/* ── Mission Statement ── */}
			<section className="bg-primary px-4 py-16 text-primary-foreground">
				<div className="mx-auto max-w-2xl text-center">
					<p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-primary-foreground/60">
						Our mission
					</p>
					<blockquote className="font-display text-2xl font-bold leading-snug sm:text-3xl">
						"To make volunteering as easy as it is meaningful — for the people
						who give their time and the organizations that depend on it."
					</blockquote>
				</div>
			</section>

			{/* ── Values ── */}
			<section className="mx-auto w-full max-w-5xl px-4 py-16">
				<h2 className="font-display mb-10 text-center text-2xl font-bold text-foreground">
					What guides us
				</h2>
				<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
					{values.map((value) => {
						const Icon = value.icon;
						return (
							<Card
								key={value.name}
								className="relative overflow-hidden border-border/70 transition-shadow hover:shadow-md"
							>
								<div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-success to-primary" />
								<CardContent className="flex flex-col gap-4 pb-6 pt-6">
									<div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
										<Icon className="h-5 w-5 text-primary" />
									</div>
									<div>
										<p className="mb-1.5 font-semibold text-foreground">
											{value.name}
										</p>
										<p className="text-sm leading-relaxed text-muted-foreground">
											{value.description}
										</p>
									</div>
								</CardContent>
							</Card>
						);
					})}
				</div>
			</section>

			{/* ── Team ── */}
			<section className="bg-muted/40 px-4 py-16">
				<div className="mx-auto max-w-3xl">
					<h2 className="font-display mb-2 text-center text-2xl font-bold text-foreground">
						The team
					</h2>
					<p className="mb-10 text-center text-sm text-muted-foreground">
						A small group with a big belief: that good people deserve a great
						way to give back.
					</p>
					<div className="grid gap-5 sm:grid-cols-3">
						{team.map((member) => (
							<Card
								key={member.name}
								className="border-border/70 transition-shadow hover:shadow-md"
							>
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
						))}
					</div>
				</div>
			</section>

			{/* ── CTA ── */}
			<section className="px-4 py-16">
				<div className="mx-auto max-w-xl text-center">
					<h2 className="font-display mb-3 text-2xl font-bold text-foreground">
						Ready to be part of it?
					</h2>
					<p className="mb-8 text-muted-foreground">
						Join the people and organizations already making a difference
						through VolunteerReady.
					</p>
					<div className="flex flex-wrap items-center justify-center gap-3">
						<Button asChild size="lg" className="rounded-full px-8">
							<Link href="/login?callbackUrl=/app/my-applications">
								<Heart className="h-4 w-4" />
								Start volunteering
							</Link>
						</Button>
						<Button
							asChild
							variant="outline"
							size="lg"
							className="rounded-full px-8"
						>
							<Link href="/login?callbackUrl=/app/onboarding">
								Set up your organization
							</Link>
						</Button>
					</div>
				</div>
			</section>
		</div>
	);
}
