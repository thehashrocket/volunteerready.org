import { Building2, Heart } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

const volunteerSteps = [
	{
		number: '01',
		label: 'Create your profile',
		detail:
			'Sign up and add your skills, interests, and availability. Your profile travels with you across every organization on the platform.',
	},
	{
		number: '02',
		label: 'Browse vetted opportunities',
		detail:
			'Explore volunteer roles posted by nonprofits in your area. Filter by cause, location, schedule, and required skills.',
	},
	{
		number: '03',
		label: 'Apply with a tailored form',
		detail:
			'Each organization configures a short screening questionnaire. It usually takes under five minutes — no lengthy paperwork.',
	},
	{
		number: '04',
		label: 'Track your application status',
		detail:
			'Check your application status anytime from your dashboard. Get notified when a decision is made.',
	},
	{
		number: '05',
		label: 'Show up, earn credentials, grow',
		detail:
			'Sign up for shifts, log attendance, and earn verified credentials (background check, training, orientation). Your record builds as you serve.',
	},
];

const nonprofitSteps = [
	{
		number: '01',
		label: 'Set up your organization',
		detail:
			'Create your nonprofit profile in minutes. Add your mission, location, and team members. Invite staff to help manage applications.',
	},
	{
		number: '02',
		label: 'Post volunteer opportunities',
		detail:
			'Define the role, location, schedule, capacity, and any required skills. Publish when ready — unpublish or close when spots fill.',
	},
	{
		number: '03',
		label: 'Configure screening questions',
		detail:
			'Build a custom questionnaire with auto-pass and auto-fail rules. VolunteerReady surfaces qualified applicants and flags edge cases automatically.',
	},
	{
		number: '04',
		label: 'Review screened applications',
		detail:
			'Applications arrive pre-sorted. Approve, reject, or flag for review — with the screening result already calculated for you.',
	},
	{
		number: '05',
		label: 'Schedule, attend, credential',
		detail:
			'Create shifts, manage sign-ups, track attendance, and issue verified credentials to your most trusted volunteers.',
	},
];

const faqs = [
	{
		q: 'Is VolunteerReady free for volunteers?',
		a: "Yes. Volunteers always use VolunteerReady for free. There's no cost to create a profile, apply to opportunities, or track your history.",
	},
	{
		q: 'How does the screening process work?',
		a: "Each nonprofit creates its own screening questionnaire. When you apply, you fill out that form. Behind the scenes, VolunteerReady compares your answers against the organization's rules and surfaces a result (pass, review, or flag) to their team. You're not rejected by an algorithm — humans make the final call.",
	},
	{
		q: 'Can I volunteer with multiple organizations?',
		a: "Absolutely. Your VolunteerReady profile is yours — it works across every organization on the platform. Apply to as many as you'd like and manage all your applications from a single dashboard.",
	},
	{
		q: 'How does my nonprofit get set up?',
		a: 'Visit the setup page, create your account, and follow the onboarding flow. You can invite staff, post your first opportunity, and start receiving applications the same day.',
	},
	{
		q: 'What credentials can be tracked?',
		a: 'Nonprofits can issue five types of verified credentials: Background Check Cleared, Training Complete, ID Verified, Reference Check Complete, and Orientation Complete. Each credential tracks the date issued and can be revoked if circumstances change.',
	},
	{
		q: "What if a volunteer's circumstances change after they're approved?",
		a: 'Staff can revoke or expire credentials at any time. Application statuses can also be updated — approved volunteers can be moved back to review if needed.',
	},
];

