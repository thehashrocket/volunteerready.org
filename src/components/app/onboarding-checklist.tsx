'use client';

import { CheckCircle2, Circle, X } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc/client';

type OnboardingData = {
	complete: boolean;
	teamMemberCount: number;
	opportunityCount: number;
	applicationCount: number;
	backgroundCheckCompleteCount: number;
};

const steps = [
	{
		label: 'Invite a team member',
		href: '/app/settings/team',
		check: (d: OnboardingData) => d.teamMemberCount > 1,
	},
	{
		label: 'Create your first opportunity',
		href: '/app/opportunities',
		check: (d: OnboardingData) => d.opportunityCount > 0,
	},
	{
		label: 'Receive your first application',
		href: '/app/applications',
		check: (d: OnboardingData) => d.applicationCount > 0,
	},
	{
		label: 'Complete your first background check',
		href: '/app/credentials',
		check: (d: OnboardingData) => d.backgroundCheckCompleteCount > 0,
	},
] as const;

export function OnboardingChecklist({
	onboarding,
}: {
	onboarding: OnboardingData;
}) {
	const utils = trpc.useUtils();
	const dismiss = trpc.screener.dismissOnboardingChecklist.useMutation({
		onSuccess: () => utils.screener.getDashboardStats.invalidate(),
		onError: (err) => {
			console.error('[onboarding] Failed to dismiss checklist', err);
		},
	});

	if (onboarding.complete) return null;

	const completed = steps.filter((s) => s.check(onboarding)).length;
	const progress = (completed / steps.length) * 100;

	return (
		<div className="rounded-xl border border-border/60 bg-white px-6 py-5">
			<div className="flex items-start justify-between">
				<div>
					<h3 className="font-display text-lg font-bold text-foreground">
						Get started
					</h3>
					<p className="mt-0.5 text-sm text-muted-foreground">
						{completed} of {steps.length} steps complete
					</p>
				</div>
				<Button
					variant="ghost"
					size="sm"
					className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
					onClick={() => dismiss.mutate()}
					disabled={dismiss.isPending}
					aria-label="Dismiss onboarding checklist"
				>
					<X className="h-4 w-4" />
				</Button>
			</div>

			{/* Progress bar */}
			<div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-border/40">
				<div
					className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
					style={{ width: `${progress}%` }}
				/>
			</div>

			{/* Steps */}
			<ul className="mt-4 space-y-2">
				{steps.map((step) => {
					const done = step.check(onboarding);
					return (
						<li key={step.label}>
							<Link
								href={step.href}
								className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors duration-150 hover:bg-muted/50"
							>
								{done ? (
									<CheckCircle2 className="h-5 w-5 shrink-0 text-[#2D7A4F]" />
								) : (
									<Circle className="h-5 w-5 shrink-0 text-muted-foreground/40" />
								)}
								<span
									className={
										done
											? 'text-muted-foreground line-through'
											: 'text-foreground'
									}
								>
									{step.label}
								</span>
							</Link>
						</li>
					);
				})}
			</ul>
		</div>
	);
}
