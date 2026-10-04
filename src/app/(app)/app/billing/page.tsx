'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { toast } from 'sonner';
import {
	QueryErrorCard,
	safeErrorMessage,
} from '@/components/app/query-error-card';
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
import { trpc } from '@/lib/trpc/client';
import { getPlanUpgrade, isWithinTrial } from '@/server/domain/billing';

const TIER_LABELS: Record<string, string> = {
	FREE: 'Free',
	STARTER: 'Starter',
	PRO: 'Pro',
};

// What to do next for an org whose subscription blocks a new checkout. Keyed
// by the status getBillingPageStatus reports; anything not listed (or 'unknown',
// when Stripe could not be asked) gets the plain plan-switch line.
const SUBSCRIPTION_GUIDANCE: Record<string, string> = {
	past_due:
		"Your last payment didn't go through. Update your card in Manage subscription; your plan stays active while the payment is retried.",
	unpaid:
		'Your subscription is unpaid. Pay the open invoice in Manage subscription, or contact support, before choosing a new plan.',
	paused:
		'Your subscription is paused. Contact support to resume it or to choose a new plan.',
	incomplete:
		"Your subscription's first payment hasn't been completed, so it can't be changed yet. If it isn't paid it lapses within a day; contact support if you need a different plan sooner.",
};
const SWITCH_PLAN_GUIDANCE = 'To switch plans, open Manage subscription.';

const TIER_DESCRIPTIONS: Record<string, string> = {
	STARTER: 'Adds reusable shift templates for recurring programs.',
	// NOT ESG reporting: that is gated on CompanyAccount.planTier, and this
	// page upgrades Organization.planTier. See the PlanLimits docstring.
	PRO: 'Background checks and the advanced analytics dashboard.',
};

export default function BillingPage() {
	const router = useRouter();
	const searchParams = useSearchParams();

	// Each fetch asks Stripe which subscriptions could still bill, so it is not
	// refetched on every tab focus.
	const billingQ = trpc.billing.getBillingPageStatus.useQuery(undefined, {
		staleTime: 60_000,
		refetchOnWindowFocus: false,
	});

	const checkoutMutation = trpc.billing.createCheckoutSession.useMutation({
		onSuccess: ({ checkoutUrl }) => {
			if (checkoutUrl) router.push(checkoutUrl);
		},
		onError: (err) =>
			toast.error(safeErrorMessage(err) ?? 'Failed to open checkout'),
	});

	const portalMutation = trpc.billing.createPortalSession.useMutation({
		onSuccess: ({ portalUrl }) => {
			router.push(portalUrl);
		},
		onError: (err) =>
			toast.error(safeErrorMessage(err) ?? 'Failed to open billing portal'),
	});

	// Show success toast when returning from Stripe checkout
	useEffect(() => {
		if (searchParams.get('upgraded') === '1') {
			toast.success('Plan upgraded successfully!');
		}
	}, [searchParams]);

	// Loading, then error, then the plan: rendering the plan before the status
	// arrives would show upgrade buttons to an org that cannot check out.
	if (billingQ.isLoading) {
		return (
			<div className="max-w-2xl space-y-8">
				<h1 className="font-sans text-2xl font-bold">Billing</h1>
				<p className="text-muted-foreground">Loading your plan…</p>
			</div>
		);
	}
	if (billingQ.isError) {
		return (
			<div className="max-w-2xl space-y-8">
				<h1 className="font-sans text-2xl font-bold">Billing</h1>
				<QueryErrorCard
					title="Couldn't load your plan"
					message={safeErrorMessage(billingQ.error)}
					onRetry={() => billingQ.refetch()}
					isRetrying={billingQ.isFetching}
				/>
			</div>
		);
	}

	const status = billingQ.data;
	const currentTier = status?.planTier ?? 'FREE';
	const trialActive = isWithinTrial(status?.trialEndsAt ?? null);

	// An org with a subscription that could still bill (paying, or unpaid,
	// paused or incomplete) changes plans in the billing portal; checkout here
	// would be refused. getBillingPageStatus asks Stripe with checkout's own rule.
	const hasSubscription = status?.hasSubscription ?? false;
	const UPGRADE_TIERS = hasSubscription
		? []
		: (['STARTER', 'PRO'] as const).filter((t) => t !== currentTier);

	return (
		<div className="max-w-2xl space-y-8">
			<div>
				<h1 className="font-sans text-2xl font-bold">Billing</h1>
				<p className="text-muted-foreground">
					Manage your plan and subscription.
				</p>
			</div>

			{/* Current plan */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						Current plan
						<Badge variant={currentTier === 'FREE' ? 'secondary' : 'default'}>
							{TIER_LABELS[currentTier] ?? currentTier}
						</Badge>
						{trialActive && (
							<Badge variant="outline">
								Trial ends {status?.trialEndsAt?.toLocaleDateString()}
							</Badge>
						)}
					</CardTitle>
				</CardHeader>
				{hasSubscription && (
					<CardContent className="text-sm text-muted-foreground">
						{SUBSCRIPTION_GUIDANCE[status?.subscriptionStatus ?? ''] ??
							SWITCH_PLAN_GUIDANCE}
					</CardContent>
				)}
				{status?.hasStripeCustomer && (
					<CardFooter>
						<Button
							variant="outline"
							onClick={() => portalMutation.mutate()}
							disabled={portalMutation.isPending}
						>
							{portalMutation.isPending ? 'Opening…' : 'Manage subscription'}
						</Button>
					</CardFooter>
				)}
			</Card>

			{/* Upgrade options */}
			{UPGRADE_TIERS.length > 0 && (
				<div className="space-y-4">
					<h2 className="text-lg font-semibold">Upgrade your plan</h2>
					{UPGRADE_TIERS.map((tier) => {
						// Same source as the public pricing page, so the two cannot drift.
						// Computed against the org's CURRENT tier, not "rows introduced at
						// this tier" — that shortcut dropped shift templates going from
						// `Up to 10` to `Unlimited` off the STARTER→PRO pitch, because the
						// row does not cross a boundary there, only its detail improves.
						const added = getPlanUpgrade(currentTier, tier);
						return (
							<Card key={tier}>
								<CardHeader>
									<CardTitle>{TIER_LABELS[tier]}</CardTitle>
									<CardDescription>{TIER_DESCRIPTIONS[tier]}</CardDescription>
								</CardHeader>
								<CardContent className="text-sm text-muted-foreground">
									{added.map((f) => (
										<div key={f.label}>
											{f.label}
											{f.detail ? ` · ${f.detail}` : ''}
											{/* An already-included row that only got better reads as a
											    repeat of what they have unless the delta is shown. */}
											{f.wasDetail ? ` (was ${f.wasDetail})` : ''}
										</div>
									))}
								</CardContent>
								<CardFooter>
									<Button
										onClick={() => checkoutMutation.mutate({ tier })}
										disabled={checkoutMutation.isPending}
									>
										{checkoutMutation.isPending
											? 'Loading…'
											: `Upgrade to ${TIER_LABELS[tier]}`}
									</Button>
								</CardFooter>
							</Card>
						);
					})}
				</div>
			)}
		</div>
	);
}
