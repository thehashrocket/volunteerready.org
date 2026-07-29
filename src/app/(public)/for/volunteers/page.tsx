import {
	Award,
	CalendarDays,
	ClipboardList,
	Heart,
	Search,
	Star,
	UserCheck,
} from 'lucide-react';
import type { Metadata } from 'next';
import { CTABanner } from '@/components/cta-banner';
import { FadeInOnScroll } from '@/components/fade-in-on-scroll';
import { FaqSection } from '@/components/faq-section';
import { JsonLdBreadcrumb } from '@/components/json-ld-breadcrumb';
import { PublicHero } from '@/components/public-hero';
import { ScreenshotSection } from '@/components/screenshot-section';
import { TrackedLink } from '@/components/tracked-link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MARKETING_SCREENSHOTS } from '@/lib/marketing-screenshots';

export const metadata: Metadata = {
	title: 'For Volunteers — VolunteerReady',
	description:
		'Find opportunities matched to your skills, earn portable credentials, track shifts, and build a verified volunteer record.',
	openGraph: {
		title: 'For Volunteers — VolunteerReady',
		description:
			'Find opportunities matched to your skills, earn portable credentials, track shifts, and build a verified volunteer record.',
		images: ['/api/og/page/for-volunteers'],
	},
};

const benefits = [
	{
		icon: Search,
		heading: 'Matched to your skills, not random listings',
		body: 'Our matching engine connects you with opportunities based on your verified skills, location, and availability — not guesswork or keyword search.',
	},
	{
		icon: ClipboardList,
		heading: 'Apply in minutes, not hours',
		body: 'Each organization customizes a short screening form so they can find the right fit — and so can you. No lengthy paperwork, no confusing portals.',
	},
	{
		icon: Award,
		heading: 'Get screened once. Use it everywhere.',
		body: 'Done with redoing the same background check every time you try a new organization? Your verified badges — background check cleared, training complete, orientation done — travel across every org on the platform. Build your record once, carry it everywhere.',
	},
	{
		icon: CalendarDays,
		heading: 'Sign up for shifts and track attendance',
		body: 'Browse available shifts, sign up with one click, and check in when you arrive. Your hours are logged automatically — no more paper timesheets.',
	},
	{
		icon: UserCheck,
		heading: 'Your complete volunteer profile',
		body: 'Skills, certifications, availability, and service history — all in one place. Organizations see your verified record. You own your data.',
	},
];

const steps = [
	{
		number: '01',
		label: 'Create your profile',
		detail:
			'Add your skills, interests, and availability so our matching engine can find the best opportunities for you.',
	},
	{
		number: '02',
		label: 'Get matched or browse',
		detail:
			'We surface opportunities that fit your profile. You can also browse all listings and filter by cause, location, and schedule.',
	},
	{
		number: '03',
		label: 'Apply and get screened',
		detail:
			'Complete a focused screening form — usually under five minutes. Background checks happen seamlessly if required.',
	},
	{
		number: '04',
		label: 'Show up and earn credentials',
		detail:
			'Sign up for shifts, log attendance, and earn verified badges. Your volunteer record grows with every organization you serve.',
	},
];

const volunteerFaqs = [
	{
		question: 'Is VolunteerReady free for volunteers?',
		answer:
			"Yes, always. There's no cost to create a profile, apply to opportunities, track your hours, or earn credentials.",
	},
	{
		question: 'How does matching work?',
		answer:
			'Our matching engine evaluates your verified skills, certifications, location, and availability against opportunity requirements. It surfaces the best-fit opportunities for you automatically.',
	},
	{
		question: 'What are portable credentials?',
		answer:
			'Verified badges — like background check cleared, training complete, or orientation done — that travel with you across every organization on the platform. Apply once, carry everywhere.',
	},
	{
		question: 'Can I volunteer with multiple organizations?',
		answer:
			"Absolutely. Your profile and credentials are portable — apply to as many organizations as you'd like from a single dashboard. Leaving is just as easy: your profile lists every organization that can see you, and you can remove any of them at any time.",
	},
	{
		question: 'How do I leave an organization?',
		answer:
			"Open your profile, find the organization under \"Organizations you volunteer with,\" and confirm Leave. It takes effect right away — they can no longer open your volunteer record, schedule you, or request a background check, and they can't add you back. Two exceptions: a profile you've set to Public stays visible to everyone until you change your profile visibility, and if you're also on that organization's staff, leaving its volunteer roster doesn't touch your staff access. You can rejoin any time by signing in and applying, or by signing up for one of their shifts.",
	},
	{
		question: 'Does leaving delete my history with them?',
		answer:
			"No. Your application and the hours you volunteered stay on their account — leaving revokes their access going forward, it isn't a deletion request. Shifts you're already booked on also stay booked, and they can still record whether you turned up, so cancel those yourself if you're not going. To have records deleted rather than made inaccessible, email privacy@volunteerready.org.",
	},
	{
		question: 'I applied before I had an account. Can I still track it?',
		answer:
			'Yes. Sign in with the same email you applied with, and the application shows up on your My Applications page asking whether it\'s yours. Confirm and it attaches to your account so you can follow its status; choose "Not mine" if you don\'t recognize it. We never attach an application to your account without you saying so.',
	},
	{
		question: 'How do I track my hours?',
		answer:
			'Sign up for shifts and check in when you arrive. Your hours are logged automatically and tied to your volunteer profile — no paper timesheets.',
	},
	{
		question: 'What if I need a background check?',
		answer:
			'If an organization requires one, the background check runs seamlessly within the screening process. Results become a portable credential you can use across the platform.',
	},
];

