import { Check, Minus } from 'lucide-react';
import type { Metadata } from 'next';
import { CTABanner } from '@/components/cta-banner';
import { FadeInOnScroll } from '@/components/fade-in-on-scroll';
import { JsonLdBreadcrumb } from '@/components/json-ld-breadcrumb';
import { JsonLdFaq } from '@/components/json-ld-faq';
import { PublicHero } from '@/components/public-hero';
import { TrackedLink } from '@/components/tracked-link';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { PlanTier } from '@/prisma/generated/client';
import { getPlanLimits } from '@/server/domain/billing';

export const metadata: Metadata = {
	title: 'Pricing — VolunteerReady',
	description:
		'Simple, transparent pricing for nonprofits and corporations. Free tier available. No credit card required.',
	openGraph: {
		title: 'Pricing — VolunteerReady',
		description:
			'Simple, transparent pricing for nonprofits and corporations. Free tier available. No credit card required.',
		images: ['/api/og/page/pricing'],
	},
};

const tiers = ['FREE', 'STARTER', 'PRO'] as const;

type TierMeta = {
	label: string;
	price: string;
	unit: string;
	description: string;
};

const TIER_META: Record<PlanTier, TierMeta> = {
	FREE: {
		label: 'Free',
		price: '$0',
		unit: '/month',
		description: 'Get started managing volunteers.',
	},
	STARTER: {
		label: 'Starter',
		price: '$49',
		unit: '/month',
		description: 'For growing nonprofits with more volunteers.',
	},
	PRO: {
		label: 'Pro',
		price: '$149',
		unit: '/month',
		description: 'Unlimited scale + background checks + ESG.',
	},
};

type TierFeature = {
	label: string;
	included: boolean;
	detail?: string;
};

function buildTierFeatures(tier: PlanTier): TierFeature[] {
	const limits = getPlanLimits(tier);
	return [
		{
			label: 'Opportunities',
			included: true,
			detail:
				limits.maxOpportunities === null
					? 'Unlimited'
					: `Up to ${limits.maxOpportunities}`,
		},
		{
			label: 'Team members',
			included: true,
			detail:
				limits.maxMembers === null ? 'Unlimited' : `Up to ${limits.maxMembers}`,
		},
		{ label: 'Custom screening forms', included: true },
		{ label: 'Shift scheduling & attendance', included: true },
		{ label: 'Portable volunteer credentials', included: true },
		{ label: 'Volunteer matching engine', included: limits.canMatching },
		{
			label: 'FCRA-compliant background checks',
			included: limits.canBackgroundChecks,
		},
		{ label: 'ESG reporting dashboard', included: limits.canESGReports },
	];
}

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

const pricingFaqs = [
	{
		question: 'Is there really a free tier?',
		answer:
			'Yes. The Free plan includes up to 3 opportunities, 3 team members, custom screening forms, shift scheduling, and portable credentials — no credit card required.',
	},
	{
		question: 'Can I change plans later?',
		answer:
			'Absolutely. You can upgrade or downgrade at any time. Changes take effect immediately and billing is prorated.',
	},
	{
		question: 'What payment methods do you accept?',
		answer:
			'We accept all major credit cards. Enterprise customers can pay by invoice with net-30 terms.',
	},
	{
		question: 'Do background checks cost extra?',
		answer:
			'Background checks are included in the Pro plan at no additional platform fee. You pay only the provider cost (Checkr or Sterling) per check.',
	},
	{
		question: 'What happens if I exceed my plan limits?',
		answer:
			"We'll notify you when you're approaching a limit and suggest an upgrade. We never cut off access to your existing data.",
	},
];

function ComparisonCell({ value }: { value: string | boolean }) {
	if (typeof value === 'string')
		return <span className="text-sm text-foreground">{value}</span>;
	if (value)
		return <Check className="h-4 w-4 text-primary" aria-label="Included" />;
	return (
		<Minus
			className="h-4 w-4 text-muted-foreground/20"
			aria-label="Not included"
		/>
	);
}

