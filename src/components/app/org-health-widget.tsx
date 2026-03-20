'use client';

import Link from 'next/link';
import {
	computeOrgHealth,
	type OrgHealthInput,
} from '@/server/domain/org-health';

interface OrgHealthWidgetProps {
	health: OrgHealthInput;
}

export function OrgHealthWidget({ health }: OrgHealthWidgetProps) {
	const { score, tip } = computeOrgHealth(health);

	if (score === 0) {
		return (
			<div className="mt-4">
				<p id="health-tip" className="text-sm text-muted-foreground">
					Set up your org to get started.
				</p>
				<Link
					href="/app/screener"
					className="mt-1 inline-block text-sm font-semibold text-primary underline-offset-4 hover:underline"
					aria-label="Start setting up your organization"
				>
					Start setup →
				</Link>
			</div>
		);
	}

	return (
		<div className="mt-4">
			<div className="flex items-baseline gap-1.5">
				<span className="font-sans text-xl font-semibold tabular-nums">
					{score}
				</span>
				<span className="text-sm text-muted-foreground">/100</span>
			</div>
			<div
				className="mt-2 h-2 w-full rounded-full bg-neutral-200"
				role="progressbar"
				aria-valuenow={score}
				aria-valuemin={0}
				aria-valuemax={100}
				aria-label="Organization health score"
				aria-describedby={tip ? 'health-tip' : undefined}
			>
				<div
					className="h-2 rounded-full bg-primary transition-[width] duration-400 ease-out"
					style={{ width: `${score}%` }}
				/>
			</div>
			{tip ? (
				<p id="health-tip" className="mt-2 text-sm text-muted-foreground">
					{tip}
				</p>
			) : (
				<p className="mt-2 text-sm text-muted-foreground">
					Your org is fully set up! Keep growing your volunteer program.
				</p>
			)}
		</div>
	);
}
