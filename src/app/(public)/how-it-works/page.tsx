import { BarChart3, Building2, Heart } from 'lucide-react';
import type { Metadata } from 'next';
import { FadeInOnScroll } from '@/components/fade-in-on-scroll';
import { FaqSection } from '@/components/faq-section';
import { JsonLdBreadcrumb } from '@/components/json-ld-breadcrumb';
import { PublicHero } from '@/components/public-hero';
import { TrackedLink } from '@/components/tracked-link';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
	title: 'How It Works — VolunteerReady',
	description:
		'See how VolunteerReady works for volunteers, nonprofits, and corporate CSR programs. From sign-up to verified service record.',
	openGraph: {
		title: 'How It Works — VolunteerReady',
		description:
			'See how VolunteerReady works for volunteers, nonprofits, and corporate CSR programs.',
		images: [{ url: '/api/og/page/how-it-works', width: 1200, height: 630 }],
	},
};

const volunteerSteps = [
	{
		number: '01',
		label: 'Create your profile',
		detail:
			'Sign up and add your skills, interests, and availability. Our matching engine uses your profile to find the best opportunities.',
	},
	{
		number: '02',
		label: 'Get matched or browse',
		detail:
			'We surface opportunities tailored to your skills. You can also browse all listings and filter by cause, location, and schedule.',
	},
	{
		number: '03',
		label: 'Apply and get screened',
		detail:
			'Complete a focused screening form — usually under five minutes. Background checks run seamlessly if required.',
	},
	{
		number: '04',
		label: 'Track your status',
		detail:
			'Check your application status anytime. Get notified when a decision is made — no more wondering if your email got lost.',
	},
	{
		number: '05',
		label: 'Show up, earn credentials, grow',
		detail:
			'Sign up for shifts, log attendance, and earn verified credentials. Your portable record grows with every organization you serve.',
	},
];

const nonprofitSteps = [
	{
		number: '01',
		label: 'Set up your organization',
		detail:
			'Create your profile in minutes. Add your mission, location, and team members with role-based access.',
	},
	{
		number: '02',
		label: 'Post opportunities',
		detail:
			'Define roles with location, schedule, capacity, and required skills. Publish when ready — close when spots fill.',
	},
	{
		number: '03',
		label: 'Screen and background check',
		detail:
			'Build custom questionnaires with auto-pass/fail rules. Run FCRA-compliant Checkr & Sterling background checks when needed.',
	},
	{
		number: '04',
		label: 'Review and approve',
		detail:
			'Applications arrive pre-sorted. Approve, reject, or flag for review — with screening results already calculated.',
	},
	{
		number: '05',
		label: 'Schedule, attend, credential',
		detail:
			'Create shifts, manage sign-ups, track attendance, and issue portable credentials to your most trusted volunteers.',
	},
];

const employerSteps = [
	{
		number: '01',
		label: 'Create your company profile',
		detail:
			'Set up your corporate account and link to nonprofit partners already on the platform.',
	},
	{
		number: '02',
		label: 'Employees join naturally',
		detail:
			'Your employees create profiles on the same platform nonprofits use. No separate app to install or maintain.',
	},
	{
		number: '03',
		label: 'Track participation',
		detail:
			'See which employees are volunteering, where, and how often. Hours and credentials are verified by nonprofits.',
	},
	{
		number: '04',
		label: 'Export ESG reports',
		detail:
			'Aggregate impact data across your workforce. Export CSV reports for board decks, sustainability filings, and stakeholder updates.',
	},
];

type StepData = { number: string; label: string; detail: string };

