'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AlertCircle, ChevronLeft, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc/client';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(value: Date | string) {
	const date = value instanceof Date ? value : new Date(value);
	return new Intl.DateTimeFormat('en-US', {
		month: 'long',
		day: 'numeric',
		year: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
	}).format(date);
}

const STATUS_LABELS: Record<string, string> = {
	SUBMITTED: 'Submitted',
	REVIEW: 'Review',
	APPROVED: 'Approved',
	REJECTED: 'Rejected',
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ApplicationDetailPage() {
	const { id } = useParams<{ id: string }>();
	const qc = useQueryClient();

	const query = trpc.screener.detail.useQuery({ id });

	const updateMutation = trpc.screener.updateApplicationStatus.useMutation({
		onSuccess: async () => {
			toast.success('Status updated.');
			await qc.invalidateQueries();
		},
		onError: (err) => {
			toast.error(err.message ?? 'Failed to update status.');
		},
	});

	const backButton = (
		<Button variant="ghost" size="sm" asChild>
			<Link href="/app/applications">
				<ChevronLeft className="mr-1 h-4 w-4" />
				Back
			</Link>
		</Button>
	);

	if (query.isLoading) {
		return (
			<div className="space-y-6">
				<PageHeader
					title="Application detail"
					description="Loading…"
					actions={backButton}
				/>
				<Card>
					<CardContent className="pt-6 text-sm text-muted-foreground">
						Fetching application details…
					</CardContent>
				</Card>
			</div>
		);
	}

	if (query.isError) {
		return (
			<div className="space-y-6">
				<PageHeader
					title="Application detail"
					description="Could not load application."
					actions={backButton}
				/>
				<Card>
					<CardContent className="space-y-4 pt-6 text-sm text-muted-foreground">
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

	const app = query.data!;

	return (
		<div className="space-y-6">
			<PageHeader
				title="Application detail"
				description={app.submittedByEmail}
				actions={backButton}
			/>

			{/* Status card */}
			<Card>
				<CardHeader>
					<CardTitle>Status</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<p className="text-sm text-muted-foreground">
						Submitted {formatDate(app.submittedAt)}
					</p>

					<div className="flex flex-wrap gap-3">
						<ApplicationStatusBadge status={app.status} />
						<ScreeningStatusBadge status={app.screeningStatus} />
					</div>

					{app.screeningReasons.length > 0 && (
						<ul className="space-y-1">
							{app.screeningReasons.map((reason, i) => (
								<li
									key={i}
									className="flex items-start gap-2 text-sm text-destructive"
								>
									<AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
									{reason}
								</li>
							))}
						</ul>
					)}

					{/* Status update controls */}
					<div className="flex flex-wrap items-center gap-2 border-t pt-4">
						<span className="text-sm font-medium text-muted-foreground">
							Update status:
						</span>
						{(
							[
								'SUBMITTED',
								'REVIEW',
								'APPROVED',
								'REJECTED',
							] as const
						).map((s) => (
							<Button
								key={s}
								size="sm"
								variant={app.status === s ? 'default' : 'outline'}
								disabled={
									app.status === s || updateMutation.isPending
								}
								onClick={() =>
									updateMutation.mutate({ id: app.id, status: s })
								}
							>
								{STATUS_LABELS[s]}
							</Button>
						))}
					</div>
				</CardContent>
			</Card>

			{/* Answers card */}
			<Card>
				<CardHeader>
					<CardTitle>Submitted answers</CardTitle>
				</CardHeader>
				<CardContent>
					{app.answers.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							No answers recorded for this application.
						</p>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className="w-1/2">
										Question
									</TableHead>
									<TableHead>Answer</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{app.answers.map((answer) => (
									<TableRow key={answer.id}>
										<TableCell className="font-medium">
											{answer.prompt}
										</TableCell>
										<TableCell>{answer.displayValue}</TableCell>
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
