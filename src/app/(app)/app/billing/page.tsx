'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { safeErrorMessage } from '@/components/app/query-error-card';
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
import { isWithinTrial, PLAN_FEATURES } from '@/server/domain/billing';

const TIER_LABELS: Record<string, string> = {
	FREE: 'Free',
	STARTER: 'Starter',
	PRO: 'Pro',
};

const TIER_DESCRIPTIONS: Record<string, string> = {
	STARTER: 'Adds reusable shift templates for recurring programs.',
	PRO: 'Background checks, ESG reporting, and advanced analytics.',
};

export default function BillingPage() {
	const router = useRouter();
	const searchParams = useSearchParams();

	const billingQ = trpc.billing.getBillingStatus.useQuery();

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

	const status = billingQ.data;
	const currentTier = status?.planTier ?? 'FREE';
	const trialActive = isWithinTrial(status?.trialEndsAt ?? null);

	const UPGRADE_TIERS = (['STARTER', 'PRO'] as const).filter(
		(t) => t !== currentTier,
	);

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
						// Only what this tier ADDS is worth listing here — the reader is
						// already on a lower plan and has everything below it.
						const added = PLAN_FEATURES.filter(
							(f) => f.requiredTier === tier,
						).map((f) => ({ label: f.label, detail: f.detail?.(tier) }));
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
