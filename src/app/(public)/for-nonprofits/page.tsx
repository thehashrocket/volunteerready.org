import {
	Award,
	Building2,
	CalendarDays,
	ClipboardList,
	Clock,
	HandHeart,
	Shield,
	Star,
	Users,
} from 'lucide-react';
import type { Metadata } from 'next';
import { CTABanner } from '@/components/cta-banner';
import { FadeInOnScroll } from '@/components/fade-in-on-scroll';
import { PublicHero } from '@/components/public-hero';
import { TrackedLink } from '@/components/tracked-link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export const metadata: Metadata = {
	title: 'For Nonprofits — VolunteerReady',
	description:
		'Screen applicants, run FCRA-compliant background checks, schedule shifts, and issue portable credentials — all in one platform.',
	openGraph: {
		title: 'For Nonprofits — VolunteerReady',
		description:
			'Screen applicants, run FCRA-compliant background checks, schedule shifts, and issue portable credentials — all in one platform.',
	},
};

const features = [
	{
		icon: ClipboardList,
		heading: 'Smart screening with auto-pass/fail rules',
		body: 'Build custom screening questionnaires. VolunteerReady evaluates answers against your rules and surfaces qualified candidates automatically — so you spend time on the right applicants.',
	},
	{
		icon: Shield,
		heading: 'FCRA-compliant background checks',
		body: 'Checkr-powered screening built in — not bolted on. Full adverse action workflow, encrypted tokens, and audit trails. Protect your organization and the people you serve.',
	},
	{
		icon: CalendarDays,
		heading: 'Shift scheduling and attendance',
		body: 'Create shifts, set capacity, let volunteers sign up directly. Track who showed up and mark attendance with one click. No more coordinating via group texts.',
	},
	{
		icon: Award,
		heading: 'Issue portable credentials',
		body: 'Grant verified badges for background checks, orientation, training, and ID verification. Credentials travel with volunteers across every organization on the platform.',
	},
	{
		icon: Users,
		heading: 'Team management and audit logging',
		body: 'Invite staff with role-based access. Every action — approvals, rejections, credential changes — is logged with timestamps and attribution.',
	},
];

const outcomes = [
	{
		icon: Clock,
		heading: 'Hours saved',
		body: "Automated screening and online scheduling eliminate the back-and-forth that eats your staff's time.",
	},
	{
		icon: HandHeart,
		heading: 'Fewer no-shows',
		body: 'Qualified volunteers who went through a real screening process are more committed to showing up.',
	},
	{
		icon: Building2,
		heading: 'Deeper relationships',
		body: 'A clear volunteer record — applications, shifts, credentials — means you know who your most reliable people are.',
	},
];

export default function ForNonprofitsPage() {
	return (
		<div className="flex flex-col">
			<PublicHero
				eyebrow="For Nonprofits"
				heading={
					<>
						Your mission is too important to manage{' '}
						<em className="italic text-primary">from a spreadsheet.</em>
					</>
				}
				description="VolunteerReady gives your organization everything it needs to recruit, screen, background check, schedule, and credential volunteers — all in one place."
				actions={
					<>
						<Button asChild size="lg" className="rounded-full px-8">
							<TrackedLink
								href="/login?callbackUrl=/app/onboarding"
								eventLabel="Set up your organization"
								eventPage="for-nonprofits"
							>
								<Building2 className="h-4 w-4" />
								Set up your organization
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
								eventPage="for-nonprofits"
							>
								See how it works
							</TrackedLink>
						</Button>
					</>
				}
			/>

			{/* ── Pain acknowledgment ── */}
			<section className="bg-[#F5F4F0] px-4 py-14">
				<div className="mx-auto max-w-2xl">
					<h2 className="font-display mb-4 text-2xl font-bold text-foreground [text-wrap:balance]">
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
			<section className="mx-auto w-full max-w-4xl px-4 py-20">
				<h2 className="font-display mb-3 text-[32px] font-bold text-foreground [text-wrap:balance]">
					Built for the way nonprofits actually work
				</h2>
				<p className="mb-12 text-muted-foreground">
					Everything from intake to compliance — without switching tools.
				</p>
				<div className="flex flex-col gap-8">
					{features.map((f, i) => {
						const Icon = f.icon;
						return (
							<FadeInOnScroll key={f.heading} delay={i * 75}>
								<div className="flex gap-5">
									<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
										<Icon className="h-5 w-5 text-primary" />
									</div>
									<div>
										<p className="mb-1 text-lg font-semibold text-foreground">
											{f.heading}
										</p>
										<p className="text-sm leading-relaxed text-muted-foreground">
											{f.body}
										</p>
									</div>
								</div>
							</FadeInOnScroll>
						);
					})}
				</div>
			</section>

			{/* ── Outcomes ── */}
			<section className="bg-[#F5F4F0] px-4 py-16">
				<div className="mx-auto max-w-3xl">
					<h2 className="font-display mb-10 text-center text-[32px] font-bold text-foreground [text-wrap:balance]">
						What you get back
					</h2>
					<div className="grid gap-10 sm:grid-cols-3">
						{outcomes.map((o, i) => {
							const Icon = o.icon;
							return (
								<FadeInOnScroll key={o.heading} delay={i * 75}>
									<div>
										<div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
											<Icon className="h-5 w-5 text-primary" />
										</div>
										<h3 className="mb-1 font-semibold text-foreground [text-wrap:balance]">
											{o.heading}
										</h3>
										<p className="text-sm leading-relaxed text-muted-foreground">
											{o.body}
										</p>
									</div>
								</FadeInOnScroll>
							);
						})}
					</div>
				</div>
			</section>

			{/* ── Testimonial ── */}
			<section className="mx-auto w-full max-w-2xl px-4 py-20">
				<FadeInOnScroll>
					<Card className="border-border/70">
						<CardContent className="px-8 py-8">
							<Star className="mb-4 h-5 w-5 text-[#C4A882]" />
							<blockquote className="text-lg leading-relaxed text-foreground">
								"Before VolunteerReady, our coordinator was spending 12+ hours a
								week just on intake and scheduling. Now we can focus that time
								on actually training and supporting volunteers. The smart
								screening alone saved us from placing three unqualified
								candidates in sensitive roles."
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
				</FadeInOnScroll>
			</section>

			<CTABanner
				icon={Building2}
				heading="Ready to build your volunteer team?"
				description="Set up your organization in minutes. No contract, no credit card required to get started."
				actions={
					<Button
						asChild
						size="lg"
						className="rounded-full bg-white px-8 text-primary hover:bg-white/90"
					>
						<TrackedLink
							href="/login?callbackUrl=/app/onboarding"
							eventLabel="Set up org (bottom CTA)"
							eventPage="for-nonprofits"
						>
							Set up your organization
						</TrackedLink>
					</Button>
				}
			/>
		</div>
	);
}
