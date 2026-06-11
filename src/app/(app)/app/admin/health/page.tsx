'use client';

import { CheckCircle2, Clock, Loader2, Mail, XCircle } from 'lucide-react';
import { useState } from 'react';
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
import { trpc } from '@/lib/trpc/client';

function formatRelativeTime(date: Date): string {
	const now = new Date();
	const diffMs = now.getTime() - new Date(date).getTime();
	const diffMin = Math.floor(diffMs / 60000);
	const diffHr = Math.floor(diffMin / 60);
	const diffDays = Math.floor(diffHr / 24);

	if (diffMin < 1) return 'just now';
	if (diffMin < 60) return `${diffMin}m ago`;
	if (diffHr < 24) return `${diffHr}h ago`;
	return `${diffDays}d ago`;
}

export default function AdminHealthPage() {
	const cronHealth = trpc.admin.cronHealth.useQuery(undefined, {
		refetchInterval: 30_000,
	});

	const webhookHealth = trpc.admin.webhookHealth.useQuery(undefined, {
		refetchInterval: 30_000,
	});

	const bouncedEmails = trpc.admin.bouncedEmails.useQuery();

	const [reconcileWindow, setReconcileWindow] = useState('24');
	const reconcileMutation = trpc.admin.stripeReconcile.useMutation();
	const reEnableMutation = trpc.admin.reEnableBounce.useMutation({
		onSuccess: () => bouncedEmails.refetch(),
	});
	const resetAllMutation = trpc.admin.resetAllBounces.useMutation({
		onSuccess: () => bouncedEmails.refetch(),
	});

	return (
		<div className="space-y-8">
			<div>
				<h1 className="font-sans text-3xl font-bold">System Health</h1>
				<p className="text-muted-foreground mt-1">
					Cron jobs, webhook activity, and email delivery
				</p>
			</div>

			{/* Cron Job Status Cards */}
			<section>
				<h2 className="font-sans text-xl font-semibold mb-4">Cron Jobs</h2>

				{cronHealth.isLoading ? (
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						{[1, 2, 3].map((i) => (
							<Card key={i} className="bg-muted">
								<CardContent className="p-6">
									<div className="h-4 bg-neutral-200 rounded animate-pulse mb-2 w-3/4" />
									<div className="h-3 bg-neutral-200 rounded animate-pulse w-1/2" />
								</CardContent>
							</Card>
						))}
					</div>
				) : cronHealth.data ? (
					<>
						{Object.keys(cronHealth.data.latestByJob).length === 0 ? (
							<Card className="bg-muted">
								<CardContent className="p-8 text-center">
									<Clock className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
									<p className="text-muted-foreground">
										No cron jobs have run yet
									</p>
								</CardContent>
							</Card>
						) : (
							<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
								{Object.entries(cronHealth.data.latestByJob).map(
									([jobName, run]) => (
										<Card key={jobName} className="bg-muted">
											<CardContent className="p-6">
												<div className="flex items-center justify-between">
													<p className="font-medium font-mono text-sm">
														{jobName}
													</p>
													{run.status === 'SUCCESS' ? (
														<CheckCircle2 className="h-5 w-5 text-primary" />
													) : (
														<XCircle className="h-5 w-5 text-destructive" />
													)}
												</div>
												<p
													className={`text-sm mt-1 tabular-nums ${
														run.status === 'SUCCESS'
															? 'text-primary'
															: 'text-destructive'
													}`}
												>
													{run.status === 'SUCCESS' ? '✓' : '✗'}{' '}
													{formatRelativeTime(run.startedAt)}
												</p>
												{run.durationMs != null && (
													<p className="text-xs text-muted-foreground mt-1 tabular-nums">
														{run.durationMs}ms
													</p>
												)}
											</CardContent>
										</Card>
									),
								)}
							</div>
						)}

						{/* Alerts */}
						{cronHealth.data.alerts.length > 0 && (
							<div className="mt-4 rounded-md border border-destructive/50 bg-destructive/5 p-4">
								<p className="font-semibold text-destructive text-sm">
									Cron Failure Alerts
								</p>
								{cronHealth.data.alerts.map((alert) => (
									<p
										key={alert.jobName}
										className="text-sm text-destructive mt-1"
									>
										{alert.jobName}: {alert.consecutiveFailures} consecutive
										failures
									</p>
								))}
							</div>
						)}

						{/* Recent Runs Table */}
						<div className="mt-6">
							<h3 className="font-semibold mb-2">Recent Runs</h3>
							<div className="rounded-md border">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Job</TableHead>
											<TableHead>Status</TableHead>
											<TableHead>Started</TableHead>
											<TableHead>Duration</TableHead>
											<TableHead>Details</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{cronHealth.data.recentRuns.map((run) => (
											<TableRow key={run.id}>
												<TableCell className="font-mono text-sm">
													{run.jobName}
												</TableCell>
												<TableCell>
													{run.status === 'SUCCESS' ? (
														<span className="text-primary text-sm">
															✓ Success
														</span>
													) : (
														<span className="text-destructive text-sm">
															✗ Failed
														</span>
													)}
												</TableCell>
												<TableCell className="tabular-nums text-sm">
													{new Date(run.startedAt).toLocaleString()}
												</TableCell>
												<TableCell className="tabular-nums text-sm">
													{run.durationMs != null ? `${run.durationMs}ms` : '—'}
												</TableCell>
												<TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
													{run.error ??
														(run.resultSummary
															? JSON.stringify(run.resultSummary)
															: '—')}
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>
						</div>
					</>
				) : null}
			</section>

			{/* Stripe Reconciliation */}
			<section>
				<h2 className="font-sans text-xl font-semibold mb-4">
					Stripe Reconciliation
				</h2>
				<Card className="bg-muted">
					<CardHeader>
						<CardTitle className="text-base">
							Check for missed webhook events
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-center gap-4">
							<Select
								value={reconcileWindow}
								onValueChange={setReconcileWindow}
							>
								<SelectTrigger className="w-[160px]">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="24">Last 24 hours</SelectItem>
									<SelectItem value="168">Last 7 days</SelectItem>
									<SelectItem value="720">Last 30 days</SelectItem>
								</SelectContent>
							</Select>
							<Button
								onClick={() =>
									reconcileMutation.mutate({
										windowHours: Number(reconcileWindow),
									})
								}
								disabled={reconcileMutation.isPending}
							>
								{reconcileMutation.isPending ? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										Checking events...
									</>
								) : (
									'Reconcile Now'
								)}
							</Button>
						</div>

						{/* Results */}
						{reconcileMutation.isSuccess && (
							<div className="mt-6">
								<div className="rounded-md border bg-background p-4">
									{reconcileMutation.data.eventsReplayed === 0 &&
									reconcileMutation.data.eventsFailed === 0 ? (
										<p className="text-primary font-medium">
											All events reconciled ✓
										</p>
									) : (
										<p className="font-medium">
											{reconcileMutation.data.eventsReplayed} events replayed,{' '}
											{reconcileMutation.data.eventsFailed} failed,{' '}
											{reconcileMutation.data.alreadyProcessed} already
											processed
										</p>
									)}
									<p className="text-sm text-muted-foreground mt-1">
										{reconcileMutation.data.eventsChecked} events checked in
										total
									</p>
								</div>

								{reconcileMutation.data.details.length > 0 && (
									<details className="mt-4">
										<summary className="cursor-pointer text-sm font-medium">
											Event details ({reconcileMutation.data.details.length})
										</summary>
										<div className="mt-2 rounded-md border">
											<Table>
												<TableHeader>
													<TableRow>
														<TableHead>Event ID</TableHead>
														<TableHead>Type</TableHead>
														<TableHead>Status</TableHead>
														<TableHead>Timestamp</TableHead>
													</TableRow>
												</TableHeader>
												<TableBody>
													{reconcileMutation.data.details.map((detail) => (
														<TableRow key={detail.eventId}>
															<TableCell className="font-mono text-xs">
																{detail.eventId.slice(0, 20)}
																...
															</TableCell>
															<TableCell className="text-sm">
																{detail.type}
															</TableCell>
															<TableCell className="text-sm">
																{detail.status}
															</TableCell>
															<TableCell className="tabular-nums text-sm">
																{new Date(detail.timestamp).toLocaleString()}
															</TableCell>
														</TableRow>
													))}
												</TableBody>
											</Table>
										</div>
									</details>
								)}
							</div>
						)}

						{reconcileMutation.isError && (
							<div
								className="mt-4 rounded-md border border-destructive/50 bg-destructive/5 p-4"
								role="alert"
							>
								<p className="text-sm text-destructive">
									Stripe API error — try again
								</p>
							</div>
						)}
					</CardContent>
				</Card>
			</section>

			{/* Webhook Health */}
			<section>
				<h2 className="font-sans text-xl font-semibold mb-4">
					Webhook Activity
				</h2>

				{webhookHealth.isLoading ? (
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						{[1, 2, 3].map((i) => (
							<Card key={i} className="bg-muted">
								<CardContent className="p-6">
									<div className="h-4 bg-neutral-200 rounded animate-pulse mb-2 w-3/4" />
									<div className="h-3 bg-neutral-200 rounded animate-pulse w-1/2" />
								</CardContent>
							</Card>
						))}
					</div>
				) : webhookHealth.data ? (
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						{webhookHealth.data.providers.map((provider) => (
							<Card key={provider.key} className="bg-muted">
								<CardContent className="p-6">
									<div className="flex items-center justify-between mb-3">
										<p className="font-medium">{provider.label}</p>
										<span className="text-2xl font-semibold tabular-nums">
											{provider.total}
										</span>
									</div>
									<p className="text-xs text-muted-foreground mb-2">
										Last {webhookHealth.data.windowHours}h
									</p>
									{Object.keys(provider.byType).length > 0 ? (
										<div className="space-y-1">
											{Object.entries(provider.byType).map(([type, count]) => (
												<div
													key={type}
													className="flex items-center justify-between text-sm"
												>
													<span className="font-mono text-xs truncate mr-2">
														{type}
													</span>
													<span className="tabular-nums text-muted-foreground">
														{count as number}
													</span>
												</div>
											))}
										</div>
									) : (
										<p className="text-sm text-muted-foreground">
											No events in window
										</p>
									)}
								</CardContent>
							</Card>
						))}
					</div>
				) : null}
			</section>

			{/* Email Bounce Management */}
			<section>
				<h2 className="font-sans text-xl font-semibold mb-4">
					Email Bounce Management
				</h2>
				<Card className="bg-muted">
					<CardHeader>
						<div className="flex items-center justify-between">
							<CardTitle className="text-base">Suppressed Addresses</CardTitle>
							{bouncedEmails.data && bouncedEmails.data.length > 0 && (
								<Button
									variant="outline"
									size="sm"
									onClick={() => resetAllMutation.mutate()}
									disabled={resetAllMutation.isPending}
								>
									{resetAllMutation.isPending ? (
										<Loader2 className="mr-2 h-3 w-3 animate-spin" />
									) : null}
									Reset All
								</Button>
							)}
						</div>
					</CardHeader>
					<CardContent>
						{bouncedEmails.isLoading ? (
							<div className="h-8 bg-neutral-200 rounded animate-pulse w-1/2" />
						) : bouncedEmails.data && bouncedEmails.data.length > 0 ? (
							<div className="rounded-md border">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Email</TableHead>
											<TableHead>Bounces</TableHead>
											<TableHead>Suppressed</TableHead>
											<TableHead>Last Bounce</TableHead>
											<TableHead />
										</TableRow>
									</TableHeader>
									<TableBody>
										{bouncedEmails.data.map((bounce) => (
											<TableRow key={bounce.id}>
												<TableCell className="font-mono text-sm">
													{bounce.email}
												</TableCell>
												<TableCell className="tabular-nums text-sm">
													{bounce.bounceCount}
												</TableCell>
												<TableCell className="tabular-nums text-sm">
													{bounce.suppressedAt
														? formatRelativeTime(bounce.suppressedAt)
														: '—'}
												</TableCell>
												<TableCell className="tabular-nums text-sm">
													{bounce.lastBouncedAt
														? formatRelativeTime(bounce.lastBouncedAt)
														: '—'}
												</TableCell>
												<TableCell>
													<Button
														variant="ghost"
														size="sm"
														onClick={() =>
															reEnableMutation.mutate({
																email: bounce.email,
															})
														}
														disabled={reEnableMutation.isPending}
													>
														Re-enable
													</Button>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>
						) : (
							<div className="py-6 text-center">
								<Mail className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
								<p className="text-muted-foreground">
									No suppressed addresses — all clear
								</p>
							</div>
						)}

						{resetAllMutation.isSuccess && (
							<p className="mt-3 text-sm text-primary">
								{resetAllMutation.data.count} address(es) re-enabled
							</p>
						)}
					</CardContent>
				</Card>
			</section>
		</div>
	);
}
