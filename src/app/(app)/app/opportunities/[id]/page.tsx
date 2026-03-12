'use client';

import {
	Calendar,
	ChevronLeft,
	ChevronRight,
	Clock,
	MapPin,
	RefreshCw,
	Users,
	Wifi,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApplicationStatusBadge } from '@/components/my-applications/ApplicationStatusBadge';
import { ScreeningStatusBadge } from '@/components/my-applications/ScreeningStatusBadge';
import { OpportunityStatusBadge } from '@/components/opportunities/OpportunityStatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { formatDate, formatDateRange, formatRelative } from '@/lib/format-date';
import { trpc } from '@/lib/trpc/client';
import type { MatchResult } from '@/server/domain/volunteer-matching';
import { OpportunityDialog } from '../OpportunityDialog';

// ---------------------------------------------------------------------------
// MatchScoreBadge
// ---------------------------------------------------------------------------

function MatchScoreBadge({
	result,
}: {
	result: MatchResult | null | undefined;
}) {
	if (result === null || result === undefined) {
		return <span className="text-xs text-muted-foreground">N/A</span>;
	}

	const colorClass =
		result.matchType === 'PERFECT'
			? 'bg-success/15 text-success border-success/30'
			: result.matchType === 'PARTIAL'
				? 'bg-warning/15 text-warning border-warning/30'
				: 'bg-destructive/15 text-destructive border-destructive/30';

	const lines: string[] = [];
	if (result.matchedRequired.length > 0)
		lines.push(`✓ Required: ${result.matchedRequired.join(', ')}`);
	if (result.missingRequired.length > 0)
		lines.push(`✗ Missing: ${result.missingRequired.join(', ')}`);
	if (result.matchedPreferred.length > 0)
		lines.push(`+ Preferred: ${result.matchedPreferred.join(', ')}`);
	const tooltip = lines.join('\n') || 'No requirements';

	return (
		<span
			title={tooltip}
			className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${colorClass}`}
		>
			{result.score}
			<span className="opacity-70">{result.matchType}</span>
		</span>
	);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_LEFT_BORDER: Record<'DRAFT' | 'PUBLISHED' | 'CLOSED', string> = {
	PUBLISHED: 'border-l-success',
	DRAFT: 'border-l-neutral',
	CLOSED: 'border-l-muted-foreground',
};

// ---------------------------------------------------------------------------
// Pipeline stat card
// ---------------------------------------------------------------------------

interface PipelineStatProps {
	label: string;
	value: number;
	total: number;
	barClass: string;
}

function PipelineStat({ label, value, total, barClass }: PipelineStatProps) {
	const pct = total > 0 ? Math.round((value / total) * 100) : 0;
	return (
		<Card className="overflow-hidden">
			{/* thin colored top bar indicating share of total */}
			<div className="h-1 bg-muted">
				<div
					className={`h-full transition-all duration-700 ${barClass}`}
					style={{ width: `${pct}%` }}
				/>
			</div>
			<CardContent className="pb-4 pt-4">
				<div className="text-2xl font-bold tabular-nums">{value}</div>
				<div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
				<div className="mt-1 text-[10px] font-medium text-muted-foreground/50">
					{total > 0 ? `${pct}%` : '—'}
				</div>
			</CardContent>
		</Card>
	);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function OpportunityDashboardPage() {
	const { id } = useParams<{ id: string }>();
	const router = useRouter();
	const [editOpen, setEditOpen] = useState(false);

	const oppQuery = trpc.opportunities.get.useQuery({ id });
	const appsQuery = trpc.screener.list.useQuery({
		opportunityId: id,
		page: 1,
		pageSize: 200,
	});
	const scoresQuery = trpc.matching.getApplicationScores.useQuery({
		opportunityId: id,
	});

	const scoreMap = new Map(
		(scoresQuery.data ?? []).map((s) => [s.applicationId, s.matchResult]),
	);

	const backButton = (
		<Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
			<Link href="/app/opportunities">
				<ChevronLeft className="mr-1 h-4 w-4" />
				All opportunities
			</Link>
		</Button>
	);

	// ---- Loading state ----
	if (oppQuery.isLoading) {
		return (
			<div className="space-y-6">
				{backButton}
				{/* header skeleton */}
				<Card className="border-l-4 border-l-stone-200">
					<CardContent className="pt-6 pb-5">
						<div className="flex items-start justify-between">
							<div className="space-y-3 flex-1 mr-8">
								<Skeleton className="h-7 w-3/5" />
								<div className="flex gap-2">
									<Skeleton className="h-5 w-20 rounded-full" />
									<Skeleton className="h-5 w-32 rounded-full" />
									<Skeleton className="h-5 w-24 rounded-full" />
								</div>
							</div>
							<div className="flex gap-2">
								<Skeleton className="h-6 w-20 rounded-full" />
								<Skeleton className="h-8 w-14" />
							</div>
						</div>
					</CardContent>
				</Card>
				{/* stats skeleton */}
				<div className="grid gap-4 sm:grid-cols-[160px_1fr]">
					<Skeleton className="h-32 rounded-lg" />
					<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
						{Array.from({ length: 4 }).map((_, i) => (
							<Skeleton key={i} className="h-24 rounded-lg" />
						))}
					</div>
				</div>
				{/* table skeleton */}
				<Card>
					<CardHeader>
						<Skeleton className="h-5 w-32" />
					</CardHeader>
					<CardContent className="space-y-2">
						{Array.from({ length: 4 }).map((_, i) => (
							<Skeleton key={i} className="h-12 w-full" />
						))}
					</CardContent>
				</Card>
			</div>
		);
	}

	// ---- Error state ----
	if (oppQuery.isError) {
		return (
			<div className="space-y-6">
				{backButton}
				<Card>
					<CardContent className="pt-6">
						<p className="mb-4 text-sm text-muted-foreground">
							{oppQuery.error.message}
						</p>
						<Button
							onClick={() => oppQuery.refetch()}
							variant="outline"
							size="sm"
						>
							<RefreshCw className="mr-2 h-4 w-4" />
							Try again
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	const opp = oppQuery.data;
	if (!opp) return null;
	const items = appsQuery.data?.items ?? [];
	const total = appsQuery.data?.total ?? 0;

	const counts = {
		SUBMITTED: items.filter((a) => a.status === 'SUBMITTED').length,
		REVIEW: items.filter((a) => a.status === 'REVIEW').length,
		APPROVED: items.filter((a) => a.status === 'APPROVED').length,
		REJECTED: items.filter((a) => a.status === 'REJECTED').length,
	};

	const dateRange = formatDateRange(opp.startDate, opp.endDate);

	// Meta chips for the header
	const metaChips: { icon: React.ReactNode; label: string }[] = [];
	if (opp.isRemote)
		metaChips.push({ icon: <Wifi className="h-3 w-3" />, label: 'Remote' });
	if (opp.location)
		metaChips.push({
			icon: <MapPin className="h-3 w-3" />,
			label: opp.location,
		});
	if (dateRange)
		metaChips.push({
			icon: <Calendar className="h-3 w-3" />,
			label: dateRange,
		});
	if (opp.commitmentHours != null)
		metaChips.push({
			icon: <Clock className="h-3 w-3" />,
			label: `${opp.commitmentHours}h/week`,
		});
	if (opp.capacity != null)
		metaChips.push({
			icon: <Users className="h-3 w-3" />,
			label: `${opp.capacity} spots`,
		});

	// Capacity fill bar (approved / capacity)
	const fillPct =
		opp.capacity != null && opp.capacity > 0
			? Math.min(Math.round((counts.APPROVED / opp.capacity) * 100), 100)
			: null;

	return (
		<>
			<div className="space-y-6">
				{backButton}

				{/* ── Opportunity header card ── */}
				<Card className={`border-l-4 ${STATUS_LEFT_BORDER[opp.status]}`}>
					<CardContent className="pt-6 pb-5">
						<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
							<div className="min-w-0">
								<h1 className="text-2xl font-semibold tracking-tight">
									{opp.title}
								</h1>

								{/* Meta chips */}
								{metaChips.length > 0 && (
									<div className="mt-3 flex flex-wrap gap-1.5">
										{metaChips.map(({ icon, label }) => (
											<span
												key={label}
												className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2.5 py-0.5 text-xs text-muted-foreground"
											>
												{icon}
												{label}
											</span>
										))}
									</div>
								)}

								{/* Tags */}
								{opp.tags.length > 0 && (
									<div className="mt-2 flex flex-wrap gap-1">
										{opp.tags.map((t) => (
											<Badge key={t.id} variant="outline" className="text-xs">
												{t.name}
											</Badge>
										))}
									</div>
								)}
							</div>

							<div className="flex shrink-0 items-center gap-2">
								<OpportunityStatusBadge status={opp.status} />
								<Button
									size="sm"
									variant="outline"
									onClick={() => setEditOpen(true)}
								>
									Edit
								</Button>
							</div>
						</div>

						{/* Capacity fill bar – only when capacity is set */}
						{fillPct !== null && (
							<div className="mt-5 border-t pt-4">
								<div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
									<span>Approved volunteers</span>
									<span className="font-medium tabular-nums">
										{counts.APPROVED} / {opp.capacity}
									</span>
								</div>
								<div className="h-1.5 overflow-hidden rounded-full bg-muted">
									<div
										className="h-full rounded-full bg-success transition-all duration-700"
										style={{ width: `${fillPct}%` }}
									/>
								</div>
							</div>
						)}
					</CardContent>
				</Card>

				{/* ── Stats pipeline ── */}
				<div className="grid gap-4 sm:grid-cols-[160px_1fr]">
					{/* Hero: total applications */}
					<Card className="flex flex-col items-center justify-center border-dashed">
						<CardContent className="py-6 text-center">
							<div className="text-5xl font-bold tabular-nums leading-none">
								{total}
							</div>
							<div className="mt-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
								Applications
							</div>
						</CardContent>
					</Card>

					{/* Pipeline stages */}
					<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
						<PipelineStat
							label="Submitted"
							value={counts.SUBMITTED}
							total={total}
							barClass="bg-info"
						/>
						<PipelineStat
							label="In review"
							value={counts.REVIEW}
							total={total}
							barClass="bg-warning"
						/>
						<PipelineStat
							label="Approved"
							value={counts.APPROVED}
							total={total}
							barClass="bg-success"
						/>
						<PipelineStat
							label="Rejected"
							value={counts.REJECTED}
							total={total}
							barClass="bg-destructive"
						/>
					</div>
				</div>

				{/* ── Applications table ── */}
				<Card>
					<CardHeader className="pb-4">
						<CardTitle className="flex items-center gap-2">
							Applications
							{!appsQuery.isLoading && (
								<span className="text-sm font-normal text-muted-foreground">
									({total})
								</span>
							)}
						</CardTitle>
					</CardHeader>
					<CardContent>
						{appsQuery.isLoading ? (
							<div className="space-y-2">
								{Array.from({ length: 3 }).map((_, i) => (
									<Skeleton key={i} className="h-12 w-full" />
								))}
							</div>
						) : items.length === 0 ? (
							<div className="py-12 text-center">
								<div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
									<Users className="h-5 w-5 text-muted-foreground" />
								</div>
								<p className="text-sm font-medium text-muted-foreground">
									No applications yet
								</p>
								<p className="mt-1 text-xs text-muted-foreground">
									Applications will appear here once volunteers apply.
								</p>
							</div>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Submitted</TableHead>
										<TableHead>Email</TableHead>
										<TableHead>Status</TableHead>
										<TableHead>Screening</TableHead>
										<TableHead>Flags</TableHead>
										<TableHead>Match</TableHead>
										<TableHead />
									</TableRow>
								</TableHeader>
								<TableBody>
									{items.map((app) => {
										const flags = Array.isArray(app.screeningReasons)
											? app.screeningReasons.length
											: 0;
										const matchResult = scoresQuery.isLoading
											? undefined
											: (scoreMap.get(app.id) ?? null);
										return (
											<TableRow
												key={app.id}
												className="cursor-pointer"
												onClick={() =>
													router.push(`/app/applications/${app.id}`)
												}
											>
												<TableCell>
													<div>{formatDate(app.submittedAt)}</div>
													<div className="text-xs text-muted-foreground">
														{formatRelative(app.submittedAt)}
													</div>
												</TableCell>
												<TableCell className="font-medium">
													{app.submittedByEmail}
												</TableCell>
												<TableCell>
													<ApplicationStatusBadge status={app.status} />
												</TableCell>
												<TableCell>
													<ScreeningStatusBadge status={app.screeningStatus} />
												</TableCell>
												<TableCell>
													{flags === 0 ? (
														<span className="text-muted-foreground">—</span>
													) : (
														<Badge variant="destructive">
															{flags} flag{flags > 1 ? 's' : ''}
														</Badge>
													)}
												</TableCell>
												<TableCell>
													{scoresQuery.isLoading ? (
														<Skeleton className="h-5 w-16 rounded-full" />
													) : (
														<MatchScoreBadge result={matchResult} />
													)}
												</TableCell>
												<TableCell>
													<ChevronRight className="h-4 w-4 text-muted-foreground" />
												</TableCell>
											</TableRow>
										);
									})}
								</TableBody>
							</Table>
						)}
					</CardContent>
				</Card>
			</div>

			<OpportunityDialog
				open={editOpen}
				onOpenChange={setEditOpen}
				opportunity={opp}
			/>
		</>
	);
}