export default function PricingPage() {
	return (
		<div className="flex flex-col">
			<JsonLdBreadcrumb
				items={[
					{ label: 'Home', href: '/' },
					{ label: 'Pricing', href: '/pricing' },
				]}
			/>
			<JsonLdFaq faqs={pricingFaqs} />
			<PublicHero
				eyebrow="Pricing"
				heading={
					<>
						Simple, transparent pricing.{' '}
						<em className="italic text-primary">No surprises.</em>
					</>
				}
				description="Everything nonprofits need to recruit, screen, and manage volunteers. Start free. Upgrade when the grant requires it."
				side={{
					label: 'No hidden fees',
					note: (
						<>
							Background checks billed at cost.{' '}
							<em className="italic">No per-seat taxes.</em> No surprise charges
							when your volunteer count doubles during the holidays.
						</>
					),
				}}
			/>

			{/* ── Tier cards ── */}
			<section className="mx-auto w-full max-w-5xl px-4 py-14 md:py-20">
				<div className="grid gap-6 sm:grid-cols-3">
					{tiers.map((tier) => {
						const meta = TIER_META[tier];
						const features = buildTierFeatures(tier);
						const isPro = tier === 'PRO';
						return (
							<Card
								key={tier}
								className={cn(
									'relative flex flex-col',
									isPro
										? 'border-[1.5px] border-primary shadow-lg'
										: 'border-border/70',
								)}
							>
								{isPro && (
									<div className="pointer-events-none absolute -top-3 right-6 inline-flex items-center rounded-full bg-primary px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-primary-foreground shadow-sm">
										Most popular
									</div>
								)}
								<CardHeader className="space-y-4">
									<p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
										{meta.label}
									</p>
									<div className="flex items-baseline gap-1.5">
										<span className="font-display text-[48px] font-semibold leading-none text-foreground">
											{meta.price}
										</span>
										<span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
											{meta.unit}
										</span>
									</div>
									<p className="text-sm leading-relaxed text-muted-foreground">
										{meta.description}
									</p>
								</CardHeader>
								<CardContent className="flex-1">
									<ul className="flex flex-col gap-2.5 text-sm">
										{features.map((f) => (
											<li
												key={f.label}
												className={cn(
													'flex items-start gap-2.5',
													f.included
														? 'text-foreground'
														: 'text-muted-foreground',
												)}
											>
												{f.included ? (
													<Check
														className="mt-0.5 h-4 w-4 shrink-0 text-primary"
														aria-hidden
													/>
												) : (
													<span
														aria-hidden
														className="mt-0.5 w-4 shrink-0 text-center font-mono text-muted-foreground/70"
													>
														—
													</span>
												)}
												<span className="leading-relaxed">
													{f.label}
													{f.detail && (
														<span className="text-muted-foreground">
															{' '}
															· {f.detail}
														</span>
													)}
												</span>
											</li>
										))}
									</ul>
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
						);
					})}
				</div>
			</section>

			{/* ── Feature comparison ── */}
			<section className="bg-muted px-4 py-14 md:py-20">
				<div className="mx-auto max-w-4xl">
					<p className="mb-3 font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
						Compare plans
					</p>
					<h2 className="font-display mb-10 text-[32px] font-semibold text-foreground [text-wrap:balance]">
						Every feature, side by side.
					</h2>
					<div className="overflow-x-auto">
						<table className="w-full text-left">
							<thead>
								<tr className="border-b border-border/60">
									<th className="pb-3 pr-4 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
										Feature
									</th>
									<th className="px-4 pb-3 text-center font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
										Free
									</th>
									<th className="px-4 pb-3 text-center font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
										Starter
									</th>
									<th className="pb-3 pl-4 text-center font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
										Pro
									</th>
								</tr>
							</thead>
							<tbody>
								{featureComparison.map((row) => (
									<tr key={row.label} className="border-b border-border/30">
										<td className="py-3 pr-4 text-sm text-foreground">
											{row.label}
										</td>
										<td className="px-4 py-3 text-center">
											<div className="flex justify-center">
												<ComparisonCell value={row.free} />
											</div>
										</td>
										<td className="px-4 py-3 text-center">
											<div className="flex justify-center">
												<ComparisonCell value={row.starter} />
											</div>
										</td>
										<td className="py-3 pl-4 text-center">
											<div className="flex justify-center">
												<ComparisonCell value={row.pro} />
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			</section>

			{/* ── Corporate band ── */}
			<section className="mx-auto w-full max-w-2xl px-4 py-14 md:py-20">
				<FadeInOnScroll>
					<div className="border-l-2 border-accent bg-background p-8 sm:p-10">
						<p className="mb-3 font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
							Corporate & enterprise
						</p>
						<h2 className="font-display mb-4 text-[28px] font-semibold text-foreground [text-wrap:balance]">
							A CSR program that{' '}
							<em className="italic text-primary">scales with you.</em>
						</h2>
						<p className="mb-6 leading-relaxed text-muted-foreground">
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

			{/* ── Pricing FAQ ── */}
			<section className="bg-muted px-4 py-14 md:py-20">
				<div className="mx-auto max-w-2xl">
					<p className="mb-3 font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
						Pricing FAQ
					</p>
					<h2 className="font-display mb-10 text-[32px] font-semibold text-foreground [text-wrap:balance]">
						Questions, answered.
					</h2>
					<dl className="space-y-8">
						{pricingFaqs.map((faq) => (
							<div key={faq.question}>
								<dt className="mb-2 font-semibold text-foreground">
									{faq.question}
								</dt>
								<dd className="text-sm leading-relaxed text-muted-foreground">
									{faq.answer}
								</dd>
							</div>
						))}
					</dl>
				</div>
			</section>

			<CTABanner
				heading={
					<>
						Start free. Upgrade <em className="italic">when you're ready.</em>
					</>
				}
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
