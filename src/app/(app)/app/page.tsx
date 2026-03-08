'use client';

import {
	Briefcase,
	ChevronRight,
	ClipboardList,
	FileText,
	Plus,
	Users,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { EmptyState } from '@/components/empty-state';
import { ApplicationStatusBadge } from '@/components/my-applications/ApplicationStatusBadge';
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
		<Card className="overflow-hidden">
			<div className={`h-1 ${accent}`} />
			<CardContent className="pb-5 pt-4">
				<div className="text-3xl font-bold tabular-nums">{value}</div>
				<div className="mt-1 text-sm text-muted-foreground">{label}</div>
			</CardContent>
		</Card>
	);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
	const router = useRouter();
	const { data, isLoading } = trpc.screener.getDashboardStats.useQuery();

	return (
		<div className="space-y-8">
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
				<Card>
					<CardContent className="flex items-start gap-4 pt-6">
						<ClipboardList className="mt-1 h-5 w-5 text-muted-foreground" />
						<div className="flex-1 space-y-1">
							<p className="font-medium">Screener questions</p>
							<p className="text-sm text-muted-foreground">
								Configure the questions shown on your volunteer application
								form.
							</p>
						</div>
						<Button asChild variant="outline" size="sm">
							<Link href="/app/screener">Manage</Link>
						</Button>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="flex items-start gap-4 pt-6">
						<FileText className="mt-1 h-5 w-5 text-muted-foreground" />
						<div className="flex-1 space-y-1">
							<p className="font-medium">Volunteer applications</p>
							<p className="text-sm text-muted-foreground">
								Review and act on incoming volunteer applications.
							</p>
						</div>
						<Button asChild variant="outline" size="sm">
							<Link href="/app/applications">Review</Link>
						</Button>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="flex items-start gap-4 pt-6">
						<Users className="mt-1 h-5 w-5 text-muted-foreground" />
						<div className="flex-1 space-y-1">
							<p className="font-medium">Team members</p>
							<p className="text-sm text-muted-foreground">
								Manage your organization's members and invite new ones.
							</p>
						</div>
						<Button asChild variant="outline" size="sm">
							<Link href="/app/settings/team">Manage</Link>
						</Button>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="flex items-start gap-4 pt-6">
						<Briefcase className="mt-1 h-5 w-5 text-muted-foreground" />
						<div className="flex-1 space-y-1">
							<p className="font-medium">Opportunities</p>
							<p className="text-sm text-muted-foreground">
								Create and publish volunteer opportunities for your
								organization.
							</p>
						</div>
						<Button asChild variant="outline" size="sm">
							<Link href="/app/opportunities">Manage</Link>
						</Button>
					</CardContent>
				</Card>
			</div>

			{/* ── Recent applications ── */}
			<Card>
				<CardHeader className="pb-4">
					<CardTitle>Recent applications</CardTitle>
				</CardHeader>
				<CardContent>
					{isLoading ? (
						<div className="space-y-2">
							{Array.from({ length: 4 }).map((_, i) => (
								<Skeleton key={i} className="h-12 w-full" />
							))}
						</div>
					) : !data || data.recentApplications.length === 0 ? (
						<EmptyState
							icon={FileText}
							title="No applications yet"
							description="Once volunteers start applying, you'll see them here."
						/>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Date</TableHead>
									<TableHead>Email</TableHead>
									<TableHead>Opportunity</TableHead>
									<TableHead>Status</TableHead>
									<TableHead />
								</TableRow>
							</TableHeader>
							<TableBody>
								{data.recentApplications.map((app) => (
									<TableRow
										key={app.id}
										className="cursor-pointer"
										onClick={() => router.push(`/app/applications/${app.id}`)}
									>
										<TableCell className="text-sm text-muted-foreground">
											{formatDate(app.submittedAt)}
										</TableCell>
										<TableCell className="font-medium">
											{app.submittedByEmail}
										</TableCell>
										<TableCell className="text-muted-foreground">
											{app.opportunity?.title ?? (
												<span className="italic">No opportunity</span>
											)}
										</TableCell>
										<TableCell>
											<ApplicationStatusBadge status={app.status} />
										</TableCell>
										<TableCell>
											<ChevronRight className="h-4 w-4 text-muted-foreground" />
										</TableCell>
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
