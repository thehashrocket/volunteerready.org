'use client';

import { Briefcase, ClipboardList, FileText, Plus, Users } from 'lucide-react';
import Link from 'next/link';
import { ActivityFeed } from '@/components/app/activity-feed';
import { OrgHealthWidget } from '@/components/app/org-health-widget';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/lib/trpc/client';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface StatCardProps {
	label: string;
	value: number;
	accent: string;
}

function StatCard({ label, value, accent }: StatCardProps) {
	return (
		<Card className="overflow-hidden border-border/70">
			<div className={`h-1.5 ${accent}`} />
			<CardContent className="pb-5 pt-4">
				<div className="text-3xl font-bold tabular-nums tracking-tight">
					{value}
				</div>
				<div className="mt-1 text-sm text-muted-foreground">{label}</div>
			</CardContent>
		</Card>
	);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
	const { data, isLoading } = trpc.screener.getDashboardStats.useQuery();

	return (
		<div className="space-y-8">
			{/* ── Greeting banner + Health Score ── */}
			<div className="rounded-xl border border-border/60 bg-[#E8DCC8]/30 px-6 py-5">
				<p className="font-display text-xl font-bold text-foreground">
					Good to see you again.
				</p>
				<p className="mt-1 text-sm text-muted-foreground">
					Here's what's happening across your organization today.
				</p>
				{isLoading ? (
					<div className="mt-4 space-y-2">
						<Skeleton className="h-5 w-20" />
						<Skeleton className="h-2 w-full rounded-full" />
					</div>
				) : data?.health ? (
					<OrgHealthWidget health={data.health} />
				) : null}
			</div>

			<PageHeader
				title="Dashboard"
				description="Track activity across your organization."
				actions={
					<Button size="sm" asChild>
						<Link href="/app/opportunities">
							<Plus className="mr-2 h-4 w-4" />
							New opportunity
						</Link>
					</Button>
				}
			/>

			{/* ── Stat cards ── */}
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{isLoading ? (
					Array.from({ length: 4 }).map((_, i) => (
						<Skeleton key={i} className="h-24 rounded-xl" />
					))
				) : (
					<>
						<StatCard
							label="Published opportunities"
							value={data?.opportunities.published ?? 0}
							accent="bg-success"
						/>
						<StatCard
							label="Total applications"
							value={data?.applications.total ?? 0}
							accent="bg-info"
						/>
						<StatCard
							label="In review"
							value={data?.applications.review ?? 0}
							accent="bg-warning"
						/>
						<StatCard
							label="Approved"
							value={data?.applications.approved ?? 0}
							accent="bg-success/70"
						/>
					</>
				)}
			</div>

			{/* ── Quick links ── */}
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<Card className="border-border/70">
					<CardContent className="flex items-start gap-4 pt-6">
						<ClipboardList className="mt-0.5 h-5 w-5 shrink-0 text-info-foreground" />
						<div className="flex-1 space-y-1">
							<p className="font-medium">Screener questions</p>
							<p className="text-sm text-muted-foreground">
								Configure the questions shown on your volunteer application
								form.
							</p>
						</div>
						<Button asChild variant="outline" size="default">
							<Link href="/app/screener">Manage</Link>
						</Button>
					</CardContent>
				</Card>

				<Card className="border-border/70">
					<CardContent className="flex items-start gap-4 pt-6">
						<FileText className="mt-0.5 h-5 w-5 shrink-0 text-warning-foreground" />
						<div className="flex-1 space-y-1">
							<p className="font-medium">Volunteer applications</p>
							<p className="text-sm text-muted-foreground">
								Review and act on incoming volunteer applications.
							</p>
						</div>
						<Button asChild variant="outline" size="default">
							<Link href="/app/applications">Review</Link>
						</Button>
					</CardContent>
				</Card>

				<Card className="border-border/70">
					<CardContent className="flex items-start gap-4 pt-6">
						<Users className="mt-0.5 h-5 w-5 shrink-0 text-success-foreground" />
						<div className="flex-1 space-y-1">
							<p className="font-medium">Team members</p>
							<p className="text-sm text-muted-foreground">
								Manage your organization's members and invite new ones.
							</p>
						</div>
						<Button asChild variant="outline" size="default">
							<Link href="/app/settings/team">Manage</Link>
						</Button>
					</CardContent>
				</Card>

				<Card className="border-border/70">
					<CardContent className="flex items-start gap-4 pt-6">
						<Briefcase className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
						<div className="flex-1 space-y-1">
							<p className="font-medium">Opportunities</p>
							<p className="text-sm text-muted-foreground">
								Create and publish volunteer opportunities for your
								organization.
							</p>
						</div>
						<Button asChild variant="outline" size="default">
							<Link href="/app/opportunities">Manage</Link>
						</Button>
					</CardContent>
				</Card>
			</div>

			{/* ── Activity feed ── */}
			<ActivityFeed />
		</div>
	);
}
