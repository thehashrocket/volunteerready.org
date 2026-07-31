'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Briefcase, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import {
	QueryErrorCard,
	safeErrorMessage,
} from '@/components/app/query-error-card';
import { EmptyState } from '@/components/empty-state';
import { OpportunityStatusBadge } from '@/components/opportunities/OpportunityStatusBadge';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import { formatDateRange } from '@/lib/format-date';
import { trpc } from '@/lib/trpc/client';
import { OpportunityDialog } from './OpportunityDialog';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Opportunity = {
	id: string;
	title: string;
	description: string;
	status: 'DRAFT' | 'PUBLISHED' | 'CLOSED';
	location: string | null;
	isRemote: boolean;
	startDate: Date | null;
	endDate: Date | null;
	commitmentHours: number | null;
	capacity: number | null;
	createdAt: Date;
	updatedAt: Date;
	tags: { id: string; name: string }[];
	requirements: {
		id: string;
		skillId: string | null;
		familyId: string | null;
		skill: { id: string; name: string } | null;
		family: { id: string; name: string; skills: { id: string }[] } | null;
		level: 'REQUIRED' | 'PREFERRED';
	}[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function locationLabel(opp: Opportunity): string {
	if (opp.isRemote && opp.location) return `${opp.location} · Remote`;
	if (opp.isRemote) return 'Remote';
	return opp.location ?? '—';
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function OpportunitiesClient() {
	const qc = useQueryClient();
	const router = useRouter();
	const [statusFilter, setStatusFilter] = useState<string>('ALL');
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingOpp, setEditingOpp] = useState<Opportunity | null>(null);

	const query = trpc.opportunities.list.useQuery();

	const updateStatus = trpc.opportunities.updateStatus.useMutation({
		onSuccess: async () => {
			await qc.invalidateQueries();
			toast.success('Status updated.');
		},
		onError: (err) =>
			toast.error(safeErrorMessage(err) ?? 'Failed to update status.'),
	});

	const opportunities = (query.data?.items ?? []).filter(
		(o) => statusFilter === 'ALL' || o.status === statusFilter,
	);

	function openCreate() {
		setEditingOpp(null);
		setDialogOpen(true);
	}

	function openEdit(opp: Opportunity) {
		setEditingOpp(opp);
		setDialogOpen(true);
	}

	if (query.isLoading) {
		return (
			<div className="space-y-6">
				<PageHeader
					title="Volunteer Opportunities"
					description="Manage your organization's volunteer roles."
				/>
				<Card>
					<CardContent className="pt-6">
						<div className="space-y-2">
							{Array.from({ length: 5 }).map((_, i) => (
								<Skeleton key={i} className="h-12 w-full" />
							))}
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	if (query.isError) {
		return (
			<div className="space-y-6">
				<PageHeader
					title="Volunteer Opportunities"
					description="Manage your organization's volunteer roles."
				/>
				<QueryErrorCard
					title="Could not load opportunities"
					message={safeErrorMessage(query.error)}
					onRetry={() => query.refetch()}
					isRetrying={query.isFetching}
				/>
			</div>
		);
	}

	const total = query.data?.items?.length ?? 0;

	return (
		<>
			<div className="space-y-6">
				<PageHeader
					title="Volunteer Opportunities"
					description={`${total} opportunit${total === 1 ? 'y' : 'ies'}`}
					actions={
						<div className="flex items-center gap-2">
							<Select value={statusFilter} onValueChange={setStatusFilter}>
								<SelectTrigger className="w-44">
									<SelectValue placeholder="All statuses" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="ALL">All statuses</SelectItem>
									<SelectItem value="DRAFT">Draft</SelectItem>
									<SelectItem value="PUBLISHED">Published</SelectItem>
									<SelectItem value="CLOSED">Closed</SelectItem>
								</SelectContent>
							</Select>
							<Button size="sm" onClick={openCreate}>
								<Plus className="mr-2 h-4 w-4" />
								New opportunity
							</Button>
						</div>
					}
				/>

				{opportunities.length === 0 ? (
					<EmptyState
						title="No opportunities yet"
						description="Create your first volunteer opportunity to get started."
						icon={Briefcase}
						action={
							<Button size="sm" onClick={openCreate}>
								<Plus className="mr-2 h-4 w-4" />
								New opportunity
							</Button>
						}
					/>
				) : (
					<Card>
						<CardContent className="pt-6">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Title</TableHead>
										<TableHead>Status</TableHead>
										<TableHead>Location</TableHead>
										<TableHead>Dates</TableHead>
										<TableHead>Capacity</TableHead>
										<TableHead>Tags</TableHead>
										<TableHead className="text-right">Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{opportunities.map((opp) => (
										<TableRow
											key={opp.id}
											className="cursor-pointer"
											onClick={() =>
												router.push(`/app/opportunities/${opp.id}`)
											}
										>
											<TableCell className="font-medium">{opp.title}</TableCell>
											<TableCell>
												<OpportunityStatusBadge status={opp.status} />
											</TableCell>
											<TableCell className="text-sm text-muted-foreground">
												{locationLabel(opp)}
											</TableCell>
											<TableCell className="text-sm text-muted-foreground">
												{formatDateRange(opp.startDate, opp.endDate) ?? '—'}
											</TableCell>
											<TableCell className="text-sm text-muted-foreground">
												{opp.capacity ?? '—'}
											</TableCell>
											<TableCell>
												<div className="flex flex-wrap gap-1">
													{opp.tags.length > 0 ? (
														opp.tags.map((t) => (
															<Badge
																key={t.id}
																variant="outline"
																className="text-xs"
															>
																{t.name}
															</Badge>
														))
													) : (
														<span className="text-sm text-muted-foreground">
															—
														</span>
													)}
												</div>
											</TableCell>
											<TableCell className="text-right">
												<div className="flex items-center justify-end gap-2">
													{opp.status === 'DRAFT' && (
														<Button
															size="sm"
															variant="outline"
															disabled={updateStatus.isPending}
															onClick={(e) => {
																e.stopPropagation();
																updateStatus.mutate({
																	id: opp.id,
																	status: 'PUBLISHED',
																});
															}}
														>
															Publish
														</Button>
													)}
													{opp.status === 'PUBLISHED' && (
														<Button
															size="sm"
															variant="outline"
															disabled={updateStatus.isPending}
															onClick={(e) => {
																e.stopPropagation();
																updateStatus.mutate({
																	id: opp.id,
																	status: 'CLOSED',
																});
															}}
														>
															Close
														</Button>
													)}
													<Button
														size="sm"
														variant="ghost"
														onClick={(e) => {
															e.stopPropagation();
															openEdit(opp);
														}}
													>
														Edit
													</Button>
												</div>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</CardContent>
					</Card>
				)}
			</div>

			<OpportunityDialog
				open={dialogOpen}
				onOpenChange={setDialogOpen}
				opportunity={editingOpp}
			/>
		</>
	);
}
