import { CalendarClock } from 'lucide-react';
import type { Metadata } from 'next';
import {
	AnnotatedScreenshot,
	type ScreenshotAnnotation,
} from '@/components/annotated-screenshot';
import { CTABanner } from '@/components/cta-banner';
import { EditorialList } from '@/components/editorial-list';
import { Eyebrow } from '@/components/eyebrow';
import { JsonLdBreadcrumb } from '@/components/json-ld-breadcrumb';
import { PlatformStatsBar } from '@/components/platform-stats-bar';
import { PublicHero } from '@/components/public-hero';
import { ScreenshotSection } from '@/components/screenshot-section';
import { TrackedLink } from '@/components/tracked-link';
import { Button } from '@/components/ui/button';
import { FOUNDER_BOOKING_URL } from '@/lib/constants';
import { MARKETING_SCREENSHOTS } from '@/lib/marketing-screenshots';

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

interface Pillar {
	heading: string;
	body: string;
	src: string;
	alt: string;
	annotations: ScreenshotAnnotation[];
}

// Marker coordinates are percentages of the 1280×720 capture frame — see the
// coordinate diagram in annotated-screenshot.tsx. Recapture via
// `pnpm screenshots` before adjusting (e2e/capture-scenarios.ts).
const pillars: Pillar[] = [
	{
		heading: 'Background checks, built in',
		body: 'Checkr and Sterling run inside the platform with full FCRA compliance. Most checks return same-day, and results are tied to the volunteer record automatically.',
		src: MARKETING_SCREENSHOTS.screener.src,
		alt: 'VolunteerReady screener admin showing volunteer application questions, including background-check consent',
		annotations: [
			{
				x: 23.5,
				y: 60,
				label:
					'Background-check consent is part of the application itself — compliance starts at the first click, not after.',
			},
			{
				x: 84.3,
				y: 43,
				label:
					'Questions toggle on and off as requirements change — the defaults ship ready for volunteer roles.',
			},
			{
				x: 85.0,
				y: 30.6,
				label:
					'Role-specific questions get added here, without rebuilding a form.',
			},
		],
	},
	{
		heading: 'Portable credentials',
		body: 'Verified badges follow volunteers between organizations. Less re-screening, faster activation, fewer applicants lost to paperwork.',
		src: MARKETING_SCREENSHOTS.credentials.src,
		alt: 'VolunteerReady credential wallet showing verified background check, orientation, and training credentials',
		annotations: [
			{
				x: 36,
				y: 50,
				label:
					'Verified credentials — background checks, orientation, training — pinned to the volunteer record.',
			},
			{
				x: 78.8,
				y: 32.2,
				label:
					'One shareable volunteer card replaces re-sending paperwork to every new organization.',
			},
			{
				x: 48.5,
				y: 94.4,
				label: 'Expiration dates flag re-screening before coverage lapses.',
			},
		],
	},
	{
		heading: 'Funder-ready reports',
		body: 'Hours, headcount, and credential status stay export-ready. When a funder, insurer, or auditor asks, the data is already organized.',
		src: MARKETING_SCREENSHOTS.impactReport.src,
		alt: 'VolunteerReady impact report showing applications, approvals, shifts, and credentials counted automatically',
		annotations: [
			{
				x: 58.6,
				y: 44,
				label:
					'Applications, approvals, and screenings are tallied as they happen — not compiled at report time.',
			},
			{
				x: 58.6,
				y: 73.3,
				label:
					'Shift and credential history accumulates into the numbers funders actually ask for.',
			},
			{
				x: 59,
				y: 23.8,
				label:
					'The report covers your whole history on the platform — no spreadsheet archaeology before a deadline.',
			},
		],
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
				src={MARKETING_SCREENSHOTS.dashboard.src}
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
					<div className="space-y-16 md:space-y-20">
						{pillars.map((pillar, index) => (
							<div
								key={pillar.heading}
								className="grid grid-cols-1 gap-8 md:grid-cols-[5fr_7fr] md:items-center md:gap-12"
							>
								<div className={index % 2 === 1 ? 'md:order-2' : undefined}>
									<div className="border-l-2 border-accent pl-6">
										<h3 className="font-display mb-2 text-2xl font-bold text-foreground [text-wrap:balance]">
											{pillar.heading}
										</h3>
										<p className="text-sm leading-relaxed text-muted-foreground">
											{pillar.body}
										</p>
									</div>
								</div>
								<div className={index % 2 === 1 ? 'md:order-1' : undefined}>
									<AnnotatedScreenshot
										src={pillar.src}
										alt={pillar.alt}
										annotations={pillar.annotations}
										frameClassName="bg-muted rounded-lg border border-border/40 shadow-sm"
										sizes="(max-width: 768px) 100vw, 600px"
									/>
								</div>
							</div>
						))}
					</div>
				</div>
			</section>

			<section className="bg-muted px-4 py-20">
				<div className="mx-auto grid max-w-[1040px] grid-cols-1 gap-12 md:grid-cols-[5fr_7fr] md:items-start">
					<div>
						<Eyebrow tone="primary" className="mb-3">
							How we&rsquo;re different
						</Eyebrow>
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
