'use client';

import {
	Award,
	Calendar,
	Clock,
	FileText,
	MapPin,
	Shield,
	Users,
} from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/lib/trpc/client';

// ---------------------------------------------------------------------------
// KPI Rail
// ---------------------------------------------------------------------------

function KpiItem({
	label,
	value,
	icon: Icon,
}: {
	label: string;
	value: number;
	icon: React.ComponentType<{ className?: string }>;
}) {
	return (
		<div className="flex items-center gap-3 flex-1 min-w-0">
			<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/8">
				<Icon className="h-4 w-4 text-primary" />
			</div>
			<div>
				<div className="font-mono text-xl font-bold tabular-nums tracking-tight">
					{value}
				</div>
				<div className="text-xs text-muted-foreground">{label}</div>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function VolunteerDashboard() {
	const { data, isLoading } = trpc.volunteer.getDashboard.useQuery();

	return (
		<div className="space-y-6">
			<PageHeader
				title="My Dashboard"
				description="Your upcoming commitments and impact."
			/>

			{/* ── KPI Rail ── */}
			{isLoading ? (
				<div className="flex gap-6">
					{Array.from({ length: 4 }).map((_, i) => (
						<Skeleton key={i} className="h-14 flex-1" />
					))}
				</div>
			) : data?.impact ? (
				<div className="flex flex-wrap gap-6 border-b border-border/60 pb-6">
					<KpiItem
						label="Hours volunteered"
						value={data.impact.totalHours}
						icon={Clock}
					/>
					<KpiItem
						label="Organizations served"
						value={data.impact.orgsServed}
						icon={Users}
					/>
					<KpiItem
						label="Shifts attended"
						value={data.impact.shiftsAttended}
						icon={Calendar}
					/>
					<KpiItem
						label="Verified credentials"
						value={data.impact.verifiedCredentials}
						icon={Award}
					/>
				</div>
			) : null}

			{/* ── Primary content grid ── */}
			<div className="grid gap-6 lg:grid-cols-2">
				{/* ── Upcoming shifts ── */}
				<Card className="border-border/70">
					<CardHeader className="pb-3">
						<CardTitle className="flex items-center gap-2 text-base font-semibold">
							<Calendar className="h-4 w-4 text-primary" />
							Upcoming shifts
						</CardTitle>
					</CardHeader>
					<CardContent>
						{isLoading ? (
							<div className="space-y-3">
								{Array.from({ length: 3 }).map((_, i) => (
									<Skeleton key={i} className="h-16 rounded-lg" />
								))}
							</div>
						) : !data?.upcomingShifts.length ? (
							<div className="py-6 text-center">
								<p className="text-sm text-muted-foreground">
									No upcoming shifts.
								</p>
								<Button asChild variant="outline" size="sm" className="mt-3">
									<Link href="/app/my-shifts">Browse shifts</Link>
								</Button>
							</div>
						) : (
							<div className="space-y-3">
								{data.upcomingShifts.map((signup) => (
									<div
										key={signup.id}
										className="flex items-start justify-between rounded-lg border border-border/50 p-3"
									>
										<div className="min-w-0 flex-1">
											<p className="font-medium text-sm truncate">
												{signup.shift.title}
											</p>
											<p className="text-xs text-muted-foreground mt-0.5">
												{signup.shift.organization.name}
											</p>
											<div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
												<span className="flex items-center gap-1">
													<Calendar className="h-3 w-3" />
													{new Date(signup.shift.startTime).toLocaleDateString(
														undefined,
														{
															month: 'short',
															day: 'numeric',
															weekday: 'short',
														},
													)}
												</span>
												<span className="flex items-center gap-1">
													<Clock className="h-3 w-3" />
													{new Date(signup.shift.startTime).toLocaleTimeString(
														undefined,
														{ hour: 'numeric', minute: '2-digit' },
													)}
												</span>
												{signup.shift.location && (
													<span className="flex items-center gap-1 truncate">
														<MapPin className="h-3 w-3 shrink-0" />
														{signup.shift.location}
													</span>
												)}
											</div>
										</div>
									</div>
								))}
								<Button
									asChild
									variant="ghost"
									size="sm"
									className="w-full text-xs"
								>
									<Link href="/app/my-shifts">View all shifts</Link>
								</Button>
							</div>
						)}
					</CardContent>
				</Card>

				{/* ── Pending applications ── */}
				<Card className="border-border/70">
					<CardHeader className="pb-3">
						<CardTitle className="flex items-center gap-2 text-base font-semibold">
							<FileText className="h-4 w-4 text-warning" />
							Pending applications
						</CardTitle>
					</CardHeader>
					<CardContent>
						{isLoading ? (
							<div className="space-y-3">
								{Array.from({ length: 3 }).map((_, i) => (
									<Skeleton key={i} className="h-14 rounded-lg" />
								))}
							</div>
						) : !data?.pendingApplications.length ? (
							<div className="py-6 text-center">
								<p className="text-sm text-muted-foreground">
									No pending applications.
								</p>
								<Button asChild variant="outline" size="sm" className="mt-3">
									<Link href="/app/my-applications">View applications</Link>
								</Button>
							</div>
						) : (
							<div className="space-y-3">
								{data.pendingApplications.map((app) => (
									<Link
										key={app.id}
										href={`/app/my-applications/${app.id}`}
										className="flex items-center justify-between rounded-lg border border-border/50 p-3 transition-colors hover:bg-muted/50"
									>
										<div className="min-w-0 flex-1">
											<p className="font-medium text-sm truncate">
												{app.opportunity?.title ?? app.organization.name}
											</p>
											<p className="text-xs text-muted-foreground mt-0.5">
												{app.organization.name}
											</p>
										</div>
										<Badge
											variant={
												app.status === 'REVIEW' ? 'default' : 'secondary'
											}
											className="ml-2 shrink-0 text-xs"
										>
											{app.status === 'REVIEW' ? 'In review' : 'Submitted'}
										</Badge>
									</Link>
								))}
								<Button
									asChild
									variant="ghost"
									size="sm"
									className="w-full text-xs"
								>
									<Link href="/app/my-applications">View all applications</Link>
								</Button>
							</div>
						)}
					</CardContent>
				</Card>
			</div>

			<div className="grid gap-6 lg:grid-cols-2">
				{/* ── Expiring credentials ── */}
				<Card className="border-border/70">
					<CardHeader className="pb-3">
						<CardTitle className="flex items-center gap-2 text-base font-semibold">
							<Shield className="h-4 w-4 text-error" />
							Credentials expiring soon
						</CardTitle>
					</CardHeader>
					<CardContent>
						{isLoading ? (
							<Skeleton className="h-16 rounded-lg" />
						) : !data?.expiringCredentials.length ? (
							<p className="py-4 text-center text-sm text-muted-foreground">
								No credentials expiring in the next 30 days.
							</p>
						) : (
							<div className="space-y-3">
								{data.expiringCredentials.map((cred) => {
									const daysLeft = cred.expiresAt
										? Math.ceil(
												(new Date(cred.expiresAt).getTime() - Date.now()) /
													(1000 * 60 * 60 * 24),
											)
										: 0;
									return (
										<div
											key={cred.id}
											className="flex items-center justify-between rounded-lg border border-border/50 p-3"
										>
											<div>
												<p className="font-medium text-sm">
													{cred.type.replace(/_/g, ' ')}
												</p>
												<p className="text-xs text-muted-foreground">
													{cred.organization.name}
												</p>
											</div>
											<Badge variant="destructive" className="text-xs">
												{daysLeft}d left
											</Badge>
										</div>
									);
								})}
							</div>
						)}
					</CardContent>
				</Card>

				{/* ── Recommended opportunities ── */}
				<Card className="border-border/70">
					<CardHeader className="pb-3">
						<CardTitle className="flex items-center gap-2 text-base font-semibold">
							<MapPin className="h-4 w-4 text-info" />
							Opportunities for you
						</CardTitle>
					</CardHeader>
					<CardContent>
						{isLoading ? (
							<Skeleton className="h-16 rounded-lg" />
						) : !data?.recommendedOpportunities.length ? (
							<div className="py-4 text-center">
								<p className="text-sm text-muted-foreground">
									Apply to organizations to see personalized recommendations.
								</p>
							</div>
						) : (
							<div className="space-y-3">
								{data.recommendedOpportunities.map((opp) => (
									<Link
										key={opp.id}
										href={`/opportunities/${opp.organization.slug}`}
										className="flex items-center justify-between rounded-lg border border-border/50 p-3 transition-colors hover:bg-muted/50"
									>
										<div className="min-w-0 flex-1">
											<p className="font-medium text-sm truncate">
												{opp.title}
											</p>
											<p className="text-xs text-muted-foreground mt-0.5">
												{opp.organization.name}
											</p>
										</div>
										<Badge variant="outline" className="ml-2 shrink-0 text-xs">
											{opp.isRemote ? 'Remote' : (opp.location ?? 'In-person')}
										</Badge>
									</Link>
								))}
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
