import { BarChart3, Building2, Heart } from 'lucide-react';
import type { Metadata } from 'next';
import type { ScreenshotAnnotation } from '@/components/annotated-screenshot';
import { CTABanner } from '@/components/cta-banner';
import { FaqSection } from '@/components/faq-section';
import { JsonLdBreadcrumb } from '@/components/json-ld-breadcrumb';
import { PublicHero } from '@/components/public-hero';
import { ScreenshotSection } from '@/components/screenshot-section';
import { TrackedLink } from '@/components/tracked-link';
import { Button } from '@/components/ui/button';
import { MARKETING_SCREENSHOTS } from '@/lib/marketing-screenshots';

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

// Marker coordinates are percentages of the 1280×720 capture frame — see the
// coordinate diagram in annotated-screenshot.tsx. Recapture via
// `pnpm screenshots` before adjusting (e2e/capture-scenarios.ts).
const dashboardAnnotations: ScreenshotAnnotation[] = [
	{
		x: 40.7,
		y: 39,
		label:
			'Published opportunities, applications, and approvals update here as they happen — no spreadsheet to reconcile at report time.',
	},
	{
		x: 27,
		y: 54,
		label:
			'Recent activity ties every application and check-in to the volunteer record automatically.',
	},
	{
		x: 84.2,
		y: 48.6,
		label:
			"A readiness score flags what's still open, so a funder question never catches the team flat-footed.",
	},
];

const volunteerSteps = [
	{
		number: '01',
		label: 'Create your profile',
		detail:
			'Sign up and add your skills, interests, and availability. Your skills are what our matching engine scores opportunities against.',
	},
	{
		number: '02',
		label: 'Get matched or browse',
		detail:
			'We rank opportunities by how well they fit your skills. You can also browse every listing, search by keyword, and filter for remote or in-person.',
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
				<div key={step.number} className="flex items-start gap-5">
					<div className="flex flex-col items-center">
						<div
							className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-mono text-sm font-bold ${accentClass}`}
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
						<p className="text-[14.5px] font-semibold text-foreground">
							{step.label}
						</p>
						<p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">
							{step.detail}
						</p>
					</div>
				</div>
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
			"Your profile and credentials are portable across every organization on the platform. Apply to as many as you'd like from a single dashboard, and leave any of them from your profile whenever you want.",
	},
	{
		question: "Can I remove an organization's access to me?",
		answer:
			"Yes, and you do it yourself. Your profile lists the organizations that can see you — including any that added you to their roster directly — and leaving one immediately stops them opening your volunteer record, scheduling you, or requesting a background check. They can't add you back; only you can restore the relationship, by signing in and applying to them or by signing up for one of their shifts. Two exceptions: a profile you've set to Public stays publicly visible until you change that, and if you're staff at that organization your staff access is unaffected.",
	},
	{
		question: 'What credentials can be tracked?',
		answer:
			'Organizations issue five: Background Check Cleared, Training Complete, ID Verified, Reference Check Complete, and Orientation Complete. Each tracks the date issued and can be revoked if circumstances change. The platform also issues tenure badges automatically at one, three, and five years of service.',
	},
	{
		question: 'How does the matching engine work?',
		answer:
			'It compares the skills on a volunteer profile against the skills an opportunity requires, then ranks opportunities by how completely they match. Coordinators see the same score against each applicant. Matching is included on every plan, Free included — it is not a paid upgrade.',
	},
	{
		question: 'How do corporate ESG reports work?',
		answer:
			'Companies on the Pro company plan see a dashboard of employee volunteering — employees active, shifts completed and hours served for a date range you pick, broken out by nonprofit partner, plus a point-in-time count of verified credentials. Export the same figures to CSV or PDF for sustainability filings.',
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
						<em className="italic text-primary" style={{ fontWeight: 500 }}>
							Powerful under the hood.
						</em>
					</>
				}
				description="Whether you're a volunteer, a nonprofit, or a corporate CSR program — the path forward is clear. Here's exactly how VolunteerReady works."
				side={{
					label: 'Three journeys, one system',
					note: (
						<>
							Volunteers, nonprofits, and employers each have{' '}
							<em className="italic">their own front door</em> — and the same
							shared source of truth underneath.
						</>
					),
				}}
			/>

			{/* ── Three audience journeys ── */}
			<section className="mx-auto w-full max-w-5xl px-4 py-20">
				<div className="grid gap-16 lg:grid-cols-3">
					{/* Volunteers */}
					<div>
						<div className="mb-6 flex items-center gap-3 border-b border-border pb-4">
							<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success/15">
								<Heart className="h-5 w-5 text-success-foreground" />
							</div>
							<h2 className="font-display text-2xl font-semibold text-foreground">
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
						<div className="mb-6 flex items-center gap-3 border-b border-border pb-4">
							<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
								<Building2 className="h-5 w-5 text-primary" />
							</div>
							<h2 className="font-display text-2xl font-semibold text-foreground">
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
						<div className="mb-6 flex items-center gap-3 border-b border-border pb-4">
							<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/20">
								<BarChart3 className="h-5 w-5 text-accent" />
							</div>
							<h2 className="font-display text-2xl font-semibold text-foreground">
								Employers
							</h2>
						</div>
						<StepTimeline
							steps={employerSteps}
							accentClass="bg-accent/20 text-accent"
						/>
						<div className="mt-8">
							<Button asChild variant="outline" className="rounded-full px-6">
								<TrackedLink
									href="/for/employers"
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

			{/* ── Dashboard product shot ── */}
			<ScreenshotSection
				src={MARKETING_SCREENSHOTS.dashboard.src}
				darkSrc={MARKETING_SCREENSHOTS.dashboard.darkSrc}
				alt="VolunteerReady application queue dashboard"
				caption="What your application queue looks like once the pipeline is live."
				sectionBg="sand"
				containerBg="white"
				annotations={dashboardAnnotations}
			/>

			{/* ── FAQ ── */}
			<section className="bg-background px-4 py-16">
				<FaqSection faqs={faqs} />
			</section>

			{/* ── Bottom CTA ── */}
			<CTABanner
				heading={
					<>
						Which describes{' '}
						<em className="italic text-primary-foreground/90">you?</em>
					</>
				}
				description="All paths start with a single click. No credit card, no commitment."
				actions={
					<>
						<Button
							asChild
							size="lg"
							variant="secondary"
							className="rounded-full px-8"
						>
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
							size="lg"
							variant="outline"
							className="rounded-full border-primary-foreground/30 px-8 text-primary-foreground hover:bg-primary-foreground/10"
						>
							<TrackedLink
								href="/login?callbackUrl=/app/onboarding"
								eventLabel="I run a nonprofit"
								eventPage="how-it-works"
							>
								<Building2 className="h-4 w-4" />I run a nonprofit
							</TrackedLink>
						</Button>
					</>
				}
			/>
		</div>
	);
}
