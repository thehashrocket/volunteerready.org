import Link from 'next/link';
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

const tiers = ['FREE', 'STARTER', 'PRO'] as const;

const TIER_LABELS: Record<string, string> = {
	FREE: 'Free',
	STARTER: 'Starter',
	PRO: 'Pro',
};

const TIER_PRICES: Record<string, string> = {
	FREE: '$0/mo',
	STARTER: '$49/mo',
	PRO: '$149/mo',
};

const TIER_DESCRIPTIONS: Record<string, string> = {
	FREE: 'Get started managing volunteers.',
	STARTER: 'For growing nonprofits.',
	PRO: 'Unlimited scale + advanced tools.',
};

export default function PricingPage() {
	return (
		<div className="container mx-auto px-4 py-16">
			<div className="mb-12 text-center">
				<h1 className="mb-3 text-4xl font-bold tracking-tight">
					Simple, transparent pricing
				</h1>
				<p className="text-lg text-muted-foreground">
					Everything nonprofits need to recruit, screen, and manage volunteers.
				</p>
			</div>

			{/* Nonprofit tiers */}
			<div className="mx-auto mb-20 grid max-w-5xl gap-6 sm:grid-cols-3">
				{tiers.map((tier) => {
					const limits = getPlanLimits(tier);
					const isPro = tier === 'PRO';
					return (
						<Card
							key={tier}
							className={isPro ? 'border-primary shadow-lg' : undefined}
						>
							<CardHeader>
								<div className="flex items-center justify-between">
									<CardTitle>{TIER_LABELS[tier]}</CardTitle>
									{isPro && <Badge>Most popular</Badge>}
								</div>
								<div className="text-2xl font-bold">{TIER_PRICES[tier]}</div>
								<CardDescription>{TIER_DESCRIPTIONS[tier]}</CardDescription>
							</CardHeader>
							<CardContent className="space-y-2 text-sm text-muted-foreground">
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
								<div>Volunteer matching: {limits.canMatching ? '✓' : '—'}</div>
								<div>ESG reports: {limits.canESGReports ? '✓' : '—'}</div>
							</CardContent>
							<CardFooter>
								{tier === 'FREE' ? (
									<Button asChild variant="outline" className="w-full">
										<Link href="/login">Get started free</Link>
									</Button>
								) : (
									<Button asChild className="w-full">
										<Link href={`/login?upgrade=${tier}`}>
											Upgrade to {TIER_LABELS[tier]}
										</Link>
									</Button>
								)}
							</CardFooter>
						</Card>
					);
				})}
			</div>

			{/* Corporate / CSR section */}
			<div className="mx-auto max-w-2xl rounded-xl border bg-muted/40 p-8 text-center">
				<h2 className="mb-2 text-2xl font-bold">For companies</h2>
				<p className="mb-6 text-muted-foreground">
					Empower your employees to volunteer, track CSR impact, and partner
					with nonprofits — all in one place.
				</p>
				<Button asChild size="lg">
					<a href="mailto:hello@volunteerready.com?subject=Corporate%20pricing">
						Contact us for corporate pricing
					</a>
				</Button>
			</div>
		</div>
	);
}
