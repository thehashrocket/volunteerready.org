import {
	Award,
	ClipboardList,
	Heart,
	MapPin,
	Search,
	Star,
	UserCheck,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const benefits = [
	{
		icon: Search,
		heading: 'Discover causes that match who you are',
		body: 'Browse opportunities from verified nonprofits in your community — filtered by cause, location, and what fits your schedule. No more guessing which organizations are active or what they actually need.',
		accent: 'primary',
	},
	{
		icon: ClipboardList,
		heading: 'Apply in minutes, not hours',
		body: 'Each organization customizes a short screening form so they can find the right fit — and so do you. No lengthy paperwork, no confusing portals. Just a focused form and a clear next step.',
		accent: 'success',
	},
	{
		icon: UserCheck,
		heading: 'Track your entire volunteer journey',
		body: "See every application you've submitted, every opportunity you've pursued, and every shift you've completed — all in one place. Your volunteer history is yours, organized and always accessible.",
		accent: 'accent',
	},
	{
		icon: Award,
		heading: 'Build a verified record of your service',
		body: "Earn credentials that matter: background check clearance, training completions, orientation badges. Organizations can see your verified history. You can feel proud of the record you've built.",
		accent: 'primary',
	},
];

const steps = [
	{
		number: '01',
		label: 'Create your profile',
		detail:
			'Add your skills, interests, and availability so organizations can understand who you are.',
	},
	{
		number: '02',
		label: 'Browse opportunities',
		detail:
			'Discover vetted volunteer roles from nonprofits that need someone like you.',
	},
	{
		number: '03',
		label: 'Submit your application',
		detail:
			'Complete a focused screening form — it takes minutes and tells the org exactly what they need to know.',
	},
	{
		number: '04',
		label: 'Get accepted',
		detail:
			"You'll hear back directly through the platform. No more wondering if your email got lost.",
	},
	{
		number: '05',
		label: 'Show up and track your impact',
		detail:
			'Sign up for shifts, log attendance, earn credentials. Watch your volunteer record grow.',
	},
];

export default function ForVolunteersPage() {
	return (
		<div className="flex flex-col">
			{/* ── Hero ── */}
			<section className="relative overflow-hidden bg-gradient-to-br from-success/10 via-background to-primary/5 px-4 py-20 sm:py-28">
				<div
					aria-hidden="true"
					className="pointer-events-none absolute left-0 top-0 -translate-x-1/4 -translate-y-1/4 opacity-[0.06]"
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
							className="text-success"
						/>
						<ellipse
							cx="250"
							cy="200"
							rx="150"
							ry="220"
							fill="currentColor"
							className="text-primary"
							transform="rotate(15 250 200)"
						/>
					</svg>
				</div>

				<div className="relative mx-auto max-w-2xl text-center">
					<p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-primary/70">
						For Volunteers
					</p>
					<h1 className="font-display text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl sm:leading-tight">
						Your time is a gift.{' '}
						<em className="italic text-primary">
							We help it land where it matters.
						</em>
					</h1>
					<p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
						Stop sifting through outdated listings and chasing unanswered
						emails. VolunteerReady connects you directly with nonprofits that
						need exactly what you have to offer.
					</p>
					<div className="mt-8 flex flex-wrap items-center justify-center gap-3">
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
							<Link href="/how-it-works">See how it works</Link>
						</Button>
					</div>
				</div>
			</section>

			{/* ── Benefits ── */}
			<section className="mx-auto w-full max-w-4xl px-4 py-16">
				<h2 className="font-display mb-10 text-center text-2xl font-bold text-foreground">
					Everything you need to give your best
				</h2>
				<div className="grid gap-5 sm:grid-cols-2">
					{benefits.map((b) => {
						const Icon = b.icon;
						return (
							<Card
								key={b.heading}
								className="relative overflow-hidden border-border/70 transition-shadow hover:shadow-md"
							>
								<div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-success to-primary" />
								<CardContent className="flex flex-col gap-4 pb-7 pt-7">
									<div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
										<Icon className="h-5 w-5 text-primary" />
									</div>
									<div>
										<p className="mb-1.5 font-semibold text-foreground">
											{b.heading}
										</p>
										<p className="text-sm leading-relaxed text-muted-foreground">
											{b.body}
										</p>
									</div>
								</CardContent>
							</Card>
						);
					})}
				</div>
			</section>

			{/* ── Journey steps ── */}
			<section className="bg-muted/40 px-4 py-16">
				<div className="mx-auto max-w-3xl">
					<h2 className="font-display mb-2 text-center text-2xl font-bold text-foreground">
						Your volunteer journey
					</h2>
					<p className="mb-10 text-center text-sm text-muted-foreground">
						From first sign-up to verified service record — here's how it flows.
					</p>
					<div className="relative flex flex-col gap-6">
						{steps.map((step, i) => (
							<div key={step.number} className="flex items-start gap-5">
								<div className="flex flex-col items-center">
									<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
										{step.number}
									</div>
									{i < steps.length - 1 && (
										<div
											className="mt-1 h-full w-px bg-border"
											style={{ minHeight: '2rem' }}
										/>
									)}
								</div>
								<div className="pb-2 pt-1.5">
									<p className="font-semibold text-foreground">{step.label}</p>
									<p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
										{step.detail}
									</p>
								</div>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* ── Testimonial ── */}
			<section className="mx-auto w-full max-w-2xl px-4 py-16">
				<Card className="border-border/70">
					<CardContent className="px-8 py-8">
						<Star className="mb-4 h-5 w-5 text-accent-foreground" />
						<blockquote className="text-lg leading-relaxed text-foreground">
							"I'd tried to get involved with three different shelters over the
							years. Each time I hit a wall — no response, confusing paperwork,
							or roles that didn't match my skills. VolunteerReady actually
							worked. I applied on a Tuesday and was in orientation by Friday."
						</blockquote>
						<div className="mt-5 flex items-center gap-3">
							<div className="flex h-9 w-9 items-center justify-center rounded-full bg-success/15 text-sm font-bold text-success-foreground">
								DL
							</div>
							<div>
								<p className="text-sm font-semibold text-foreground">Dana L.</p>
								<p className="text-xs text-muted-foreground">
									Volunteer since 2024 · Seattle, WA
								</p>
							</div>
						</div>
					</CardContent>
				</Card>
			</section>

			{/* ── CTA banner ── */}
			<section className="bg-primary px-4 py-14 text-primary-foreground">
				<div className="mx-auto max-w-xl text-center">
					<MapPin className="mx-auto mb-4 h-8 w-8 text-primary-foreground/70" />
					<h2 className="font-display mb-3 text-2xl font-bold">
						Ready to make your move?
					</h2>
					<p className="mb-8 text-primary-foreground/75">
						Create a free account and start exploring opportunities in your
						community today.
					</p>
					<Button
						asChild
						size="lg"
						className="rounded-full bg-white px-8 text-primary hover:bg-white/90"
					>
						<Link href="/login?callbackUrl=/app/my-applications">
							Sign in to get started
						</Link>
					</Button>
				</div>
			</section>
		</div>
	);
}
