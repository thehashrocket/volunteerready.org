'use client';

import { CheckCircle2, Circle } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import { trpc } from '@/lib/trpc/client';

// ---------------------------------------------------------------------------
// Funnel bar
// ---------------------------------------------------------------------------

function FunnelStep({
	label,
	count,
	total,
}: {
	label: string;
	count: number;
	total: number;
}) {
	const pct = total > 0 ? Math.round((count / total) * 100) : 0;

	return (
		<div className="space-y-1.5">
			<div className="flex items-baseline justify-between text-sm">
				<span className="font-medium">{label}</span>
				<span className="tabular-nums text-muted-foreground">
					{count} / {total} ({pct}%)
				</span>
			</div>
			<div className="h-3 w-full rounded-full bg-muted">
				<div
					className="h-3 rounded-full bg-primary transition-all"
					style={{ width: `${pct}%` }}
				/>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function OnboardingAnalyticsPage() {
	const { data, isLoading } = trpc.admin.onboardingFunnel.useQuery();

	const totalOrgs = data?.funnel[0]?.count ?? 0;

	return (
		<div className="space-y-8">
			<PageHeader
				title="Onboarding Funnel"
				description="How organizations progress through the 4-step onboarding flow."
			/>

			{/* ── Funnel visualization ── */}
			<Card className="border-border/70">
				<CardHeader className="pb-3">
					<CardTitle className="text-base font-semibold">
						Funnel overview
					</CardTitle>
				</CardHeader>
				<CardContent>
					{isLoading ? (
						<div className="space-y-4">
							{Array.from({ length: 4 }).map((_, i) => (
								<Skeleton key={i} className="h-10 rounded-lg" />
							))}
						</div>
					) : (
						<div className="space-y-4">
							{data?.funnel.map((step) => (
								<FunnelStep
									key={step.step}
									label={`${step.step}. ${step.label}`}
									count={step.count}
									total={totalOrgs}
								/>
							))}
						</div>
					)}
				</CardContent>
			</Card>

			{/* ── Per-org detail table ── */}
			<Card className="border-border/70">
				<CardHeader className="pb-3">
					<CardTitle className="text-base font-semibold">
						Recent organizations
					</CardTitle>
				</CardHeader>
				<CardContent>
					{isLoading ? (
						<Skeleton className="h-40 rounded-lg" />
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Organization</TableHead>
									<TableHead>Created</TableHead>
									<TableHead className="text-center">Screener</TableHead>
									<TableHead className="text-center">Opportunity</TableHead>
									<TableHead className="text-center">Application</TableHead>
									<TableHead className="text-center">Progress</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{data?.orgDetails.map((org) => (
									<TableRow key={org.id}>
										<TableCell className="font-medium">{org.name}</TableCell>
										<TableCell className="text-muted-foreground text-sm">
											{new Date(org.createdAt).toLocaleDateString()}
										</TableCell>
										<TableCell className="text-center">
											<StepIcon done={org.hasScreener} />
										</TableCell>
										<TableCell className="text-center">
											<StepIcon done={org.hasOpportunity} />
										</TableCell>
										<TableCell className="text-center">
											<StepIcon done={org.hasApplication} />
										</TableCell>
										<TableCell className="text-center">
											<Badge
												variant={
													org.stepsCompleted === 4 ? 'default' : 'secondary'
												}
												className="text-xs"
											>
												{org.stepsCompleted}/4
											</Badge>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

function StepIcon({ done }: { done: boolean }) {
	return done ? (
		<CheckCircle2 className="mx-auto h-4 w-4 text-success" />
	) : (
		<Circle className="mx-auto h-4 w-4 text-muted-foreground/40" />
	);
}
