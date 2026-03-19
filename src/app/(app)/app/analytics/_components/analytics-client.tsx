'use client';

import { useState } from 'react';
import { PlanGate } from '@/components/plan-gate';
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
// Types
// ---------------------------------------------------------------------------

type DaysOption = 30 | 90 | 365 | null;

const DATE_RANGES: { label: string; days: DaysOption }[] = [
	{ label: '30 days', days: 30 },
	{ label: '90 days', days: 90 },
	{ label: '1 year', days: 365 },
	{ label: 'All time', days: null },
];

// ---------------------------------------------------------------------------
// Funnel Stage Card
// ---------------------------------------------------------------------------

function FunnelCard({
	label,
	count,
	total,
	description,
}: {
	label: string;
	count: number;
	total: number;
	description: string;
}) {
	const pct = total > 0 ? Math.round((count / total) * 100) : 0;

	return (
		<Card>
			<CardHeader className="pb-2">
				<CardTitle className="text-sm font-medium text-muted-foreground">
					{label}
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="text-3xl font-bold tabular-nums">
					{count.toLocaleString()}
				</div>
				<p className="mt-1 text-xs text-muted-foreground">{description}</p>
				{total > 0 && (
					<>
						<p className="mt-2 text-xs font-medium tabular-nums">
							{pct}% of submitted
						</p>
						<div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
							<div
								className="h-full rounded-full bg-primary transition-all"
								style={{ width: `${pct}%` }}
							/>
						</div>
					</>
				)}
			</CardContent>
		</Card>
	);
}

// ---------------------------------------------------------------------------
// Stat Card
// ---------------------------------------------------------------------------

function StatCard({
	label,
	value,
	description,
}: {
	label: string;
	value: string;
	description: string;
}) {
	return (
		<Card>
			<CardHeader className="pb-2">
				<CardTitle className="text-sm font-medium text-muted-foreground">
					{label}
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="text-3xl font-bold tabular-nums">{value}</div>
				<p className="mt-1 text-xs text-muted-foreground">{description}</p>
			</CardContent>
		</Card>
	);
}

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

