import { CalendarClock } from 'lucide-react';
import type { Metadata } from 'next';
import { CTABanner } from '@/components/cta-banner';
import { EditorialList } from '@/components/editorial-list';
import { JsonLdBreadcrumb } from '@/components/json-ld-breadcrumb';
import { PlatformStatsBar } from '@/components/platform-stats-bar';
import { PublicHero } from '@/components/public-hero';
import { ScreenshotSection } from '@/components/screenshot-section';
import { TrackedLink } from '@/components/tracked-link';
import { Button } from '@/components/ui/button';
import { FOUNDER_BOOKING_URL } from '@/lib/constants';

export const revalidate = 3600;

export const metadata: Metadata = {
	title: 'VolunteerReady — Trusted Infrastructure for Volunteer Engagement',
	description:
		'Screen, credential, match, and schedule volunteers with the platform that nonprofits, corporations, and volunteers trust.',
	openGraph: {
		title: 'VolunteerReady — Trusted Infrastructure for Volunteer Engagement',
		description:
			'Screen, credential, match, and schedule volunteers with the platform that nonprofits, corporations, and volunteers trust.',
		images: ['/api/og/page/home'],
	},
};

const pillars = [
	{
		heading: 'Background checks, built in',
		body: 'Checkr and Sterling run inside the platform with full FCRA compliance. Most checks return same-day, and results are tied to the volunteer record automatically.',
	},
	{
		heading: 'Portable credentials',
		body: 'Verified badges follow volunteers between organizations. Less re-screening, faster activation, fewer applicants lost to paperwork.',
	},
	{
		heading: 'Funder-ready reports',
		body: 'Hours, headcount, and credential status stay export-ready. When a funder, insurer, or auditor asks, the data is already organized.',
	},
];

const differentiators = [
	{
		heading: 'Founder-led setup',
		body: 'Our founder personally onboards every organization. No ticket queue, no chatbot — a real conversation about what you need.',
	},
	{
		heading: 'Grant-ready by default',
		body: 'Volunteer hours, headcount, and credential status are always documented and exportable. No more compiling data from paper sign-in sheets the week before a funder report is due.',
	},
	{
		heading: 'Real-time platform data',
		body: 'Live stats from real organizations, not vanity numbers. Every metric you see on this site comes from production data.',
	},
];

export default async function Home() {
	return (
		<div className="flex flex-col">
			<JsonLdBreadcrumb items={[{ label: 'Home', href: '/' }]} />
			<PublicHero
				eyebrow="VolunteerReady"
				heading={
					<>
						The platform where credentials{' '}
						<em className="italic text-primary">travel with you.</em>
					</>
				}
				description="If your grant requires it, your funder expects it, or your insurer mandates it — VolunteerReady makes volunteer compliance easier. Screen volunteers, run background checks, track credentials, and document hours for funder reporting, all in one place."
				actions={
					<>
						<Button asChild size="lg" className="rounded-full px-8">
							<TrackedLink
								href={FOUNDER_BOOKING_URL}
								eventLabel="Book a setup call (hero)"
								eventPage="homepage"
								target="_blank"
								rel="noopener noreferrer"
							>
								<CalendarClock className="h-4 w-4" />
								Book a setup call
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
								eventLabel="See how it works (hero)"
								eventPage="homepage"
							>
								See how it works
							</TrackedLink>
						</Button>
					</>
				}
				side={{
					label: 'What makes it work',
					note: (
						<>
							Background checks, credential records, and hour logs stay{' '}
							<em className="italic">always export-ready</em>. When a funder
							asks, the data is already organized.
						</>
					),
				}}
			/>

			<ScreenshotSection
				src="/marketing/dashboard.png"
				alt="VolunteerReady dashboard showing volunteer roster, credential status, and shift coverage"
				caption="The dashboard coordinators open every morning."
				priority
			/>

			<PlatformStatsBar />

			<section className="bg-background px-4 py-20">
				<div className="mx-auto max-w-[1040px]">
					<h2 className="font-display mb-3 text-[32px] font-bold leading-tight text-foreground [text-wrap:balance]">
						What it does, day to day
					</h2>
					<p className="mb-12 max-w-2xl text-muted-foreground">
						Three things every volunteer coordinator needs to stop worrying
						about — and the funder reports that follow from them.
					</p>
					<EditorialList items={pillars} />
				</div>
			</section>

			<section className="bg-muted px-4 py-20">
				<div className="mx-auto grid max-w-[1040px] grid-cols-1 gap-12 md:grid-cols-[5fr_7fr] md:items-start">
					<div>
						<p className="mb-3 font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
							How we&rsquo;re different
						</p>
						<h2 className="font-display text-[32px] font-bold leading-tight text-foreground [text-wrap:balance]">
							Three things you won&rsquo;t find in the rest of the category.
						</h2>
					</div>
					<EditorialList items={differentiators} />
				</div>
			</section>

			<CTABanner
				icon={CalendarClock}
				heading="Set up your org in one call"
				description="Coordinators get a guided walkthrough — pricing, screening, scheduling, all explained. No demo loop, no sales pitch."
				actions={
					<>
						<Button
							asChild
							size="lg"
							className="rounded-full bg-white px-8 text-primary hover:bg-white/90"
						>
							<TrackedLink
								href={FOUNDER_BOOKING_URL}
								eventLabel="Book a setup call (bottom CTA)"
								eventPage="homepage"
								target="_blank"
								rel="noopener noreferrer"
							>
								Book a setup call
							</TrackedLink>
						</Button>
						<Button
							asChild
							size="lg"
							variant="outline"
							className="rounded-full border-white/30 bg-transparent px-8 text-white hover:bg-white/10"
						>
							<TrackedLink
								href="/how-it-works"
								eventLabel="See how it works (bottom CTA)"
								eventPage="homepage"
							>
								See how it works
							</TrackedLink>
						</Button>
					</>
				}
			/>
		</div>
	);
}
