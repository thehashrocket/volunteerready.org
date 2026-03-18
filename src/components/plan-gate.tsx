'use client';

import { Lock } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/lib/trpc/client';

type PlanTier = 'FREE' | 'STARTER' | 'PRO';

const TIER_RANK: Record<PlanTier, number> = {
	FREE: 0,
	STARTER: 1,
	PRO: 2,
};

const TIER_DISPLAY: Record<PlanTier, string> = {
	FREE: 'Free',
	STARTER: 'Starter',
	PRO: 'Pro',
};

interface PlanGateProps {
	/** Minimum tier required to access the gated content. */
	requiredTier: PlanTier;
	/** Feature name shown in the upgrade prompt. */
	feature: string;
	/** Description of what the feature does. */
	description: string;
	/** Content rendered when the org meets the tier requirement. */
	children: ReactNode;
}

/**
 * Client component that checks the org's plan tier before rendering children.
 * Shows an upgrade prompt if the org's tier is below `requiredTier`.
 */
export function PlanGate({
	requiredTier,
	feature,
	description,
	children,
}: PlanGateProps) {
	const billingQ = trpc.billing.getBillingStatus.useQuery(undefined, {
		retry: false,
	});

	if (billingQ.isLoading) {
		return (
			<div className="flex items-center justify-center min-h-[200px]">
				<Skeleton className="h-40 w-full max-w-md" />
			</div>
		);
	}

	const currentTier = (billingQ.data?.planTier ?? 'FREE') as PlanTier;
	const meetsRequirement = TIER_RANK[currentTier] >= TIER_RANK[requiredTier];

	if (meetsRequirement) {
		return <>{children}</>;
	}

	return (
		<div className="flex items-center justify-center min-h-[300px]">
			<Card className="max-w-md w-full">
				<CardHeader className="text-center">
					<div className="flex justify-center mb-4">
						<Lock className="h-10 w-10 text-muted-foreground" />
					</div>
					<CardTitle>{feature}</CardTitle>
					<CardDescription>{description}</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col items-center gap-3">
					<p className="text-sm text-muted-foreground text-center">
						Upgrade to the <strong>{TIER_DISPLAY[requiredTier]}</strong> plan to
						unlock this feature.
					</p>
					<Button asChild>
						<Link href="/app/billing">
							Upgrade to {TIER_DISPLAY[requiredTier]}
						</Link>
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}
