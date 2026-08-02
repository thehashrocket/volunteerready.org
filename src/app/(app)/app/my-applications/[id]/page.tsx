'use client';

import { AlertCircle, ChevronLeft, FileText } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
	QueryErrorCard,
	safeErrorMessage,
} from '@/components/app/query-error-card';
import { EmptyState } from '@/components/empty-state';
import { ApplicationStatusBadge } from '@/components/my-applications/ApplicationStatusBadge';
import { ScreeningStatusBadge } from '@/components/my-applications/ScreeningStatusBadge';
import { StatusTimeline } from '@/components/my-applications/StatusTimeline';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import { trpc } from '@/lib/trpc/client';

const WITHDRAWABLE_STATUSES = new Set(['SUBMITTED', 'REVIEW']);

export default function MyApplicationDetailPage() {
	const params = useParams<{ id: string }>();
	const applicationId = params?.id;
	const router = useRouter();
	const [withdrawOpen, setWithdrawOpen] = useState(false);

	const query = trpc.screener.myApplicationDetail.useQuery(
		{ id: applicationId ?? '' },
		{ enabled: Boolean(applicationId) },
	);

	const utils = trpc.useUtils();
	const withdrawMutation = trpc.screener.withdrawApplication.useMutation({
		onSuccess: () => {
			setWithdrawOpen(false);
			utils.screener.myApplications.invalidate();
			utils.screener.myApplicationDetail.invalidate({
				id: applicationId ?? '',
			});
			router.refresh();
		},
	});

	if (query.isLoading) {
		return (
			<div className="space-y-6">
				<PageHeader title="Application detail" />
				<Card>
					<CardHeader>
						<CardTitle>Loading application…</CardTitle>
					</CardHeader>
					<CardContent className="text-sm text-muted-foreground">
						Fetching the latest status and answers.
					</CardContent>
				</Card>
			</div>
		);
	}

	if (query.isError) {
		return (
			<div className="space-y-6">
				<PageHeader title="Application detail" />
				<QueryErrorCard
					title="Unable to load application"
					message={safeErrorMessage(query.error)}
					onRetry={() => query.refetch()}
					isRetrying={query.isFetching}
				/>
				{/* Outside the card on purpose — QueryErrorCard has one action slot
				    and it belongs to the retry. */}
				<Button asChild variant="outline">
					<Link href="/app/my-applications">Back to list</Link>
				</Button>
			</div>
		);
	}

	const application = query.data;

	if (!application) {
		return (
			<div className="space-y-6">
				<PageHeader title="Application detail" />
				<EmptyState
					title="Application not found"
					description="We couldn't find that application in your account."
					icon={FileText}
					action={
						<Button asChild variant="outline">
							<Link href="/app/my-applications">Back to list</Link>
						</Button>
					}
				/>
			</div>
		);
	}

	const canWithdraw = WITHDRAWABLE_STATUSES.has(application.status);

	return (
		<div className="space-y-6">
			<PageHeader
				title="Application detail"
				description={`Submitted ${formatDate(application.submittedAt)} · ${application.organization?.name ?? 'Unknown org'}`}
				actions={
					<div className="flex gap-2">
						{canWithdraw && (
							<Button
								variant="outline"
								onClick={() => setWithdrawOpen(true)}
								className="text-destructive hover:text-destructive"
							>
								Withdraw application
							</Button>
						)}
						<Button asChild variant="outline">
							<Link href="/app/my-applications">
								<ChevronLeft className="h-4 w-4" />
								Back
							</Link>
						</Button>
					</div>
				}
			/>

			<Card>
				<CardHeader>
					<CardTitle>Status summary</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="flex flex-wrap gap-3">
						<ApplicationStatusBadge status={application.status} />
						<ScreeningStatusBadge status={application.screeningStatus} />
					</div>
					<div className="space-y-2 text-sm text-muted-foreground">
						<p>Screening flags: {application.screeningReasons.length || 0}</p>
						{application.screeningReasons.length === 0 ? (
							<p>No screening flags were triggered.</p>
						) : (
							<ul className="space-y-1">
								{application.screeningReasons.map((reason, index) => (
									<li key={`${reason}-${index}`} className="flex gap-2">
										<AlertCircle className="mt-0.5 h-4 w-4 text-amber-500" />
										<span>{reason}</span>
									</li>
								))}
							</ul>
						)}
					</div>
				</CardContent>
			</Card>

			<StatusTimeline
				applicationId={application.id}
				submittedAt={application.submittedAt}
			/>

			<Card>
				<CardHeader>
					<CardTitle>Submitted answers</CardTitle>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Question</TableHead>
								<TableHead>Answer</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{application.answers.map((answer) => (
								<TableRow key={answer.id}>
									<TableCell className="font-medium">{answer.prompt}</TableCell>
									<TableCell>{answer.displayValue}</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</CardContent>
			</Card>

			<Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Withdraw this application?</DialogTitle>
						<DialogDescription>
							Your application will be marked as withdrawn. You can re-apply to
							this opportunity in the future if you change your mind.
						</DialogDescription>
					</DialogHeader>
					{withdrawMutation.isError && (
						<p role="alert" className="text-sm text-destructive">
							{safeErrorMessage(withdrawMutation.error) ??
								"We couldn't withdraw that application. Try again."}
						</p>
					)}
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setWithdrawOpen(false)}
							disabled={withdrawMutation.isPending}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={() =>
								withdrawMutation.mutate({ id: applicationId ?? '' })
							}
							disabled={withdrawMutation.isPending}
						>
							{withdrawMutation.isPending ? 'Withdrawing…' : 'Withdraw'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

function formatDate(value: Date | string) {
	const date = value instanceof Date ? value : new Date(value);
	return new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
	}).format(date);
}
