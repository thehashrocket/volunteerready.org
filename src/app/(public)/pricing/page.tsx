import { Check, Minus } from 'lucide-react';
import type { Metadata } from 'next';
import { CTABanner } from '@/components/cta-banner';
import { FadeInOnScroll } from '@/components/fade-in-on-scroll';
import { PublicHero } from '@/components/public-hero';
import { TrackedLink } from '@/components/tracked-link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { getPlanLimits } from '@/server/domain/billing';

export const metadata: Metadata = {
	title: 'Pricing — VolunteerReady',
	description:
		'Simple, transparent pricing for nonprofits and corporations. Free tier available. No credit card required.',
	openGraph: {
		title: 'Pricing — VolunteerReady',
		description:
			'Simple, transparent pricing for nonprofits and corporations. Free tier available. No credit card required.',
	},
};

const tiers = ['FREE', 'STARTER', 'PRO'] as const;

const TIER_META: Record<
	string,
	{ label: string; price: string; description: string }
> = {
	FREE: {
		label: 'Free',
		price: '$0/mo',
		description: 'Get started managing volunteers.',
	},
	STARTER: {
		label: 'Starter',
		price: '$49/mo',
		description: 'For growing nonprofits with more volunteers.',
	},
	PRO: {
		label: 'Pro',
		price: '$149/mo',
		description: 'Unlimited scale + background checks + ESG.',
	},
};

type FeatureRow = {
	label: string;
	free: string | boolean;
	starter: string | boolean;
	pro: string | boolean;
};

const featureComparison: FeatureRow[] = [
	{
		label: 'Opportunities',
		free: 'Up to 3',
		starter: 'Up to 25',
		pro: 'Unlimited',
	},
	{
		label: 'Team members',
		free: 'Up to 3',
		starter: 'Up to 10',
		pro: 'Unlimited',
	},
	{ label: 'Custom screening forms', free: true, starter: true, pro: true },
	{
		label: 'Shift scheduling & attendance',
		free: true,
		starter: true,
		pro: true,
	},
	{
		label: 'Portable volunteer credentials',
		free: true,
		starter: true,
		pro: true,
	},
	{
		label: 'Volunteer matching engine',
		free: false,
		starter: true,
		pro: true,
	},
	{
		label: 'FCRA-compliant background checks',
		free: false,
		starter: false,
		pro: true,
	},
	{
		label: 'ESG reporting dashboard',
		free: false,
		starter: false,
		pro: true,
	},
	{ label: 'CSV data exports', free: false, starter: false, pro: true },
	{ label: 'Audit logging', free: true, starter: true, pro: true },
	{
		label: 'Role-based access control',
		free: true,
		starter: true,
		pro: true,
	},
];

function FeatureCell({ value }: { value: string | boolean }) {
	if (typeof value === 'string')
		return <span className="text-sm text-foreground">{value}</span>;
	if (value)
		return <Check className="h-4 w-4 text-success" aria-label="Included" />;
	return (
		<Minus
			className="h-4 w-4 text-muted-foreground/40"
			aria-label="Not included"
		/>
	);
}

