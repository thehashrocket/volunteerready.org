'use client';

import { useQueryClient } from '@tanstack/react-query';
import {
	AlertCircle,
	Award,
	Calendar,
	ChevronLeft,
	Clock,
	ExternalLink,
	MapPin,
	RefreshCw,
	ShieldCheck,
	Wifi,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { ApplicationStatusBadge } from '@/components/my-applications/ApplicationStatusBadge';
import { ScreeningStatusBadge } from '@/components/my-applications/ScreeningStatusBadge';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateRange } from '@/lib/format-date';
import { trpc } from '@/lib/trpc/client';

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
		<Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
			<Link href="/app/applications">
				<ChevronLeft className="mr-1 h-4 w-4" />
				All applications
			</Link>
		</Button>
	);

	if (query.isLoading) {
		return (
			<div className="space-y-6">
				{backButton}
				<PageHeader
					title="Loading…"
					description="Fetching application details."
				/>
				<Card>
					<CardContent className="space-y-2 pt-6">
						{Array.from({ length: 4 }).map((_, i) => (
							<Skeleton key={i} className="h-12 w-full" />
						))}
					</CardContent>
				</Card>
			</div>
		);
	}

	if (query.isError) {
		return (
			<div className="space-y-6">
				{backButton}
				<PageHeader
					title="Could not load application"
					description={query.error.message}
				/>
				<Card>
					<CardContent className="space-y-4 pt-6 text-sm text-muted-foreground">
						<Button onClick={() => query.refetch()} variant="outline" size="sm">
							<RefreshCw className="h-4 w-4" />
							Try again
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	const app = query.data;
	if (!app) return null;
	const mutate = (args: {
		id: string;
		status: 'SUBMITTED' | 'REVIEW' | 'APPROVED' | 'REJECTED';
	}) => updateMutation.mutate(args);

	return (
		<div className="space-y-6">
			{backButton}
			<PageHeader
				title={app.submittedByEmail}
				description={`Submitted ${formatDate(app.submittedAt)} · ${formatRelative(app.submittedAt)}`}
			/>

			{/* Status card */}
			<Card>
				<CardHeader>
					<CardTitle>Status</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="flex flex-wrap gap-3">
						<ApplicationStatusBadge status={app.status} />
						<ScreeningStatusBadge status={app.screeningStatus} />
					</div>

					{app.screeningReasons.length > 0 && (
						<div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
							<div className="flex items-center gap-2 text-sm font-medium text-destructive">
								<AlertCircle className="h-4 w-4 shrink-0" />
								{app.screeningReasons.length} screening flag
								{app.screeningReasons.length > 1 ? 's' : ''} detected
							</div>
							<ul className="mt-2 list-disc space-y-1 pl-6 text-sm text-muted-foreground">
								{app.screeningReasons.map((reason, i) => (
									<li key={i}>{reason}</li>
								))}
							</ul>
						</div>
					)}

					{/* Contextual status actions */}
					<div className="flex flex-wrap items-center gap-2 border-t pt-4">
						{app.status === 'SUBMITTED' && (
							<Button
								size="sm"
								variant="outline"
								disabled={updateMutation.isPending}
								onClick={() => mutate({ id: app.id, status: 'REVIEW' })}
							>
								Move to Review
							</Button>
						)}
						{app.status === 'REVIEW' && (
							<>
								<Button
									size="sm"
									disabled={updateMutation.isPending}
									onClick={() => mutate({ id: app.id, status: 'APPROVED' })}
								>
									Approve
								</Button>
								<Button
									size="sm"
									variant="destructive"
									disabled={updateMutation.isPending}
									onClick={() => mutate({ id: app.id, status: 'REJECTED' })}
								>
									Reject
								</Button>
							</>
						)}
						{(app.status === 'APPROVED' || app.status === 'REJECTED') && (
							<Button
								size="sm"
								variant="ghost"
								className="text-muted-foreground"
								disabled={updateMutation.isPending}
								onClick={() => mutate({ id: app.id, status: 'SUBMITTED' })}
							>
								Reset to Submitted
							</Button>
						)}
					</div>
				</CardContent>
			</Card>

			{/* Linked opportunity card */}
			{app.opportunity && (
				<Card>
					<CardHeader>
						<CardTitle>Linked opportunity</CardTitle>
					</CardHeader>
					<CardContent>
						<dl className="divide-y">
							<div className="py-3 first:pt-0">
								<dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
									Position
								</dt>
								<dd className="mt-1 text-sm font-medium">
									{app.opportunity.title}
								</dd>
							</div>
							{(app.opportunity.location || app.opportunity.isRemote) && (
								<div className="py-3">
									<dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
										Location
									</dt>
									<dd className="mt-1 flex flex-wrap items-center gap-3 text-sm">
										{app.opportunity.isRemote && (
											<span className="flex items-center gap-1 text-muted-foreground">
												<Wifi className="h-3 w-3" /> Remote
											</span>
										)}
										{app.opportunity.location && (
											<span className="flex items-center gap-1 text-muted-foreground">
												<MapPin className="h-3 w-3" />{' '}
												{app.opportunity.location}
											</span>
										)}
									</dd>
								</div>
							)}
							{formatDateRange(
								app.opportunity.startDate,
								app.opportunity.endDate,
							) && (
								<div className="py-3">
									<dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
										Dates
									</dt>
									<dd className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
										<Calendar className="h-3 w-3" />
										{formatDateRange(
											app.opportunity.startDate,
											app.opportunity.endDate,
										)}
									</dd>
								</div>
							)}
							{app.opportunity.commitmentHours != null && (
								<div className="py-3 last:pb-0">
									<dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
										Commitment
									</dt>
									<dd className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
										<Clock className="h-3 w-3" />
										{app.opportunity.commitmentHours}h/week
									</dd>
								</div>
							)}
						</dl>
					</CardContent>
				</Card>
			)}

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
						<dl className="divide-y">
							{app.answers.map((answer) => (
								<div key={answer.id} className="py-4 first:pt-0 last:pb-0">
									<dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
										{answer.prompt}
									</dt>
									<dd className="mt-1 text-sm">
										{answer.displayValue || (
											<span className="italic text-muted-foreground">
												No answer provided
											</span>
										)}
									</dd>
								</div>
							))}
						</dl>
					)}
				</CardContent>
			</Card>

			{/* Credential sharing request card */}
			<CredentialRequestCard applicationId={app.id} />

			{/* Volunteer identity panel (only if applicant has a user account) */}
			{app.submittedByUserId && (
				<VolunteerIdentityPanel userId={app.submittedByUserId} />
			)}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Credential request card — staff can request volunteer to share credentials
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Volunteer identity panel — shown when applicant has a VolunteerReady account
// ---------------------------------------------------------------------------

function VolunteerIdentityPanel({ userId }: { userId: string }) {
	const query = trpc.profile.getOrgVisibleProfile.useQuery({ userId });

	if (query.isLoading) {
		return (
			<Card>
				<CardContent className="space-y-2 pt-6">
					<Skeleton className="h-5 w-32" />
					<Skeleton className="h-4 w-full" />
					<Skeleton className="h-4 w-3/4" />
				</CardContent>
			</Card>
		);
	}

	const profile = query.data;
	// No data = private profile, no-show, or not-found — all treated as no panel.
	if (!profile) return null;

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Award className="h-5 w-5 text-primary" />
					Volunteer identity
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				{/* Stats row */}
				<div className="flex flex-wrap gap-6">
					<div>
						<p className="font-tabular-nums text-xl font-bold tabular-nums">
							{profile.totalHours}h
						</p>
						<p className="text-xs uppercase tracking-widest text-muted-foreground">
							Hours served
						</p>
					</div>
					{profile.orgCount > 0 && (
						<div>
							<p className="font-tabular-nums text-xl font-bold tabular-nums">
								{profile.orgCount}
							</p>
							<p className="text-xs uppercase tracking-widest text-muted-foreground">
								Org{profile.orgCount !== 1 ? 's' : ''}
							</p>
						</div>
					)}
					{profile.reliabilityScore !== null && (
						<div>
							<p className="font-tabular-nums text-xl font-bold tabular-nums text-primary">
								{profile.reliabilityScore}%
							</p>
							<p className="text-xs uppercase tracking-widest text-muted-foreground">
								Reliability
							</p>
						</div>
					)}
				</div>

				{/* Credential badges — deduplicated by type */}
				{profile.credentials.length > 0 && (
					<div className="flex flex-wrap gap-2">
						{[...new Set(profile.credentials.map((c) => c.label))].map(
							(label) => (
								<span
									key={label}
									className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
								>
									<ShieldCheck className="h-3 w-3" />
									{label}
								</span>
							),
						)}
					</div>
				)}

				{/* Link to public profile */}
				<a
					href={`/v/${userId}`}
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
				>
					View public profile
					<ExternalLink className="h-3 w-3" />
				</a>
			</CardContent>
		</Card>
	);
}

