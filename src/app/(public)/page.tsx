import { CalendarClock, Check } from 'lucide-react';
import type { Metadata } from 'next';
import {
	AnnotatedScreenshot,
	type ScreenshotAnnotation,
} from '@/components/annotated-screenshot';
import { CTABanner } from '@/components/cta-banner';
import { EditorialList } from '@/components/editorial-list';
import { Eyebrow } from '@/components/eyebrow';
import { JsonLdBreadcrumb } from '@/components/json-ld-breadcrumb';
import { PublicHero } from '@/components/public-hero';
import { ScreenshotSection } from '@/components/screenshot-section';
import { TrackedLink } from '@/components/tracked-link';
import { Button } from '@/components/ui/button';
import { FOUNDER_BOOKING_URL } from '@/lib/constants';
import { MARKETING_SCREENSHOTS } from '@/lib/marketing-screenshots';

export const revalidate = 3600;

const META_TITLE =
	'VolunteerReady — Volunteer Hours, Screening & Funder Reports for Nonprofits';
const META_DESCRIPTION =
	'Schedule shifts, check volunteers in, screen applicants, run background checks, and keep the numbers your funders, insurers, and auditors ask for — in one place.';

export const metadata: Metadata = {
	title: META_TITLE,
	description: META_DESCRIPTION,
	openGraph: {
		title: META_TITLE,
		description: META_DESCRIPTION,
		images: ['/api/og/page/home'],
	},
};

interface PillarScreenshot {
	src: string;
	darkSrc?: string;
	alt: string;
	annotations: ScreenshotAnnotation[];
}

interface Pillar {
	heading: string;
	body: string;
	/** A pillar renders its screenshot when it has one, its checklist otherwise. */
	screenshot?: PillarScreenshot;
	checklist?: string[];
}

// Marker coordinates are percentages of the 1280×720 capture frame — see the
// coordinate diagram in annotated-screenshot.tsx. Recapture via
// `pnpm screenshots` before adjusting (e2e/capture-scenarios.ts).
//
// Order is deliberate: reporting first, day-to-day management second,
// screening third. The site sells running a volunteer program, not finding
// volunteers — keep matching and portable credentials out of the lead.
const pillars: Pillar[] = [
	{
		heading: 'Funder-ready reports',
		body: 'Volunteer hours, applications, background checks, shifts, and credentials are counted as they happen. When a funder, insurer, or auditor asks, the numbers already exist — no spreadsheet archaeology the week a report is due.',
		screenshot: {
			src: MARKETING_SCREENSHOTS.impactReport.src,
			darkSrc: MARKETING_SCREENSHOTS.impactReport.darkSrc,
			alt: 'VolunteerReady impact report showing volunteer hours served, applications, approvals, background checks, volunteers onboarded, shifts, and credentials counted automatically',
			annotations: [
				{
					x: 58.6,
					y: 38.9,
					label:
						'Volunteer hours roll up from shift check-ins — the first number most funders ask for.',
				},
				{
					x: 58.6,
					y: 61,
					label:
						'Applications, approvals, and background checks are tallied as they happen — not compiled at report time.',
				},
				{
					x: 58.6,
					y: 75.7,
					label:
						'Shift and credential history accumulates into the numbers funders actually ask for.',
				},
			],
		},
	},
	{
		heading: 'Shifts, check-ins, and hours',
		body: 'Create shifts, let volunteers sign up, and check them in at the door. Attendance becomes recorded hours on each volunteer’s record, so the clipboard sign-in sheet can retire.',
		checklist: [
			'Shift scheduling with capacity limits',
			'Volunteers sign themselves up',
			'QR check-in at the door',
			'Attendance recorded as volunteer hours',
			'Reusable shift templates (Starter plan)',
		],
	},
	{
		heading: 'Screening and background checks',
		body: 'Custom screening questions with consent built into the application. Checkr and Sterling background checks run inside the platform with FCRA workflows, and credential expiration dates flag re-screening before coverage lapses.',
		screenshot: {
			src: MARKETING_SCREENSHOTS.screener.src,
			darkSrc: MARKETING_SCREENSHOTS.screener.darkSrc,
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
			],
		},
	},
];

const painPoints = [
	{
		heading: 'Clearances in a spreadsheet',
		body: 'Your grant requires background checks, and the only record of who’s cleared is a tab someone last updated in March.',
	},
	{
		heading: 'Hours on a clipboard',
		body: 'Paper sign-in sheets, a shared inbox, and a group text are your volunteer management system. Totaling them is a weekend project.',
	},
	{
		heading: 'A report due Friday',
		body: 'The funder wants hours, headcount, and screening status. You know the work happened. Proving it is the hard part.',
	},
];

