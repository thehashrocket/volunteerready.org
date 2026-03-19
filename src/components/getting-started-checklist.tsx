'use client';

import { CheckCircle2, Circle, Sparkles, X } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { trpc } from '@/lib/trpc/client';

interface GettingStartedChecklistProps {
	onStartWizard?: () => void;
}

export function GettingStartedChecklist({
	onStartWizard,
}: GettingStartedChecklistProps) {
	const query = trpc.onboarding.status.useQuery();
	const utils = trpc.useUtils();
	const dismiss = trpc.onboarding.dismiss.useMutation({
		onSuccess: () => utils.onboarding.status.invalidate(),
	});

	if (query.isLoading) return null;

	const status = query.data;
	if (!status || status.dismissed || status.allComplete) return null;

	return (
		<Card className="border-primary/20 bg-primary/[0.02]">
			<CardHeader className="flex flex-row items-center justify-between pb-3">
				<div>
					<CardTitle className="text-base font-semibold">
						Getting started
					</CardTitle>
					<p className="mt-1 text-sm text-muted-foreground">
						{status.completedCount} of {status.totalCount} steps complete
					</p>
				</div>
				<div className="flex items-center gap-1">
					{onStartWizard && (
						<Button
							variant="outline"
							size="sm"
							onClick={onStartWizard}
							className="gap-1.5"
						>
							<Sparkles className="h-3.5 w-3.5" />
							Quick setup
						</Button>
					)}
					<Button
						variant="ghost"
						size="icon"
						className="h-8 w-8 text-muted-foreground"
						onClick={() => dismiss.mutate()}
						disabled={dismiss.isPending}
					>
						<X className="h-4 w-4" />
						<span className="sr-only">Dismiss checklist</span>
					</Button>
				</div>
			</CardHeader>
			<CardContent>
				{/* Progress bar */}
				<div className="mb-4 h-2 overflow-hidden rounded-full bg-muted">
					<div
						className="h-full rounded-full bg-primary transition-all duration-500"
						style={{
							width: `${(status.completedCount / status.totalCount) * 100}%`,
						}}
					/>
				</div>

				<ol className="space-y-3">
					{status.steps.map((step) => (
						<li key={step.key}>
							<Link
								href={step.href}
								className="flex items-start gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-muted/50"
							>
								{step.complete ? (
									<CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
								) : (
									<Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground/40" />
								)}
								<div className="min-w-0 flex-1">
									<p
										className={`text-sm font-medium ${step.complete ? 'text-muted-foreground line-through' : 'text-foreground'}`}
									>
										{step.label}
									</p>
									{!step.complete && (
										<p className="text-xs text-muted-foreground">
											{step.description}
										</p>
									)}
								</div>
							</Link>
						</li>
					))}
				</ol>
			</CardContent>
		</Card>
	);
}
