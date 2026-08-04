import { Check, Minus } from 'lucide-react';
import type { Metadata } from 'next';
import { CTABanner } from '@/components/cta-banner';
import { Eyebrow } from '@/components/eyebrow';
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
import {
	getPlanFeatures,
	isFeatureIncluded,
	PLAN_FEATURES,
} from '@/server/domain/billing';

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
		description: 'Everything you need to run volunteers day to day.',
	},
	STARTER: {
		label: 'Starter',
		price: '$49',
		unit: '/month',
		description: 'Adds reusable shift templates for recurring programs.',
	},
	PRO: {
		label: 'Pro',
		price: '$149',
		unit: '/month',
		description: 'Background checks, ESG reporting, and advanced analytics.',
	},
};

/**
 * Both the tier cards and the comparison table below read `PLAN_FEATURES`
 * (`server/domain/billing.ts`). They used to be two independent lists — the
 * cards derived, the table hand-typed — and they disagreed in production: the
 * table sold CSV export as Pro-only while the roster export ships free on every
 * tier by design, and it omitted shift templates and the analytics dashboard
 * entirely. Do not reintroduce a literal row here; add it to `PLAN_FEATURES`,
 * where the guard test checks it against the real gate.
 */
const pricingFaqs = [
	{
		question: 'Is there really a free tier?',
		answer:
			'Yes. The Free plan covers the whole day-to-day workflow — custom screening forms, shift scheduling and attendance, skill-based matching, portable credentials, and roster CSV export. No credit card, no volunteer cap, no seat cap.',
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
		question: 'Can I get my data out?',
		answer:
			'Always, on every plan including Free. Your volunteer roster exports to CSV whenever you want it — name, email, phone, status, how they joined, and shifts attended. We never hold your data hostage as an upgrade lever. Corporate ESG reports are the one export that needs Pro, because the aggregate dashboard they come from is itself a Pro feature.',
	},
	{
		question: 'Are there limits on volunteers, opportunities, or team members?',
		answer:
			'No. Plans differ by capability, not by headcount — you will never be charged more or cut off because your volunteer list grew during the holidays. What Starter and Pro add is features: reusable shift templates, background checks, ESG reporting, and advanced analytics.',
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
						const features = getPlanFeatures(tier);
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
									<Eyebrow tone="primary">{meta.label}</Eyebrow>
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
					<Eyebrow tone="primary" className="mb-3">
						Compare plans
					</Eyebrow>
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
								{PLAN_FEATURES.map((feature) => (
									<tr key={feature.label} className="border-b border-border/30">
										<td className="py-3 pr-4 text-sm text-foreground">
											{feature.label}
										</td>
										{tiers.map((tier) => (
											<td
												key={tier}
												className={cn(
													'py-3 text-center',
													tier === 'PRO' ? 'pl-4' : 'px-4',
												)}
											>
												<div className="flex justify-center">
													<ComparisonCell
														value={
															isFeatureIncluded(feature, tier)
																? (feature.detail?.(tier) ?? true)
																: false
														}
													/>
												</div>
											</td>
										))}
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
						<Eyebrow tone="primary" className="mb-3">
							Corporate & enterprise
						</Eyebrow>
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
					<Eyebrow tone="primary" className="mb-3">
						Pricing FAQ
					</Eyebrow>
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
