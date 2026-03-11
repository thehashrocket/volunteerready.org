import {
	Award,
	Building2,
	CalendarDays,
	ClipboardList,
	Clock,
	HandHeart,
	Star,
	Users,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const features = [
	{
		icon: ClipboardList,
		heading: 'Post opportunities in minutes',
		body: "Create a volunteer opportunity with location, schedule, capacity, and requirements. Publish when you're ready and close when spots are filled — no developer needed.",
	},
	{
		icon: Users,
		heading: 'Smart screening that finds the right fit',
		body: 'Build a custom screening questionnaire with auto-pass and auto-fail rules. VolunteerReady surfaces qualified candidates and flags those who need a closer look — so you spend time on the right applicants.',
	},
	{
		icon: CalendarDays,
		heading: 'Shift scheduling and attendance',
		body: "Create shifts, set capacity, and let volunteers sign up directly. Track who showed up, who didn't, and mark attendance with one click. No more coordinating via group texts.",
	},
	{
		icon: Award,
		heading: 'Issue and track volunteer credentials',
		body: "Grant verified badges for background checks, orientation completions, training certifications, and ID verification. Know at a glance who's cleared to serve.",
	},
];

const outcomes = [
	{
		icon: Clock,
		stat: 'Hours saved',
		detail:
			"Automated screening and online scheduling eliminate the back-and-forth that eats your staff's time.",
	},
	{
		icon: HandHeart,
		stat: 'Fewer no-shows',
		detail:
			'Qualified volunteers who went through a real screening process are more committed to showing up.',
	},
	{
		icon: Building2,
		stat: 'Deeper relationships',
		detail:
			'A clear volunteer record — applications, shifts, credentials — means you know who your most reliable people are.',
	},
];

export default function ForNonprofitsPage() {
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
						<ellipse
							cx="400"
							cy="380"
							rx="100"
							ry="180"
							fill="currentColor"
							className="text-primary"
							transform="rotate(35 400 380)"
						/>
					</svg>
				</div>

				<div className="relative mx-auto max-w-2xl text-center">
					<p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-primary/70">
						For Nonprofits
					</p>
					<h1 className="font-display text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl sm:leading-tight">
						Your mission is too important to manage{' '}
						<em className="italic text-primary">from a spreadsheet.</em>
					</h1>
					<p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
						VolunteerReady gives your organization everything it needs to
						recruit the right volunteers, screen them effectively, and keep them
						engaged — all in one place.
					</p>
					<div className="mt-8 flex flex-wrap items-center justify-center gap-3">
						<Button asChild size="lg" className="rounded-full px-8">
							<Link href="/login?callbackUrl=/app/onboarding">
								<Building2 className="h-4 w-4" />
								Set up your organization
							</Link>
						</Button>
						<Button
							asChild
							variant="outline"
							size="lg"
							className="rounded-full px-8"
						>
							<Link href="/how-it-works">See how it works</Link>
						</Button>
					</div>
				</div>
			</section>

			{/* ── Pain acknowledgment ── */}
			<section className="bg-muted/40 px-4 py-14">
				<div className="mx-auto max-w-2xl text-center">
					<h2 className="font-display mb-4 text-2xl font-bold text-foreground">
						We've heard the stories
					</h2>
					<p className="leading-relaxed text-muted-foreground">
						Volunteers who sign up and never show. Application emails buried in
						a shared inbox. Staff spending half their week on coordination that
						should take minutes. New volunteers who weren't properly screened,
						creating risk for your organization and the people you serve.
					</p>
					<p className="mt-4 leading-relaxed text-muted-foreground">
						You didn't start a nonprofit to manage logistics. VolunteerReady
						handles it — so you can focus on the work that only you can do.
					</p>
				</div>
			</section>

			{/* ── Features ── */}
			<section className="mx-auto w-full max-w-4xl px-4 py-16">
				<h2 className="font-display mb-10 text-center text-2xl font-bold text-foreground">
					Built for the way nonprofits actually work
				</h2>
				<div className="grid gap-5 sm:grid-cols-2">
					{features.map((f) => {
						const Icon = f.icon;
						return (
							<Card
								key={f.heading}
								className="group relative overflow-hidden border-border/70 transition-shadow hover:shadow-md"
							>
								<div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-success to-primary" />
								<CardContent className="flex flex-col gap-4 pb-7 pt-7">
									<div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
										<Icon className="h-5 w-5 text-primary" />
									</div>
									<div>
										<p className="mb-1.5 font-semibold text-foreground">
											{f.heading}
										</p>
										<p className="text-sm leading-relaxed text-muted-foreground">
											{f.body}
										</p>
									</div>
								</CardContent>
							</Card>
						);
					})}
				</div>
			</section>

			{/* ── Outcomes ── */}
			<section className="bg-muted/40 px-4 py-16">
				<div className="mx-auto max-w-3xl">
					<h2 className="font-display mb-10 text-center text-2xl font-bold text-foreground">
						What you get back
					</h2>
					<div className="grid gap-8 sm:grid-cols-3">
						{outcomes.map((o) => {
							const Icon = o.icon;
							return (
								<div key={o.stat} className="text-center">
									<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
										<Icon className="h-5 w-5 text-primary" />
									</div>
									<h3 className="mb-1 font-semibold text-foreground">
										{o.stat}
									</h3>
									<p className="text-sm leading-relaxed text-muted-foreground">
										{o.detail}
									</p>
								</div>
							);
						})}
					</div>
				</div>
			</section>

			{/* ── Testimonial ── */}
			<section className="mx-auto w-full max-w-2xl px-4 py-16">
				<Card className="border-border/70">
					<CardContent className="px-8 py-8">
						<Star className="mb-4 h-5 w-5 text-accent-foreground" />
						<blockquote className="text-lg leading-relaxed text-foreground">
							"Before VolunteerReady, our volunteer coordinator was spending 12+
							hours a week just on intake and scheduling. Now we can focus that
							time on actually training and supporting volunteers. The smart
							screening alone saved us from placing three unqualified candidates
							in sensitive roles."
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
			</section>

			{/* ── CTA banner ── */}
			<section className="bg-primary px-4 py-14 text-primary-foreground">
				<div className="mx-auto max-w-xl text-center">
					<Building2 className="mx-auto mb-4 h-8 w-8 text-primary-foreground/70" />
					<h2 className="font-display mb-3 text-2xl font-bold">
						Ready to build your volunteer team?
					</h2>
					<p className="mb-8 text-primary-foreground/75">
						Set up your organization in minutes. No contract, no credit card
						required to get started.
					</p>
					<Button
						asChild
						size="lg"
						className="rounded-full bg-white px-8 text-primary hover:bg-white/90"
					>
						<Link href="/login?callbackUrl=/app/onboarding">
							Set up your organization
						</Link>
					</Button>
				</div>
			</section>
		</div>
	);
}
