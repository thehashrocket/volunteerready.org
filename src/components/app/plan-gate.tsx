'use client';

import { Lock } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import type { PlanTier } from '@/prisma/generated/client';

interface PlanGateProps {
	currentTier: PlanTier;
	requiredTier: PlanTier;
	featureName: string;
	children: ReactNode;
}

const TIER_RANK: Record<PlanTier, number> = {
	FREE: 0,
	STARTER: 1,
	PRO: 2,
};

export function PlanGate({
	currentTier,
	requiredTier,
	featureName,
	children,
}: PlanGateProps) {
	if (TIER_RANK[currentTier] >= TIER_RANK[requiredTier]) {
		return <>{children}</>;
	}

	return (
		<div className="rounded-md border border-dashed bg-muted p-10 text-center">
			<div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted">
				<Lock className="h-5 w-5 text-muted-foreground" />
			</div>
			<h2 className="mt-4 text-lg font-semibold">{featureName}</h2>
			<p className="mt-1 text-sm text-muted-foreground">
				This feature requires the{' '}
				<span className="font-medium text-foreground">{requiredTier}</span> plan
				or higher.
			</p>
			<div className="mt-6 flex justify-center">
				<Button asChild>
					<Link href="/app/settings/billing">Upgrade Plan</Link>
				</Button>
			</div>
		</div>
	);
}
