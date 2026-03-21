import { Shield } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { CTABanner } from '@/components/cta-banner';
import { FadeInOnScroll } from '@/components/fade-in-on-scroll';
import { TrackedLink } from '@/components/tracked-link';
import { Button } from '@/components/ui/button';
import { prisma } from '@/server/repositories/prisma';
import { getCaseStudy } from '@/server/services/caseStudyService';

type Props = { params: Promise<{ orgSlug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { orgSlug } = await params;
	const org = await prisma.organization.findUnique({
		where: { slug: orgSlug },
		select: { name: true, consentToPublicize: true },
	});

	if (!org || !org.consentToPublicize) {
		return { title: 'Story not found — VolunteerReady' };
	}

	return {
		title: `${org.name} — VolunteerReady Impact Story`,
		description: `See how ${org.name} transformed their volunteer management with VolunteerReady.`,
	};
}

export default async function StoryPage({ params }: Props) {
	const { orgSlug } = await params;
	const org = await prisma.organization.findUnique({
		where: { slug: orgSlug },
		select: { id: true, consentToPublicize: true },
	});

	if (!org || !org.consentToPublicize) notFound();

	const data = await getCaseStudy(org.id);
	if (!data) notFound();

	const savedHours = data.baseline?.hoursPerWeek
		? Math.max(0, Math.round(data.baseline.hoursPerWeek * 0.6))
		: null;

	const retentionPct =
		data.retention && data.retention.activeVolunteers > 0
			? Math.round(
					(data.retention.returningVolunteers /
						data.retention.activeVolunteers) *
						100,
				)
			: null;

	return (
		<div className="flex flex-col">
			{/* ── Hero banner ── */}
			<section className="bg-[#F5F4F0] px-4 py-20 md:py-24">
				<div className="mx-auto max-w-2xl">
					{data.logoUrl && (
						<Image
							src={data.logoUrl}
							alt={`${data.orgName} logo`}
							width={128}
							height={64}
							className="mb-4 h-16 w-auto"
							unoptimized
						/>
					)}
					<h1 className="font-display text-[32px] font-bold text-[#1B3C2A] md:text-5xl">
						{data.orgName}
					</h1>
					<p className="mt-2 text-base text-[#787571]">
						{data.daysOnPlatform} days with VolunteerReady
					</p>

					{data.pullQuote && (
						<FadeInOnScroll delay={75}>
							<blockquote className="mt-8 border-l-4 border-[#C4A882] pl-4">
								<p className="text-lg italic text-[#252422]">
									&ldquo;{data.pullQuote}&rdquo;
								</p>
								<footer className="mt-2 text-sm font-semibold text-[#787571]">
									— {data.orgName}
								</footer>
							</blockquote>
						</FadeInOnScroll>
					)}
				</div>
			</section>

			{/* ── Before / After ── */}
			<section className="px-4 py-20">
				<div className="mx-auto grid max-w-2xl gap-12 md:grid-cols-2">
					{data.baseline && (
						<div>
							<p className="mb-4 text-xs font-semibold uppercase tracking-widest text-[#787571]">
								Before
							</p>
							<dl className="space-y-3">
								{data.baseline.volunteerCount != null && (
									<div>
										<dt className="text-xs font-semibold uppercase tracking-widest text-[#787571]">
											Volunteers managed
										</dt>
										<dd className="font-display text-[32px] font-bold text-[#252422]">
											{data.baseline.volunteerCount}
										</dd>
									</div>
								)}
								{data.baseline.hoursPerWeek != null && (
									<div>
										<dt className="text-xs font-semibold uppercase tracking-widest text-[#787571]">
											Admin hours/week
										</dt>
										<dd className="font-display text-[32px] font-bold text-[#252422]">
											{data.baseline.hoursPerWeek}
										</dd>
									</div>
								)}
								{data.baseline.currentProcess && (
									<div>
										<dt className="text-xs font-semibold uppercase tracking-widest text-[#787571]">
											Process
										</dt>
										<dd className="text-base text-[#3D3B38]">
											{data.baseline.currentProcess}
										</dd>
									</div>
								)}
							</dl>
						</div>
					)}

					<div>
						<p className="mb-4 text-xs font-semibold uppercase tracking-widest text-[#787571]">
							With VolunteerReady
						</p>
						<dl className="space-y-3">
							<div>
								<dt className="text-xs font-semibold uppercase tracking-widest text-[#787571]">
									Applications processed
								</dt>
								<dd className="font-display text-[32px] font-bold text-[#252422]">
									{data.summary.applicationsSubmitted}
								</dd>
							</div>
							<div>
								<dt className="text-xs font-semibold uppercase tracking-widest text-[#787571]">
									Volunteers approved
								</dt>
								<dd className="font-display text-[32px] font-bold text-[#252422]">
									{data.summary.applicationsApproved}
								</dd>
							</div>
							<div>
								<dt className="text-xs font-semibold uppercase tracking-widest text-[#787571]">
									Background checks
								</dt>
								<dd className="font-display text-[32px] font-bold text-[#252422]">
									{data.summary.backgroundChecksCompleted}
								</dd>
							</div>
							<div>
								<dt className="text-xs font-semibold uppercase tracking-widest text-[#787571]">
									Credentials issued
								</dt>
								<dd className="font-display text-[32px] font-bold text-[#252422]">
									{data.summary.credentialsIssued}
								</dd>
							</div>
						</dl>
					</div>
				</div>
			</section>

			{/* ── Impact metrics row ── */}
			<section className="bg-[#F5F4F0] px-4 py-16">
				<div className="mx-auto flex max-w-2xl flex-wrap items-start gap-8 md:gap-12">
					{retentionPct !== null ? (
						<div>
							<p className="font-display text-2xl font-bold tabular-nums text-[#252422]">
								{retentionPct}%
							</p>
							<p className="text-sm text-[#787571]">Volunteer retention</p>
						</div>
					) : (
						data.daysOnPlatform < 90 && (
							<div>
								<p className="text-sm italic text-[#787571]">
									Not enough data yet
								</p>
								<p className="text-sm text-[#787571]">Volunteer retention</p>
							</div>
						)
					)}
					{data.avgFillRate > 0 && (
						<div>
							<p className="font-display text-2xl font-bold tabular-nums text-[#252422]">
								{data.avgFillRate}%
							</p>
							<p className="text-sm text-[#787571]">Shift fill rate</p>
						</div>
					)}
					{savedHours !== null && (
						<div>
							<p className="font-display text-2xl font-bold tabular-nums text-[#252422]">
								{savedHours}
							</p>
							<p className="text-sm text-[#787571]">Hours saved/week</p>
						</div>
					)}
					{data.topVolunteers.length > 0 && (
						<div>
							<p className="font-display text-2xl font-bold tabular-nums text-[#252422]">
								{data.topVolunteers.length}
							</p>
							<p className="text-sm text-[#787571]">Top volunteers</p>
						</div>
					)}
				</div>
			</section>

			{/* ── CTA ── */}
			<CTABanner
				icon={Shield}
				heading="Ready to automate your volunteer management?"
				description="Our founder will personally set up your account — free. No contract, no credit card."
				actions={
					<Button
						asChild
						size="lg"
						className="rounded-full bg-white px-8 text-primary hover:bg-white/90"
					>
						<TrackedLink
							href="https://calendly.com"
							eventLabel="Get set up free (story CTA)"
							eventPage="stories"
						>
							Get Set Up Free by Our Founder
						</TrackedLink>
					</Button>
				}
			/>
		</div>
	);
}