function StepTimeline({
	steps,
	accentClass,
}: {
	steps: StepData[];
	accentClass: string;
}) {
	return (
		<div className="flex flex-col gap-6">
			{steps.map((step, i) => (
				<FadeInOnScroll key={step.number} delay={i * 75}>
					<div className="flex items-start gap-5">
						<div className="flex flex-col items-center">
							<div
								className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${accentClass}`}
							>
								{step.number}
							</div>
							{i < steps.length - 1 && (
								<div
									className="mt-1 w-px bg-border"
									style={{ minHeight: '1.5rem' }}
								/>
							)}
						</div>
						<div className="pb-2 pt-1">
							<p className="font-semibold text-foreground">{step.label}</p>
							<p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
								{step.detail}
							</p>
						</div>
					</div>
				</FadeInOnScroll>
			))}
		</div>
	);
}

const faqs = [
	{
		question: 'Is VolunteerReady free for volunteers?',
		answer:
			"Yes. Volunteers always use VolunteerReady for free. There's no cost to create a profile, apply to opportunities, or track your history.",
	},
	{
		question: 'How does screening work?',
		answer:
			'Each nonprofit creates its own screening questionnaire with auto-pass/fail rules. Your answers are evaluated against those rules, and the team sees a result (pass, review, or flag). Humans always make the final call.',
	},
	{
		question: 'What about background checks?',
		answer:
			'Background checks are powered by Checkr and Sterling with full FCRA compliance — including adverse action workflows. They run seamlessly within the screening process and results are encrypted at rest.',
	},
	{
		question: 'Can I volunteer with multiple organizations?',
		answer:
			"Your profile and credentials are portable across every organization on the platform. Apply to as many as you'd like from a single dashboard.",
	},
	{
		question: 'What credentials can be tracked?',
		answer:
			'Background Check Cleared, Training Complete, ID Verified, Reference Check Complete, and Orientation Complete. Each tracks the date issued and can be revoked if circumstances change.',
	},
	{
		question: 'How does the matching engine work?',
		answer:
			'On Starter and Pro plans, our matching engine evaluates volunteer skills, certifications, location, and availability against opportunity requirements. It surfaces the best-fit candidates automatically.',
	},
	{
		question: 'How do corporate ESG reports work?',
		answer:
			'Pro plan companies see aggregate dashboards of employee volunteering — hours, participation rates, and impact by nonprofit partner. Export CSV reports for sustainability filings.',
	},
];

export default function HowItWorksPage() {
	return (
		<div className="flex flex-col">
			<JsonLdBreadcrumb
				items={[
					{ label: 'Home', href: '/' },
					{ label: 'How It Works', href: '/how-it-works' },
				]}
			/>
			<PublicHero
				eyebrow="How it works"
				heading={
					<>
						Simple by design.{' '}
						<em className="italic text-primary">Powerful under the hood.</em>
					</>
				}
				description="Whether you're a volunteer, a nonprofit, or a corporate CSR program — the path forward is clear. Here's exactly how VolunteerReady works."
			/>

			{/* ── Three audience journeys ── */}
			<section className="mx-auto w-full max-w-5xl px-4 py-20">
				<div className="grid gap-16 lg:grid-cols-3">
					{/* Volunteers */}
					<div>
						<div className="mb-8 flex items-center gap-3">
							<div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/15">
								<Heart className="h-5 w-5 text-success-foreground" />
							</div>
							<h2 className="font-display text-2xl font-bold text-foreground">
								Volunteers
							</h2>
						</div>
						<StepTimeline
							steps={volunteerSteps}
							accentClass="bg-success/20 text-success-foreground"
						/>
						<div className="mt-8">
							<Button asChild className="rounded-full px-6">
								<TrackedLink
									href="/login?callbackUrl=/app/my-applications"
									eventLabel="Start volunteering"
									eventPage="how-it-works"
								>
									<Heart className="h-4 w-4" />
									Start volunteering
								</TrackedLink>
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
								Nonprofits
							</h2>
						</div>
						<StepTimeline
							steps={nonprofitSteps}
							accentClass="bg-primary/10 text-primary"
						/>
						<div className="mt-8">
							<Button asChild variant="outline" className="rounded-full px-6">
								<TrackedLink
									href="/login?callbackUrl=/app/onboarding"
									eventLabel="Set up org"
									eventPage="how-it-works"
								>
									<Building2 className="h-4 w-4" />
									Set up your organization
								</TrackedLink>
							</Button>
						</div>
					</div>

					{/* Employers */}
					<div>
						<div className="mb-8 flex items-center gap-3">
							<div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#C4A882]/20">
								<BarChart3 className="h-5 w-5 text-[#8B7355]" />
							</div>
							<h2 className="font-display text-2xl font-bold text-foreground">
								Employers
							</h2>
						</div>
						<StepTimeline
							steps={employerSteps}
							accentClass="bg-[#C4A882]/20 text-[#8B7355]"
						/>
						<div className="mt-8">
							<Button asChild variant="outline" className="rounded-full px-6">
								<TrackedLink
									href="/for-employers"
									eventLabel="Learn more employer"
									eventPage="how-it-works"
								>
									<BarChart3 className="h-4 w-4" />
									Learn more
								</TrackedLink>
							</Button>
						</div>
					</div>
				</div>
			</section>

			{/* ── FAQ ── */}
			<section className="bg-[#F5F4F0] px-4 py-16">
				<FaqSection faqs={faqs} />
			</section>

			{/* ── Bottom CTA ── */}
			<section className="px-4 py-20">
				<div className="mx-auto max-w-xl text-center">
					<h2 className="font-display mb-3 text-2xl font-bold text-foreground [text-wrap:balance]">
						Which describes you?
					</h2>
					<p className="mb-8 text-muted-foreground">
						All paths start with a single click. No credit card, no commitment.
					</p>
					<div className="flex flex-wrap items-center justify-center gap-3">
						<Button asChild size="lg" className="rounded-full px-8">
							<TrackedLink
								href="/login?callbackUrl=/app/my-applications"
								eventLabel="I'm a volunteer"
								eventPage="how-it-works"
							>
								<Heart className="h-4 w-4" />
								I'm a volunteer
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
								eventLabel="I run a nonprofit"
								eventPage="how-it-works"
							>
								<Building2 className="h-4 w-4" />I run a nonprofit
							</TrackedLink>
						</Button>
					</div>
				</div>
			</section>
		</div>
	);
}
