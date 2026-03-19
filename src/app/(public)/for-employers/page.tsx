import {
	BarChart3,
	Building2,
	FileSpreadsheet,
	HandHeart,
	Shield,
	Users,
} from 'lucide-react';
import type { Metadata } from 'next';
import { CTABanner } from '@/components/cta-banner';
import { FadeInOnScroll } from '@/components/fade-in-on-scroll';
import { PublicHero } from '@/components/public-hero';
import { TrackedLink } from '@/components/tracked-link';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
	title: 'For Employers — Corporate Volunteering & ESG | VolunteerReady',
	description:
		'Track employee volunteering, partner with vetted nonprofits, and export ESG impact reports. Built for corporate CSR programs.',
	openGraph: {
		title: 'For Employers — Corporate Volunteering & ESG | VolunteerReady',
		description:
			'Track employee volunteering, partner with vetted nonprofits, and export ESG impact reports. Built for corporate CSR programs.',
	},
};

const features = [
	{
		icon: BarChart3,
		heading: 'ESG reporting dashboard',
		body: 'Aggregate volunteer hours, participation rates, and impact metrics across your entire workforce. Export CSV reports for board decks, sustainability filings, and stakeholder updates.',
	},
	{
		icon: Users,
		heading: 'Employee volunteering at scale',
		body: 'Create a branded company profile. Employees discover and sign up for opportunities through the same platform nonprofits already use — no separate app, no double entry.',
	},
	{
		icon: HandHeart,
		heading: 'Nonprofit partnership management',
		body: 'Link your company to specific nonprofits on the platform. See which organizations your employees support, track cross-org impact, and deepen community relationships.',
	},
	{
		icon: Shield,
		heading: 'Background checks included',
		body: 'Checkr-powered screening with FCRA compliance is built into the platform. Your employees get the same trusted vetting process nonprofits rely on.',
	},
	{
		icon: FileSpreadsheet,
		heading: 'CSV exports and data portability',
		body: 'Export raw data anytime — volunteer hours, credentials issued, shifts completed. Your data is yours. No lock-in, no premium export fees.',
	},
];

const differentiators = [
	{
		label: 'Not another app for employees to download',
		detail:
			'VolunteerReady is the platform nonprofits already use. Your employees join the same ecosystem — no adoption friction, no chicken-and-egg problem.',
	},
	{
		label: 'Real credentials, not self-reported hours',
		detail:
			'Volunteer hours and credentials are verified by nonprofits, not self-attested by employees. Your ESG data is audit-ready from day one.',
	},
	{
		label: 'Works for companies of any size',
		detail:
			'Whether you have 50 employees or 50,000, the platform scales. Start with a single nonprofit partnership and grow from there.',
	},
];

export default function ForEmployersPage() {
	return (
		<div className="flex flex-col">
			<PublicHero
				eyebrow="For Employers"
				heading={
					<>
						Your CSR program deserves{' '}
						<em className="italic text-primary">
							more than a spreadsheet and good intentions.
						</em>
					</>
				}
				description="Track employee volunteering, partner with vetted nonprofits, and export audit-ready ESG reports. VolunteerReady is the infrastructure your corporate social responsibility program has been missing."
				gradientClass="from-[#C4A882]/10 via-background to-primary/5"
				actions={
					<>
						<Button asChild size="lg" className="rounded-full px-8">
							<TrackedLink
								href="/login?callbackUrl=/app/onboarding"
								eventLabel="Set up your company"
								eventPage="for-employers"
							>
								<Building2 className="h-4 w-4" />
								Set up your company
							</TrackedLink>
						</Button>
						<Button
							asChild
							variant="outline"
							size="lg"
							className="rounded-full px-8"
						>
							<TrackedLink
								href="/pricing"
								eventLabel="See corporate pricing"
								eventPage="for-employers"
							>
								See pricing
							</TrackedLink>
						</Button>
					</>
				}
			/>

			{/* ── Features ── */}
			<section className="mx-auto w-full max-w-4xl px-4 py-20">
				<h2 className="font-display mb-3 text-[32px] font-bold text-foreground [text-wrap:balance]">
					Built for corporate volunteering programs
				</h2>
				<p className="mb-12 text-muted-foreground">
					From employee engagement to board-ready reporting.
				</p>
				<div className="flex flex-col gap-8">
					{features.map((f, i) => {
						const Icon = f.icon;
						return (
							<FadeInOnScroll key={f.heading} delay={i * 75}>
								<div className="flex gap-5">
									<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#C4A882]/15">
										<Icon className="h-5 w-5 text-[#8B7355]" />
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

			{/* ── Differentiators ── */}
			<section className="bg-[#F5F4F0] px-4 py-16">
				<div className="mx-auto max-w-3xl">
					<h2 className="font-display mb-10 text-[32px] font-bold text-foreground [text-wrap:balance]">
						Why VolunteerReady for corporate programs
					</h2>
					<div className="flex flex-col gap-8">
						{differentiators.map((d, i) => (
							<FadeInOnScroll key={d.label} delay={i * 75}>
								<div>
									<p className="mb-1 text-lg font-semibold text-foreground">
										{d.label}
									</p>
									<p className="text-sm leading-relaxed text-muted-foreground">
										{d.detail}
									</p>
								</div>
							</FadeInOnScroll>
						))}
					</div>
				</div>
			</section>

			<CTABanner
				icon={BarChart3}
				heading="Ready to measure your impact?"
				description="Set up your company profile and start tracking employee volunteering today."
				actions={
					<>
						<Button
							asChild
							size="lg"
							className="rounded-full bg-white px-8 text-primary hover:bg-white/90"
						>
							<TrackedLink
								href="/login?callbackUrl=/app/onboarding"
								eventLabel="Set up company (bottom CTA)"
								eventPage="for-employers"
							>
								Get started
							</TrackedLink>
						</Button>
						<Button
							asChild
							size="lg"
							variant="outline"
							className="rounded-full border-white/30 px-8 text-primary-foreground hover:bg-white/10"
						>
							<TrackedLink
								href="mailto:hello@volunteerready.com?subject=Corporate%20pricing"
								eventLabel="Contact sales"
								eventPage="for-employers"
							>
								Contact sales
							</TrackedLink>
						</Button>
					</>
				}
			/>
		</div>
	);
}
