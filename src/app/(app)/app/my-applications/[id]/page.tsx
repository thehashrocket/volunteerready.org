'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AlertCircle, ChevronLeft, FileText } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
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

export default function MyApplicationDetailPage() {
	const params = useParams<{ id: string }>();
	const applicationId = params?.id;

	const query = trpc.screener.myApplicationDetail.useQuery(
		{ id: applicationId ?? '' },
		{ enabled: Boolean(applicationId) },
	);

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
				<Card>
					<CardHeader>
						<CardTitle>Unable to load application</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4 text-sm text-muted-foreground">
						<p>{query.error.message}</p>
						<Button asChild variant="outline">
							<Link href="/app/my-applications">Back to list</Link>
						</Button>
					</CardContent>
				</Card>
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
					description="We couldn’t find that application in your account."
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

	return (
		<div className="space-y-6">
			<PageHeader
				title="Application detail"
				description={`Submitted ${formatDate(application.submittedAt)} · ${application.organization?.name ?? 'Unknown org'}`}
				actions={
					<Button asChild variant="outline">
						<Link href="/app/my-applications">
							<ChevronLeft className="h-4 w-4" />
							Back
						</Link>
					</Button>
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