function DashboardSkeleton() {
	return (
		<div className="space-y-8">
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
				{Array.from({ length: 4 }).map((_, i) => (
					<Card key={i}>
						<CardHeader className="pb-2">
							<Skeleton className="h-4 w-24" />
						</CardHeader>
						<CardContent>
							<Skeleton className="h-9 w-16" />
							<Skeleton className="mt-2 h-3 w-32" />
						</CardContent>
					</Card>
				))}
			</div>
			<div className="grid grid-cols-2 gap-4">
				<Card>
					<CardHeader className="pb-2">
						<Skeleton className="h-4 w-24" />
					</CardHeader>
					<CardContent>
						<Skeleton className="h-9 w-16" />
						<Skeleton className="mt-2 h-3 w-40" />
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<Skeleton className="h-4 w-24" />
					</CardHeader>
					<CardContent>
						<Skeleton className="h-9 w-16" />
						<Skeleton className="mt-2 h-3 w-40" />
					</CardContent>
				</Card>
			</div>
			<Card>
				<CardHeader>
					<Skeleton className="h-5 w-32" />
				</CardHeader>
				<CardContent>
					<div className="space-y-3">
						{Array.from({ length: 5 }).map((_, i) => (
							<Skeleton key={i} className="h-10 w-full" />
						))}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Main dashboard
// ---------------------------------------------------------------------------

export function AnalyticsClient() {
	return (
		<PlanGate
			requiredTier="PRO"
			feature="Analytics"
			description="Track your application funnel, volunteer retention, shift fill rates, and top contributors — all in one place."
		>
			<AnalyticsDashboard />
		</PlanGate>
	);
}

function AnalyticsDashboard() {
	const [selectedDays, setSelectedDays] = useState<DaysOption>(90);

	const dashboardQ = trpc.analytics.getDashboard.useQuery(
		{ days: selectedDays },
		{ retry: false },
	);

	const data = dashboardQ.data;

	const retentionPct =
		data?.retention && data.retention.activeVolunteers > 0
			? Math.round(
					(data.retention.returningVolunteers /
						data.retention.activeVolunteers) *
						100,
				)
			: null;

	return (
		<div className="space-y-8">
			{/* Header */}
			<div className="flex flex-wrap items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold">Analytics</h1>
					<p className="text-muted-foreground">
						Volunteer engagement metrics for your organization.
					</p>
				</div>

				{/* Date range tabs */}
				<fieldset
					className="flex gap-1 rounded-lg border bg-muted p-1 m-0 min-w-0"
					aria-label="Date range"
				>
					{DATE_RANGES.map(({ label, days }) => (
						<button
							key={label}
							type="button"
							onClick={() => setSelectedDays(days)}
							aria-pressed={selectedDays === days}
							className={`min-h-11 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
								selectedDays === days
									? 'bg-background text-foreground shadow-sm'
									: 'text-muted-foreground hover:text-foreground'
							}`}
						>
							{label}
						</button>
					))}
				</fieldset>
			</div>

			{dashboardQ.isLoading ? (
				<DashboardSkeleton />
			) : data ? (
				<>
					{/* Application funnel */}
					<section>
						<h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
							Application Funnel
						</h2>
						<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
							<FunnelCard
								label="Submitted"
								count={data.funnel.submitted}
								total={data.funnel.submitted}
								description="Total applications received"
							/>
							<FunnelCard
								label="Approved"
								count={data.funnel.approved}
								total={data.funnel.submitted}
								description="Reviewed and accepted"
							/>
							<FunnelCard
								label="Shifted"
								count={data.funnel.shifted}
								total={data.funnel.submitted}
								description="Attended at least one shift"
							/>
							<FunnelCard
								label="Credentialed"
								count={data.funnel.credentialed}
								total={data.funnel.submitted}
								description="Hold a verified credential"
							/>
						</div>
					</section>

					{/* Stats row */}
					<section>
						<h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
							Engagement
						</h2>
						<div className="grid grid-cols-2 gap-4">
							<StatCard
								label="Volunteer Retention"
								value={
									retentionPct !== null
										? `${retentionPct}%`
										: selectedDays === null
											? '—'
											: '0%'
								}
								description={
									data.retention
										? `${data.retention.returningVolunteers} of ${data.retention.activeVolunteers} active volunteers returned`
										: 'Select a date range to see retention'
								}
							/>
							<StatCard
								label="Avg Shift Fill Rate"
								value={`${data.avgFillRate}%`}
								description="Average confirmed + attended / capacity across non-cancelled shifts"
							/>
						</div>
					</section>

					{/* Top volunteers */}
					<section>
						<h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
							Top Volunteers
						</h2>
						<Card>
							<CardContent className="p-0">
								{data.topVolunteers.length === 0 ? (
									<p className="px-6 py-8 text-center text-sm text-muted-foreground">
										No attended shifts recorded yet.
									</p>
								) : (
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Volunteer</TableHead>
												<TableHead className="tabular-nums text-right">
													Hours
												</TableHead>
												<TableHead className="tabular-nums text-right">
													Credentials
												</TableHead>
												<TableHead className="text-right">
													Last Active
												</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{data.topVolunteers.map((v) => (
												<TableRow key={v.userId}>
													<TableCell className="font-medium">
														{v.displayName}
													</TableCell>
													<TableCell className="tabular-nums text-right">
														{v.totalHours.toLocaleString()}
													</TableCell>
													<TableCell className="text-right">
														{v.verifiedCredentialCount > 0 ? (
															<Badge variant="secondary">
																{v.verifiedCredentialCount}
															</Badge>
														) : (
															<span className="text-muted-foreground">—</span>
														)}
													</TableCell>
													<TableCell className="text-right text-sm text-muted-foreground">
														{v.lastActiveAt
															? new Date(v.lastActiveAt).toLocaleDateString()
															: '—'}
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								)}
							</CardContent>
						</Card>
					</section>
				</>
			) : null}
		</div>
	);
}
