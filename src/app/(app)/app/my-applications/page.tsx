'use client';

import { AlertTriangle, FileText, RefreshCw, Search } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { safeErrorMessage } from '@/components/app/query-error-card';
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

/**
 * Anonymous applications submitted under this user's address are offered here
 * for explicit confirmation rather than attached automatically. Anyone can POST
 * a public application bearing someone else's email, and attaching one grants
 * the receiving org a relationship edge over this user — so the user, not the
 * server, decides.
 */
function ClaimableApplications({
	onCountChange,
}: {
	onCountChange: (count: number) => void;
}) {
	const utils = trpc.useUtils();
	const query = trpc.screener.claimableApplications.useQuery();
	// Which row is awaiting decline confirmation. Inline rather than a modal so
	// the organization name stays on screen while the user decides — that name is
	// the entire basis for the decision.
	const [confirmingId, setConfirmingId] = useState<string | null>(null);
	const claim = trpc.screener.claimApplication.useMutation({
		onSuccess: async () => {
			await Promise.all([
				utils.screener.claimableApplications.invalidate(),
				utils.screener.myApplications.invalidate(),
			]);
		},
	});
	const decline = trpc.screener.declineApplication.useMutation({
		onSuccess: async () => {
			setConfirmingId(null);
			await utils.screener.claimableApplications.invalidate();
		},
	});

	const claimable = query.data ?? [];
	// Only a resolved, successful query reports a count. An errored query must
	// report 0 so the page's empty state still renders — a broken candidate
	// fetch must not imply an application exists.
	const visibleCount = query.isLoading || query.isError ? 0 : claimable.length;

	useEffect(() => {
		onCountChange(visibleCount);
	}, [visibleCount, onCountChange]);

	// Fails silent on purpose: this card is an OFFER, not a promise. Surfacing
	// an error here would tell a user an application might exist under their
	// address when we could not confirm one does.
	if (query.isLoading || query.isError || claimable.length === 0) {
		return null;
	}

	const isSingle = claimable.length === 1;

	return (
		<Card>
			<CardHeader>
				<CardTitle>Is this you?</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<p className="text-sm text-muted-foreground">
					We found {isSingle ? 'an application' : 'applications'} submitted with
					your email address before you signed in. Add{' '}
					{isSingle ? 'it' : 'them'} to your account only if you recognize{' '}
					{isSingle ? 'it' : 'them'} — the organization will be able to see your
					volunteer profile once you do. If you don’t recognize{' '}
					{isSingle ? 'it' : 'one'}, choose <strong>Not mine</strong> and we
					won’t ask again.
				</p>
				<ul className="divide-y rounded-md border">
					{claimable.map((application) => {
						const orgName =
							application.organization?.name ?? 'unknown organization';
						const submitted = formatDate(application.submittedAt);
						const isConfirming = confirmingId === application.id;

						return (
							<li
								key={application.id}
								className="flex flex-wrap items-center justify-between gap-3 p-3"
							>
								<div className="min-w-0 text-sm">
									<p className="break-words font-medium">
										{application.organization?.name ?? 'Unknown organization'}
									</p>
									<p className="text-muted-foreground">
										{/* Phrased as a question, never as a completed outcome. An
										    earlier version asserted "We won't offer this one again."
										    while the alert below could be saying the removal
										    failed — the row claiming something the server had
										    refused. */}
										{isConfirming
											? 'Remove this from your list?'
											: `Submitted ${submitted}`}
									</p>
								</div>
								{isConfirming ? (
									<div className="flex flex-wrap gap-2">
										<Button
											size="sm"
											variant="outline"
											disabled={decline.isPending}
											onClick={() => setConfirmingId(null)}
											aria-label={`Keep showing this application from ${orgName}`}
										>
											Cancel
										</Button>
										<Button
											size="sm"
											variant="destructive"
											disabled={decline.isPending}
											onClick={() => decline.mutate({ id: application.id })}
											aria-label={`Confirm this application from ${orgName}, submitted ${submitted}, is not mine`}
										>
											Yes, remove it
										</Button>
									</div>
								) : (
									<div className="flex flex-wrap gap-2">
										{/* Same size and variant as the accept control on purpose.
										    Declining is the SAFE choice on this card — the accept
										    grants an organization a relationship edge — so the
										    refusal must not look weaker or more dangerous than the
										    acceptance. */}
										<Button
											size="sm"
											variant="outline"
											disabled={claim.isPending || decline.isPending}
											onClick={() => setConfirmingId(application.id)}
											aria-label={`Not mine: ${orgName}, submitted ${submitted}`}
										>
											Not mine
										</Button>
										<Button
											size="sm"
											variant="outline"
											disabled={claim.isPending || decline.isPending}
											onClick={() => claim.mutate({ id: application.id })}
											// Every row's visible label is identical, so without this a
											// screen reader announces "Add to my account" N times with
											// nothing to distinguish which org each grants access to.
											// Leads with the visible label verbatim so voice control
											// still matches what the user reads (WCAG 2.5.3).
											aria-label={`Add to my account: ${orgName}, submitted ${submitted}`}
										>
											Add to my account
										</Button>
									</div>
								)}
							</li>
						);
					})}
				</ul>
				{claim.isError ? (
					<p role="alert" className="text-sm text-destructive">
						{/* Allowlisted by code — an INTERNAL_SERVER_ERROR here would be a
						    raw Prisma string, and this card is shown to volunteers. */}
						{safeErrorMessage(claim.error) ??
							"We couldn't add that application. Try again."}
					</p>
				) : null}
				{decline.isError ? (
					<p role="alert" className="text-sm text-destructive">
						{safeErrorMessage(decline.error) ??
							"We couldn't remove that application. Try again."}
					</p>
				) : null}
			</CardContent>
		</Card>
	);
}

export default function MyApplicationsPage() {
	const query = trpc.screener.myApplications.useQuery();
	const [claimableCount, setClaimableCount] = useState(0);

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

			<ClaimableApplications onCountChange={setClaimableCount} />

			{/* Suppressed while candidates are pending: "No applications yet" directly
			    under "We found an application submitted with your email" reads as a
			    contradiction, and this is the feature's PRIMARY first-run state — a
			    volunteer who applied anonymously, then signed up. */}
			{applications.length === 0 && claimableCount === 0 ? (
				<EmptyState
					title="No applications yet"
					description="Browse volunteer opportunities and apply to get started."
					icon={FileText}
					action={
						<Button asChild variant="outline">
							<Link href="/app/browse">
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
