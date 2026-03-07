'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
	AlertCircle,
	Calendar,
	ChevronLeft,
	ChevronRight,
	Clock,
	MapPin,
	RefreshCw,
	Users,
	Wifi,
} from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { formatDateRange } from '@/lib/format-date';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import { ApplicationStatusBadge } from '@/components/my-applications/ApplicationStatusBadge';
import { ScreeningStatusBadge } from '@/components/my-applications/ScreeningStatusBadge';
import { OpportunityDialog } from '../OpportunityDialog';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(value: Date | string) {
	const date = value instanceof Date ? value : new Date(value);
	return new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
	}).format(date);
}

function formatRelative(value: Date | string): string {
	const date = value instanceof Date ? value : new Date(value);
	const diff = Math.round((date.getTime() - Date.now()) / 1000);
	const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
	const abs = Math.abs(diff);
	if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
	if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
	if (abs < 2592000) return rtf.format(Math.round(diff / 86400), 'day');
	return rtf.format(Math.round(diff / 2592000), 'month');
}

function StatusBadge({ status }: { status: 'DRAFT' | 'PUBLISHED' | 'CLOSED' }) {
	if (status === 'PUBLISHED')
		return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Published</Badge>;
	if (status === 'CLOSED') return <Badge variant="secondary">Closed</Badge>;
	return <Badge variant="outline">Draft</Badge>;
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

	const backButton = (
		<Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
			<Link href="/app/opportunities">
				<ChevronLeft className="mr-1 h-4 w-4" />
				All opportunities
			</Link>
		</Button>
	);

	if (oppQuery.isLoading) {
		return (
			<div className="space-y-6">
				{backButton}
				<PageHeader title="Loading…" description="Fetching opportunity details." />
			</div>
		);
	}

	if (oppQuery.isError) {
		return (
			<div className="space-y-6">
				{backButton}
				<PageHeader title="Could not load opportunity" description={oppQuery.error.message} />
				<Card>
					<CardContent className="pt-6">
						<Button onClick={() => oppQuery.refetch()} variant="outline">
							<RefreshCw className="h-4 w-4" />
							Try again
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	const opp = oppQuery.data!;
	const items = appsQuery.data?.items ?? [];
	const total = appsQuery.data?.total ?? 0;

	const counts = {
		SUBMITTED: items.filter((a) => a.status === 'SUBMITTED').length,
		REVIEW: items.filter((a) => a.status === 'REVIEW').length,
		APPROVED: items.filter((a) => a.status === 'APPROVED').length,
		REJECTED: items.filter((a) => a.status === 'REJECTED').length,
	};

	const dateRange = formatDateRange(opp.startDate, opp.endDate);

	const metaParts: string[] = [];
	if (opp.isRemote) metaParts.push('Remote');
	if (opp.location) metaParts.push(opp.location);
	if (dateRange) metaParts.push(dateRange);
	if (opp.commitmentHours != null) metaParts.push(`${opp.commitmentHours}h/week`);
	if (opp.capacity != null) metaParts.push(`${opp.capacity} spots`);

	const statItems = [
		{ label: 'Total', value: total },
		{ label: 'Submitted', value: counts.SUBMITTED },
		{ label: 'Review', value: counts.REVIEW },
		{ label: 'Approved', value: counts.APPROVED },
		{ label: 'Rejected', value: counts.REJECTED },
	];

	return (
		<>
			<div className="space-y-6">
				{backButton}

				<PageHeader
					title={opp.title}
					description={metaParts.join(' · ') || 'No location or date details'}
					actions={
						<div className="flex items-center gap-2">
							<StatusBadge status={opp.status} />
							<Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
								Edit
							</Button>
						</div>
					}
				/>

				{/* Meta details */}
				<div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
					{opp.isRemote && (
						<span className="flex items-center gap-1.5">
							<Wifi className="h-4 w-4" /> Remote
						</span>
					)}
					{opp.location && (
						<span className="flex items-center gap-1.5">
							<MapPin className="h-4 w-4" /> {opp.location}
						</span>
					)}
					{dateRange && (
						<span className="flex items-center gap-1.5">
							<Calendar className="h-4 w-4" /> {dateRange}
						</span>
					)}
					{opp.commitmentHours != null && (
						<span className="flex items-center gap-1.5">
							<Clock className="h-4 w-4" /> {opp.commitmentHours}h/week
						</span>
					)}
					{opp.capacity != null && (
						<span className="flex items-center gap-1.5">
							<Users className="h-4 w-4" /> {opp.capacity} spots
						</span>
					)}
					{opp.tags.length > 0 && (
						<div className="flex flex-wrap gap-1">
							{opp.tags.map((t) => (
								<Badge key={t.id} variant="outline" className="text-xs">
									{t.name}
								</Badge>
							))}
						</div>
					)}
				</div>

				{/* Stats */}
				<div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
					{statItems.map(({ label, value }) => (
						<Card key={label}>
							<CardContent className="pb-3 pt-4 text-center">
								<div className="text-2xl font-bold tabular-nums">{value}</div>
								<div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
							</CardContent>
						</Card>
					))}
				</div>

				{/* Applications */}
				<Card>
					<CardHeader>
						<CardTitle>Applications</CardTitle>
					</CardHeader>
					<CardContent>
						{appsQuery.isLoading ? (
							<p className="text-sm text-muted-foreground">Loading applications…</p>
						) : items.length === 0 ? (
							<p className="text-sm text-muted-foreground">
								No applications for this opportunity yet.
							</p>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Submitted</TableHead>
										<TableHead>Email</TableHead>
										<TableHead>Status</TableHead>
										<TableHead>Screening</TableHead>
										<TableHead>Flags</TableHead>
										<TableHead />
									</TableRow>
								</TableHeader>
								<TableBody>
									{items.map((app) => {
										const flags = Array.isArray(app.screeningReasons)
											? app.screeningReasons.length
											: 0;
										return (
											<TableRow
												key={app.id}
												className="cursor-pointer"
												onClick={() => router.push(`/app/applications/${app.id}`)}
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

			<OpportunityDialog open={editOpen} onOpenChange={setEditOpen} opportunity={opp} />
		</>
	);
}
