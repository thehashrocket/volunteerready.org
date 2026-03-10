'use client';

import { AlertTriangle, FileText, RefreshCw, Search } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/empty-state';
import { ApplicationStatusBadge } from '@/components/my-applications/ApplicationStatusBadge';
import { ScreeningStatusBadge } from '@/components/my-applications/ScreeningStatusBadge';
import { PageHeader } from '@/components/page-header';
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
import { formatDate } from '@/lib/format-date';
import { trpc } from '@/lib/trpc/client';

export default function MyApplicationsPage() {
	const query = trpc.screener.myApplications.useQuery();

	if (query.isLoading) {
		return (
			<div className="space-y-6">
				<PageHeader
					title="My applications"
					description="Track the status of your volunteer applications."
				/>
				<Card>
					<CardContent className="space-y-2 pt-6">
						{Array.from({ length: 4 }).map((_, i) => (
							<Skeleton key={i} className="h-10 w-full" />
						))}
					</CardContent>
				</Card>
			</div>
		);
	}

	if (query.isError) {
		return (
			<div className="space-y-6">
				<PageHeader
					title="My applications"
					description="Track the status of your volunteer applications."
				/>
				<Card>
					<CardHeader>
						<CardTitle>We couldn’t load your applications</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4 text-sm text-muted-foreground">
						<p>{query.error.message}</p>
						<Button onClick={() => query.refetch()} variant="outline" size="sm">
							<RefreshCw className="h-4 w-4" />
							Try again
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	const applications = query.data ?? [];

	return (
		<div className="space-y-6">
			<PageHeader
				title="My applications"
				description="Track the status of your volunteer applications."
			/>

			{applications.length === 0 ? (
				<EmptyState
					title="No applications yet"
					description="Browse volunteer opportunities and apply to get started."
					icon={FileText}
					action={
						<Button asChild variant="outline">
							<Link href="/opportunities">
								<Search className="h-4 w-4" />
								Browse opportunities
							</Link>
						</Button>
					}
				/>
			) : (
				<Card>
					<CardHeader>
						<CardTitle>Recent submissions</CardTitle>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Submitted</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Screening</TableHead>
									<TableHead>Organization</TableHead>
									<TableHead>Flags</TableHead>
									<TableHead className="text-right">Details</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{applications.map((application) => (
									<TableRow key={application.id}>
										<TableCell>{formatDate(application.submittedAt)}</TableCell>
										<TableCell>
											<ApplicationStatusBadge status={application.status} />
										</TableCell>
										<TableCell>
											<ScreeningStatusBadge
												status={application.screeningStatus}
											/>
										</TableCell>
										<TableCell>
											{application.organization?.name ?? '—'}
										</TableCell>
										<TableCell>{application.screeningReasonsCount}</TableCell>
										<TableCell className="text-right">
											<Button variant="link" asChild>
												<Link href={`/app/my-applications/${application.id}`}>
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

			<Card>
				<CardHeader>
					<CardTitle>Status legend</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4 text-sm text-muted-foreground">
					<div className="flex flex-wrap gap-3">
						<ApplicationStatusBadge status="SUBMITTED" />
						<ApplicationStatusBadge status="REVIEW" />
						<ApplicationStatusBadge status="APPROVED" />
						<ApplicationStatusBadge status="REJECTED" />
					</div>
					<p>
						Application status reflects the human review decision. Screening
						status is the automated result based on your answers.
					</p>
					<div className="flex flex-wrap gap-3">
						<ScreeningStatusBadge status="PASS" />
						<ScreeningStatusBadge status="REVIEW" />
						<ScreeningStatusBadge status="FAIL" />
					</div>
					<div className="flex items-center gap-2 text-xs">
						<AlertTriangle className="h-4 w-4 text-amber-500" />
						<span>
							Flags indicate the number of screening reasons attached to the
							application.
						</span>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
