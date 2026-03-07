'use client';

import { ChevronRight, FileText, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { ApplicationStatusBadge } from '@/components/my-applications/ApplicationStatusBadge';
import { ScreeningStatusBadge } from '@/components/my-applications/ScreeningStatusBadge';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import { formatDate, formatRelative } from '@/lib/format-date';
import { trpc } from '@/lib/trpc/client';

function flagCount(screeningReasons: unknown): number {
	return Array.isArray(screeningReasons) ? screeningReasons.length : 0;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TableSkeleton() {
	return (
		<Card>
			<CardContent className="pt-6">
				<Table>
					<TableHeader>
						<TableRow>
							{[
								'Submitted',
								'Email',
								'Opportunity',
								'Status',
								'Screening',
								'Flags',
								'',
							].map((h) => (
								<TableHead key={h}>{h}</TableHead>
							))}
						</TableRow>
					</TableHeader>
					<TableBody>
						{Array.from({ length: 5 }).map((_, i) => (
							<TableRow key={i}>
								{[112, 160, 120, 64, 64, 48, 24].map((w, j) => (
									<TableCell key={j}>
										<Skeleton className="h-4" style={{ width: w }} />
									</TableCell>
								))}
							</TableRow>
						))}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ApplicationsPage() {
	const router = useRouter();
	const [status, setStatus] = useState<string>('ALL');

	const query = trpc.screener.list.useQuery({
		status: (status === 'ALL' ? undefined : status) as
			| 'SUBMITTED'
			| 'REVIEW'
			| 'APPROVED'
			| 'REJECTED'
			| undefined,
		page: 1,
		pageSize: 50,
	});

	const total = query.data?.total ?? 0;
	const applications = query.data?.items ?? [];

	if (query.isLoading) {
		return (
			<div className="space-y-6">
				<PageHeader
					title="Applications"
					description="Review and act on incoming volunteer applications."
				/>
				<TableSkeleton />
			</div>
		);
	}

	if (query.isError) {
		return (
			<div className="space-y-6">
				<PageHeader
					title="Applications"
					description="Review and act on incoming volunteer applications."
				/>
				<Card>
					<CardHeader>
						<CardTitle>We couldn't load applications</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4 text-sm text-muted-foreground">
						<p>{query.error.message}</p>
						<Button onClick={() => query.refetch()} variant="outline">
							<RefreshCw className="h-4 w-4" />
							Try again
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<PageHeader
				title="Applications"
				description={`${total} total application${total === 1 ? '' : 's'}`}
				actions={
					<Select value={status} onValueChange={setStatus}>
						<SelectTrigger className="w-44">
							<SelectValue placeholder="All statuses" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="ALL">All statuses</SelectItem>
							<SelectItem value="SUBMITTED">Submitted</SelectItem>
							<SelectItem value="REVIEW">Review</SelectItem>
							<SelectItem value="APPROVED">Approved</SelectItem>
							<SelectItem value="REJECTED">Rejected</SelectItem>
						</SelectContent>
					</Select>
				}
			/>

			{applications.length === 0 ? (
				<EmptyState
					title="No applications yet"
					description="When volunteers submit applications, they will appear here."
					icon={FileText}
				/>
			) : (
				<Card>
					<CardContent className="pt-6">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Submitted</TableHead>
									<TableHead>Email</TableHead>
									<TableHead>Opportunity</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Screening</TableHead>
									<TableHead>Flags</TableHead>
									<TableHead />
								</TableRow>
							</TableHeader>
							<TableBody>
								{applications.map((app) => {
									const flags = flagCount(app.screeningReasons);
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
											<TableCell className="text-sm text-muted-foreground">
												{app.opportunity?.title ?? (
													<span className="text-muted-foreground">—</span>
												)}
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
					</CardContent>
				</Card>
			)}
		</div>
	);
}