export default function HowItWorksPage() {
	return (
		<div className="flex flex-col">
			{/* ── Hero ── */}
			<section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-accent/10 px-4 py-20 sm:py-24">
				<div className="relative mx-auto max-w-2xl text-center">
					<p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-primary/70">
						How it works
					</p>
					<h1 className="font-display text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl sm:leading-tight">
						Simple by design.{' '}
						<em className="italic text-primary">Powerful under the hood.</em>
					</h1>
					<p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
						Whether you're a volunteer ready to give back or a nonprofit
						building your team, the path forward is clear. Here's exactly how
						VolunteerReady works.
					</p>
				</div>
			</section>

			{/* ── Two audience sections ── */}
			<section className="mx-auto w-full max-w-5xl px-4 py-16">
				<div className="grid gap-16 lg:grid-cols-2">
					{/* Volunteers */}
					<div>
						<div className="mb-8 flex items-center gap-3">
							<div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/15">
								<Heart className="h-5 w-5 text-success-foreground" />
							</div>
							<h2 className="font-display text-2xl font-bold text-foreground">
								For Volunteers
							</h2>
						</div>
						<div className="flex flex-col gap-6">
							{volunteerSteps.map((step, i) => (
								<div key={step.number} className="flex items-start gap-5">
									<div className="flex flex-col items-center">
										<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success/20 text-sm font-bold text-success-foreground">
											{step.number}
										</div>
										{i < volunteerSteps.length - 1 && (
											<div
												className="mt-1 w-px bg-border"
												style={{ minHeight: '1.5rem' }}
											/>
										)}
									</div>
									<div className="pb-2 pt-1">
										<p className="font-semibold text-foreground">
											{step.label}
										</p>
										<p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
											{step.detail}
										</p>
									</div>
								</div>
							))}
						</div>
						<div className="mt-8">
							<Button asChild className="rounded-full px-6">
								<Link href="/login?callbackUrl=/app/my-applications">
									<Heart className="h-4 w-4" />
									Start volunteering
								</Link>
							</Button>
						</div>
					</div>

					{/* Nonprofits */}
					<div>
						<div className="mb-8 flex items-center gap-3">
							<div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
								<Building2 className="h-5 w-5 text-primary" />
							</div>
							<h2 className="font-display text-2xl font-bold text-foreground">
								For Nonprofits
							</h2>
						</div>
						<div className="flex flex-col gap-6">
							{nonprofitSteps.map((step, i) => (
								<div key={step.number} className="flex items-start gap-5">
									<div className="flex flex-col items-center">
										<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
											{step.number}
										</div>
										{i < nonprofitSteps.length - 1 && (
											<div
												className="mt-1 w-px bg-border"
												style={{ minHeight: '1.5rem' }}
											/>
										)}
									</div>
									<div className="pb-2 pt-1">
										<p className="font-semibold text-foreground">
											{step.label}
										</p>
										<p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
											{step.detail}
										</p>
									</div>
								</div>
							))}
						</div>
						<div className="mt-8">
							<Button asChild variant="outline" className="rounded-full px-6">
								<Link href="/login?callbackUrl=/app/onboarding">
									<Building2 className="h-4 w-4" />
									Set up your organization
								</Link>
							</Button>
						</div>
					</div>
				</div>
			</section>

			{/* ── FAQ ── */}
			<section className="bg-muted/40 px-4 py-16">
				<div className="mx-auto max-w-2xl">
					<h2 className="font-display mb-10 text-center text-2xl font-bold text-foreground">
						Frequently asked questions
					</h2>
					<div className="space-y-3">
						{faqs.map((faq) => (
							<details
								key={faq.q}
								className="group rounded-lg border border-border/60 bg-background px-5 py-4"
							>
								<summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-foreground">
									{faq.q}
									<span className="shrink-0 text-muted-foreground transition-transform group-open:rotate-45">
										+
									</span>
								</summary>
								<p className="mt-3 text-sm leading-relaxed text-muted-foreground">
									{faq.a}
								</p>
							</details>
						))}
					</div>
				</div>
			</section>

			{/* ── Bottom CTA ── */}
			<section className="px-4 py-16">
				<div className="mx-auto max-w-xl text-center">
					<h2 className="font-display mb-3 text-2xl font-bold text-foreground">
						Which describes you?
					</h2>
					<p className="mb-8 text-muted-foreground">
						Both paths start with a single click. No credit card, no commitment
						— just a step toward something meaningful.
					</p>
					<div className="flex flex-wrap items-center justify-center gap-3">
						<Button asChild size="lg" className="rounded-full px-8">
							<Link href="/login?callbackUrl=/app/my-applications">
								<Heart className="h-4 w-4" />
								I'm a volunteer
							</Link>
						</Button>
						<Button
							asChild
							variant="outline"
							size="lg"
							className="rounded-full px-8"
						>
							<Link href="/login?callbackUrl=/app/onboarding">
								<Building2 className="h-4 w-4" />I run a nonprofit
							</Link>
						</Button>
					</div>
				</div>
			</section>
		</div>
	);
}
