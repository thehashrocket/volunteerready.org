'use client';

import { BarChart3 } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/lib/trpc/client';

function StatRow({
	label,
	value,
	baseline,
}: {
	label: string;
	value: number;
	baseline?: number | null;
}) {
	return (
		<div className="flex items-baseline justify-between border-b border-border/40 py-3 last:border-0">
			<span className="text-sm text-muted-foreground">{label}</span>
			<div className="text-right">
				<span className="text-lg font-bold tabular-nums text-foreground">
					{value}
				</span>
				{baseline != null && baseline > 0 && (
					<span className="ml-2 text-xs text-muted-foreground">
						(baseline: {baseline})
					</span>
				)}
			</div>
		</div>
	);
}

export default function ImpactReportPage() {
	const { data, isLoading } = trpc.screener.getImpactReport.useQuery();

	if (isLoading) {
		return (
			<div className="space-y-4">
				<Skeleton className="h-8 w-48" />
				<Skeleton className="h-96 rounded-xl" />
			</div>
		);
	}

	if (!data) {
		return (
			<div className="space-y-4">
				<PageHeader title="Impact Report" />
				<p className="text-muted-foreground">Report not available.</p>
			</div>
		);
	}

	const baseline = data.baseline as {
		volunteerCount?: number;
		hoursPerWeek?: number;
		currentProcess?: string;
	} | null;

	const daysSinceCreation = Math.floor(
		(Date.now() - new Date(data.createdAt).getTime()) / (1000 * 60 * 60 * 24),
	);

	return (
		<div className="space-y-6">
			<PageHeader
				title="Impact Report"
				description={`${data.orgName} — ${daysSinceCreation} days on VolunteerReady`}
			/>

			{/* ── Baseline (if captured) ── */}
			{baseline && (
				<Card className="border-border/70">
					<CardContent className="pt-6">
						<h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
							Before VolunteerReady
						</h3>
						<div className="space-y-2 text-sm">
							{baseline.volunteerCount != null && (
								<p>
									<span className="text-muted-foreground">
										Volunteers managed:{' '}
									</span>
									<span className="font-semibold">
										{baseline.volunteerCount}
									</span>
								</p>
							)}
							{baseline.hoursPerWeek != null && (
								<p>
									<span className="text-muted-foreground">
										Hours/week on admin:{' '}
									</span>
									<span className="font-semibold">{baseline.hoursPerWeek}</span>
								</p>
							)}
							{baseline.currentProcess && (
								<p>
									<span className="text-muted-foreground">
										Previous process:{' '}
									</span>
									<span className="font-semibold">
										{baseline.currentProcess}
									</span>
								</p>
							)}
						</div>
					</CardContent>
				</Card>
			)}

			{/* ── Platform usage summary ── */}
			<Card className="border-border/70">
				<CardContent className="pt-6">
					<div className="mb-4 flex items-center gap-2">
						<BarChart3 className="h-5 w-5 text-primary" />
						<h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
							Platform usage
						</h3>
					</div>

					<StatRow
						label="Applications submitted"
						value={data.summary.applicationsSubmitted}
					/>
					<StatRow
						label="Applications approved"
						value={data.summary.applicationsApproved}
					/>
					<StatRow
						label="Background checks completed"
						value={data.summary.backgroundChecksCompleted}
					/>
					<StatRow
						label="Volunteers onboarded"
						value={data.summary.totalVolunteers}
						baseline={baseline?.volunteerCount}
					/>
					<StatRow label="Shifts created" value={data.summary.shiftsCreated} />
					<StatRow
						label="Credentials issued"
						value={data.summary.credentialsIssued}
					/>
				</CardContent>
			</Card>

			{!baseline && (
				<p className="text-sm text-muted-foreground">
					No baseline data was captured at onboarding. Visit{' '}
					<a href="/app/settings/onboarding" className="text-primary underline">
						Settings → Onboarding
					</a>{' '}
					to add it.
				</p>
			)}
		</div>
	);
}