export default function ForVolunteersPage() {
	return (
		<div className="flex flex-col">
			<JsonLdBreadcrumb
				items={[
					{ label: 'Home', href: '/' },
					{ label: 'For Volunteers', href: '/for/volunteers' },
				]}
			/>
			<PublicHero
				eyebrow="For Volunteers"
				heading={
					<>
						Your time is a gift.{' '}
						<em className="italic text-primary">
							We help it land where it matters.
						</em>
					</>
				}
				description="Stop sifting through outdated listings, chasing unanswered emails, and redoing the same background check every time you try somewhere new. VolunteerReady matches you with opportunities that fit — and your verified record travels with you."
				actions={
					<>
						<Button asChild size="lg" className="rounded-full px-8">
							<TrackedLink
								href="/login?callbackUrl=/app/my-applications"
								eventLabel="Start volunteering"
								eventPage="for-volunteers"
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
								href="/how-it-works"
								eventLabel="See how it works"
								eventPage="for-volunteers"
							>
								See how it works
							</TrackedLink>
						</Button>
					</>
				}
			/>

			{/* ── Benefits ── */}
			<FadeInOnScroll>
				<section className="mx-auto w-full max-w-4xl px-4 py-20">
					<h2 className="font-display mb-3 text-[32px] font-bold text-foreground [text-wrap:balance]">
						Everything you need to give your best
					</h2>
					<p className="mb-12 text-muted-foreground">
						From discovery to verified service record — here's what you get.
					</p>
					<div className="flex flex-col gap-8">
						{benefits.map((b) => {
							const Icon = b.icon;
							return (
								<div key={b.heading} className="flex gap-5">
									<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
										<Icon className="h-5 w-5 text-primary" />
									</div>
									<div>
										<p className="mb-1 text-lg font-semibold text-foreground">
											{b.heading}
										</p>
										<p className="text-sm leading-relaxed text-muted-foreground">
											{b.body}
										</p>
									</div>
								</div>
							);
						})}
					</div>
				</section>
			</FadeInOnScroll>

			{/* ── Journey steps ── */}
			<section className="bg-muted px-4 py-16">
				<div className="mx-auto max-w-3xl">
					<h2 className="font-display mb-2 text-center text-[32px] font-bold text-foreground [text-wrap:balance]">
						Your volunteer journey
					</h2>
					<p className="mb-10 text-center text-muted-foreground">
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

			{/* ── Screenshot ── */}
			{/* Marker coordinates are % of the 1280×720 capture — recapture via
			    `pnpm screenshots` before adjusting (e2e/capture-scenarios.ts) */}
			<ScreenshotSection
				src={MARKETING_SCREENSHOTS.profile.src}
				darkSrc={MARKETING_SCREENSHOTS.profile.darkSrc}
				alt="VolunteerReady volunteer profile showing profile completeness, verified credentials, and the list of organizations that can see you"
				caption="Your volunteer profile — portable credentials and a running list of every organization that can see you. Leave any of them yourself, no email and no support ticket."
				sectionBg="white"
				containerBg="sand"
				annotations={[
					{
						x: 59.9,
						y: 36.7,
						label:
							'Complete your profile once — every organization you apply to sees what it needs.',
					},
					{
						x: 69.4,
						y: 54.7,
						label:
							'Verified credentials are counted here and travel with you between organizations.',
					},
					{
						x: 58.7,
						y: 70.1,
						label:
							'The credential wallet: shareable proof of screening, orientation, and training.',
					},
					{
						// Sits just past the end of the "Organizations you volunteer
						// with" heading (which runs to ~x=693 of the 1280 frame), not on
						// it — at 34.8 the dot covered the leading "Or" and the heading
						// read "ganizations you volunteer with".
						x: 56.0,
						y: 81.9,
						label:
							'Every organization that can see you, in one list — leave any of them and their access is revoked for good.',
					},
				]}
			/>

			{/* ── Testimonial ── */}
			<section className="mx-auto w-full max-w-2xl px-4 py-20">
				<FadeInOnScroll>
					<Card className="border-border/70">
						<CardContent className="px-8 py-8">
							<Star className="mb-4 h-5 w-5 text-accent" />
							<blockquote className="text-lg leading-relaxed text-foreground">
								"I'd tried to get involved with three different shelters over
								the years. Each time I hit a wall — no response, confusing
								paperwork, or roles that didn't match my skills. VolunteerReady
								actually worked. I applied on a Tuesday and was in orientation
								by Friday."
							</blockquote>
							<div className="mt-5 flex items-center gap-3">
								<div className="flex h-9 w-9 items-center justify-center rounded-full bg-success/15 text-sm font-bold text-success-foreground">
									DL
								</div>
								<div>
									<p className="text-sm font-semibold text-foreground">
										Dana L.
									</p>
									<p className="text-xs text-muted-foreground">
										Volunteer since 2024 · Seattle, WA
									</p>
								</div>
							</div>
						</CardContent>
					</Card>
				</FadeInOnScroll>
				<p className="mt-4 text-center text-sm text-muted-foreground/60">
					More stories coming soon
				</p>
			</section>

			{/* ── FAQ ── */}
			<section className="bg-muted px-4 py-16">
				<FaqSection faqs={volunteerFaqs} />
			</section>

			<CTABanner
				icon={Heart}
				heading="Ready to make your move?"
				description="Create a free account and start exploring opportunities matched to your skills. No credit card required."
				actions={
					<Button
						asChild
						size="lg"
						className="rounded-full bg-white px-8 text-primary hover:bg-white/90"
					>
						<TrackedLink
							href="/login?callbackUrl=/app/my-applications"
							eventLabel="Sign in (bottom CTA)"
							eventPage="for-volunteers"
						>
							Sign in to get started
						</TrackedLink>
					</Button>
				}
			/>
		</div>
	);
}