// ---------------------------------------------------------------------------
// Credential request card — staff can request volunteer to share credentials
// ---------------------------------------------------------------------------

function CredentialRequestCard({ applicationId }: { applicationId: string }) {
	const countQuery = trpc.credentialSharing.externalCredentialCount.useQuery({
		applicationId,
	});

	const requestMutation = trpc.credentialSharing.requestSharing.useMutation({
		onSuccess: () => {
			toast.success('Credential sharing request sent to volunteer.');
		},
		onError: (err) => {
			toast.error(err.message ?? 'Failed to send request.');
		},
	});

	const count = countQuery.data?.count ?? 0;

	if (countQuery.isLoading || count === 0) return null;

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<ShieldCheck className="h-5 w-5 text-primary" />
					Portable credentials
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3">
				<p className="text-sm text-muted-foreground">
					This volunteer has{' '}
					<span className="font-medium text-foreground">
						{count} verified credential{count !== 1 ? 's' : ''}
					</span>{' '}
					at other organizations.
				</p>
				<Button
					size="sm"
					variant="outline"
					onClick={() => requestMutation.mutate({ applicationId })}
					disabled={requestMutation.isPending || requestMutation.isSuccess}
				>
					{requestMutation.isSuccess
						? 'Request sent'
						: requestMutation.isPending
							? 'Sending…'
							: 'Request credential sharing'}
				</Button>
			</CardContent>
		</Card>
	);
}
