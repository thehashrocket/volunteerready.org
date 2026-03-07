'use client';

import Link from 'next/link';
import { useState } from 'react';
import { FileText, RefreshCw } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
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

function flagCount(screeningReasons: unknown): number {
	return Array.isArray(screeningReasons) ? screeningReasons.length : 0;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ApplicationsPage() {
	const [status, setStatus] = useState<string>('');

	const query = trpc.screener.list.useQuery({
		status: (status || undefined) as
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
				<Card>
					<CardHeader>
						<CardTitle>Loading applications…</CardTitle>
					</CardHeader>
					<CardContent className="text-sm text-muted-foreground">
						Fetching your latest applications.
					</CardContent>
				</Card>
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
							<SelectItem value="">All statuses</SelectItem>
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
									<TableHead>Status</TableHead>
									<TableHead>Screening</TableHead>
									<TableHead>Flags</TableHead>
									<TableHead className="text-right">Details</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{applications.map((app) => (
									<TableRow key={app.id}>
										<TableCell>
											{formatDate(app.submittedAt)}
										</TableCell>
										<TableCell className="font-medium">
											{app.submittedByEmail}
										</TableCell>
										<TableCell>
											<ApplicationStatusBadge status={app.status} />
										</TableCell>
										<TableCell>
											<ScreeningStatusBadge
												status={app.screeningStatus}
											/>
										</TableCell>
										<TableCell>
											{flagCount(app.screeningReasons)}
										</TableCell>
										<TableCell className="text-right">
											<Button variant="link" asChild>
												<Link
													href={`/app/applications/${app.id}`}
												>
													View
												</Link>
											</Button>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