export default function PricingPage() {
	return (
		<div className="flex flex-col">
			<PublicHero
				eyebrow="Pricing"
				heading={
					<>
						Simple, transparent pricing.{' '}
						<em className="italic text-primary">No surprises.</em>
					</>
				}
				description="Everything nonprofits need to recruit, screen, and manage volunteers. Start free, upgrade when you're ready."
			/>

			{/* ── Tier cards ── */}
			<section className="mx-auto w-full max-w-5xl px-4 py-20">
				<div className="grid gap-6 sm:grid-cols-3">
					{tiers.map((tier, i) => {
						const meta = TIER_META[tier];
						const limits = getPlanLimits(tier);
						const isPro = tier === 'PRO';
						return (
							<FadeInOnScroll key={tier} delay={i * 75}>
								<Card
									className={
										isPro ? 'border-primary shadow-lg' : 'border-border/70'
									}
								>
									<CardHeader>
										<div className="flex items-center justify-between">
											<CardTitle>{meta.label}</CardTitle>
											{isPro && <Badge>Most popular</Badge>}
										</div>
										<div className="text-3xl font-bold text-foreground">
											{meta.price}
										</div>
										<CardDescription>{meta.description}</CardDescription>
									</CardHeader>
									<CardContent className="space-y-2.5 text-sm text-muted-foreground">
										<div>
											Opportunities:{' '}
											{limits.maxOpportunities === null
												? 'Unlimited'
												: `Up to ${limits.maxOpportunities}`}
										</div>
										<div>
											Team members:{' '}
											{limits.maxMembers === null
												? 'Unlimited'
												: `Up to ${limits.maxMembers}`}
										</div>
										<div>
											Volunteer matching: {limits.canMatching ? '✓' : '—'}
										</div>
										<div>
											Background checks:{' '}
											{limits.canBackgroundChecks ? '✓' : '—'}
										</div>
										<div>ESG reports: {limits.canESGReports ? '✓' : '—'}</div>
									</CardContent>
									<CardFooter>
										{tier === 'FREE' ? (
											<Button asChild variant="outline" className="w-full">
												<TrackedLink
													href="/login"
													eventLabel="Get started free"
													eventPage="pricing"
												>
													Get started free
												</TrackedLink>
											</Button>
										) : (
											<Button asChild className="w-full">
												<TrackedLink
													href={`/login?upgrade=${tier}`}
													eventLabel={`Upgrade to ${meta.label}`}
													eventPage="pricing"
												>
													Upgrade to {meta.label}
												</TrackedLink>
											</Button>
										)}
									</CardFooter>
								</Card>
							</FadeInOnScroll>
						);
					})}
				</div>
			</section>

			{/* ── Feature comparison table ── */}
			<section className="bg-[#F5F4F0] px-4 py-16">
				<div className="mx-auto max-w-4xl">
					<h2 className="font-display mb-10 text-center text-[32px] font-bold text-foreground [text-wrap:balance]">
						Compare plans side by side
					</h2>
					<div className="overflow-x-auto">
						<table className="w-full text-left">
							<thead>
								<tr className="border-b border-border/60">
									<th className="pb-3 pr-4 text-sm font-semibold text-foreground">
										Feature
									</th>
									<th className="pb-3 px-4 text-center text-sm font-semibold text-foreground">
										Free
									</th>
									<th className="pb-3 px-4 text-center text-sm font-semibold text-foreground">
										Starter
									</th>
									<th className="pb-3 pl-4 text-center text-sm font-semibold text-foreground">
										Pro
									</th>
								</tr>
							</thead>
							<tbody>
								{featureComparison.map((row) => (
									<tr key={row.label} className="border-b border-border/30">
										<td className="py-3 pr-4 text-sm text-muted-foreground">
											{row.label}
										</td>
										<td className="py-3 px-4 text-center">
											<div className="flex justify-center">
												<FeatureCell value={row.free} />
											</div>
										</td>
										<td className="py-3 px-4 text-center">
											<div className="flex justify-center">
												<FeatureCell value={row.starter} />
											</div>
										</td>
										<td className="py-3 pl-4 text-center">
											<div className="flex justify-center">
												<FeatureCell value={row.pro} />
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			</section>

			{/* ── Corporate section ── */}
			<section className="mx-auto w-full max-w-2xl px-4 py-20">
				<FadeInOnScroll>
					<div className="rounded-xl border border-[#C4A882]/30 bg-[#C4A882]/10 p-8 sm:p-10">
						<h2 className="font-display mb-2 text-2xl font-bold text-foreground [text-wrap:balance]">
							Corporate & enterprise
						</h2>
						<p className="mb-6 text-muted-foreground">
							Running a CSR program with hundreds of employees? Need custom
							integrations, SSO, or dedicated support? We'll build a package
							that fits.
						</p>
						<Button asChild size="lg" className="rounded-full px-8">
							<TrackedLink
								href="mailto:hello@volunteerready.com?subject=Corporate%20pricing"
								eventLabel="Contact for corporate pricing"
								eventPage="pricing"
							>
								Contact us for corporate pricing
							</TrackedLink>
						</Button>
					</div>
				</FadeInOnScroll>
			</section>

			<CTABanner
				heading="Start free. Upgrade when you're ready."
				description="No credit card required. Set up your organization in under a minute."
				actions={
					<Button
						asChild
						size="lg"
						className="rounded-full bg-white px-8 text-primary hover:bg-white/90"
					>
						<TrackedLink
							href="/login?callbackUrl=/app/onboarding"
							eventLabel="Get started free (bottom CTA)"
							eventPage="pricing"
						>
							Get started free
						</TrackedLink>
					</Button>
				}
			/>
		</div>
	);
}