const differentiators = [
	{
		heading: 'Founder-led setup',
		body: 'Our founder personally onboards every organization. No ticket queue, no chatbot — a real conversation about what you need.',
	},
	{
		heading: 'Records as you go',
		body: 'Hours, headcount, and screening status are captured as part of the daily workflow, so reporting is a lookup instead of a project.',
	},
	{
		heading: 'Built by volunteers',
		body: 'We’ve spent decades volunteering at food banks and animal rescues. VolunteerReady is built around what coordinators actually deal with.',
	},
];

function PillarChecklist({ items }: { items: string[] }) {
	return (
		<ul className="space-y-3 rounded-lg border border-border/40 bg-muted p-6 shadow-sm sm:p-8">
			{items.map((item) => (
				<li
					key={item}
					className="flex items-start gap-3 text-base text-foreground"
				>
					<span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
						<Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
					</span>
					{item}
				</li>
			))}
		</ul>
	);
}

export default async function Home() {
	return (
		<div className="flex flex-col">
			<JsonLdBreadcrumb items={[{ label: 'Home', href: '/' }]} />
			<PublicHero
				eyebrow="For volunteer coordinators"
				heading={
					<>
						Your next funder report,{' '}
						<em className="italic text-primary">already done.</em>
					</>
				}
				description="If your grant requires it, your funder expects it, or your insurer mandates it, VolunteerReady keeps the record as you go. Schedule shifts, check volunteers in, screen and background-check applicants, and pull the numbers when someone asks."
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
							Every check-in, screening, and credential is recorded when it
							happens, so a report is{' '}
							<em className="italic">a lookup, not a project</em>.
						</>
					),
				}}
			/>

			<ScreenshotSection
				src={MARKETING_SCREENSHOTS.applicationsQueue.src}
				alt="VolunteerReady applications queue showing each applicant's status, screening result, and flags"
				caption="Every application, screening result, and flag in one queue. (Sample data.)"
				priority
			/>

			<section className="bg-muted px-4 py-16">
				<div className="mx-auto max-w-[1040px]">
					<Eyebrow tone="primary" className="mb-3">
						Sound familiar?
					</Eyebrow>
					<h2 className="font-display mb-10 max-w-2xl text-[32px] font-bold leading-tight text-foreground [text-wrap:balance]">
						The work happened. Proving it shouldn’t take a weekend.
					</h2>
					<div className="grid gap-8 md:grid-cols-3">
						{painPoints.map((point) => (
							<div
								key={point.heading}
								className="border-l-2 border-accent pl-5"
							>
								<h3 className="font-display mb-2 text-xl font-bold text-foreground">
									{point.heading}
								</h3>
								<p className="text-base leading-relaxed text-muted-foreground">
									{point.body}
								</p>
							</div>
						))}
					</div>
				</div>
			</section>

			<section className="bg-background px-4 py-24">
				<div className="mx-auto max-w-[1040px]">
					<h2 className="font-display mb-3 text-[32px] font-bold leading-tight text-foreground [text-wrap:balance]">
						What it does, day to day
					</h2>
					<p className="mb-12 max-w-2xl text-base text-muted-foreground">
						Run the program, and the reporting takes care of itself.
					</p>
					<div className="space-y-16 md:space-y-20">
						{pillars.map((pillar, index) => (
							<div
								key={pillar.heading}
								className="grid grid-cols-1 gap-8 md:grid-cols-[5fr_7fr] md:items-start md:gap-12"
							>
								<div className={index % 2 === 1 ? 'md:order-2' : undefined}>
									<div className="border-l-2 border-accent pl-6">
										<h3 className="font-display mb-2 text-2xl font-bold text-foreground [text-wrap:balance]">
											{pillar.heading}
										</h3>
										<p className="text-base leading-relaxed text-muted-foreground">
											{pillar.body}
										</p>
									</div>
								</div>
								<div className={index % 2 === 1 ? 'md:order-1' : undefined}>
									{pillar.screenshot ? (
										<AnnotatedScreenshot
											src={pillar.screenshot.src}
											darkSrc={pillar.screenshot.darkSrc}
											alt={pillar.screenshot.alt}
											annotations={pillar.screenshot.annotations}
											frameClassName="bg-muted rounded-lg border border-border/40 shadow-sm"
											sizes="(max-width: 768px) 100vw, 600px"
										/>
									) : pillar.checklist ? (
										<PillarChecklist items={pillar.checklist} />
									) : null}
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
							Small-nonprofit software, built by people who&rsquo;ve stood at
							the sign-in table.
						</h2>
					</div>
					<EditorialList items={differentiators} />
				</div>
			</section>

			<CTABanner
				icon={CalendarClock}
				heading="Set up your org in one call"
				description="Coordinators get a guided walkthrough — scheduling, check-ins, screening, and reporting, all explained. No demo loop, no sales pitch."
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
