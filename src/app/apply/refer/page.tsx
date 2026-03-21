import { ArrowRight, Shield } from 'lucide-react';
import type { Metadata } from 'next';
import { CTABanner } from '@/components/cta-banner';
import { PublicHero } from '@/components/public-hero';
import { TrackedLink } from '@/components/tracked-link';
import { Button } from '@/components/ui/button';
import { prisma } from '@/server/repositories/prisma';

export const metadata: Metadata = {
	title: 'Background Checks for Nonprofits — Referred | VolunteerReady',
	description:
		'A fellow nonprofit recommended VolunteerReady for automated background checks. Get set up free by our founder.',
};

async function getReferringOrgName(slug: string | undefined) {
	if (!slug) return null;
	const org = await prisma.organization.findUnique({
		where: { slug },
		select: { name: true },
	});
	return org?.name ?? null;
}

export default async function ReferralPage({
	searchParams,
}: {
	searchParams: Promise<{ from?: string }>;
}) {
	const { from } = await searchParams;
	const referringOrgName = await getReferringOrgName(from);

	return (
		<div className="flex flex-col">
			<PublicHero
				eyebrow="Background Checks for Nonprofits"
				heading={
					<>
						Stop tracking background checks{' '}
						<em className="italic text-primary">in spreadsheets.</em>
					</>
				}
				description="Automated volunteer screening with Checkr & Sterling integration, FCRA-compliant workflows, and portable credentials. Set up free by our founder."
				actions={
					<>
						{referringOrgName && (
							<div className="mb-2 w-full rounded-lg border border-[#C4A882]/40 bg-[#C4A882]/10 px-4 py-2.5 text-sm text-foreground">
								Referred by{' '}
								<span className="font-semibold">{referringOrgName}</span>
							</div>
						)}
						<Button asChild size="lg" className="rounded-full px-8">
							<TrackedLink
								href="https://calendly.com"
								eventLabel="Get set up free (referral)"
								eventPage="screening-referral"
							>
								<ArrowRight className="h-4 w-4" />
								Get Set Up Free by Our Founder
							</TrackedLink>
						</Button>
					</>
				}
			/>

			<CTABanner
				icon={Shield}
				heading="Ready to automate your background checks?"
				description="Our founder will personally set up your account — free. No contract, no credit card."
				actions={
					<Button
						asChild
						size="lg"
						className="rounded-full bg-white px-8 text-primary hover:bg-white/90"
					>
						<TrackedLink
							href="https://calendly.com"
							eventLabel="Get set up free (referral bottom)"
							eventPage="screening-referral"
						>
							Get Set Up Free by Our Founder
						</TrackedLink>
					</Button>
				}
			/>
		</div>
	);
}
