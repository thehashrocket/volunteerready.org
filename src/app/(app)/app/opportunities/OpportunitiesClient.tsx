'use client';

import { useState } from 'react';
import { Briefcase, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc/client';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: Opportunity['status'] }) {
	if (status === 'PUBLISHED') {
		return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Published</Badge>;
	}
	if (status === 'CLOSED') {
		return <Badge variant="secondary">Closed</Badge>;
	}
	return <Badge variant="outline">Draft</Badge>;
}

function formatDateRange(start: Date | null, end: Date | null): string {
	const fmt = (d: Date) =>
		new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(
			d instanceof Date ? d : new Date(d),
		);
	if (start && end) return `${fmt(start)} – ${fmt(end)}`;
	if (start) return `From ${fmt(start)}`;
	if (end) return `Until ${fmt(end)}`;
	return '—';
}

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
	const [statusFilter, setStatusFilter] = useState<string>('ALL');
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingOpp, setEditingOpp] = useState<Opportunity | null>(null);

	const query = trpc.opportunities.list.useQuery();

	const updateStatus = trpc.opportunities.updateStatus.useMutation({
		onSuccess: async () => {
			await qc.invalidateQueries();
			toast.success('Status updated.');
		},
		onError: (err) => toast.error(err.message ?? 'Failed to update status.'),
	});

	const opportunities = (query.data ?? []).filter(
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
					<CardHeader>
						<CardTitle>Loading opportunities…</CardTitle>
					</CardHeader>
					<CardContent className="text-sm text-muted-foreground">
						Fetching your opportunities.
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
				<Card>
					<CardHeader>
						<CardTitle>Could not load opportunities</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4 text-sm text-muted-foreground">
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

	const total = query.data?.length ?? 0;

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
							<Button onClick={openCreate}>New opportunity</Button>
						</div>
					}
				/>

				{opportunities.length === 0 ? (
					<EmptyState
						title="No opportunities yet"
						description="Create your first volunteer opportunity to get started."
						icon={Briefcase}
						action={<Button onClick={openCreate}>New opportunity</Button>}
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
										<TableRow key={opp.id}>
											<TableCell className="font-medium">{opp.title}</TableCell>
											<TableCell>
												<StatusBadge status={opp.status} />
											</TableCell>
											<TableCell className="text-sm text-muted-foreground">
												{locationLabel(opp)}
											</TableCell>
											<TableCell className="text-sm text-muted-foreground">
												{formatDateRange(opp.startDate, opp.endDate)}
											</TableCell>
											<TableCell className="text-sm text-muted-foreground">
												{opp.capacity ?? '—'}
											</TableCell>
											<TableCell>
												<div className="flex flex-wrap gap-1">
													{opp.tags.length > 0
														? opp.tags.map((t) => (
																<Badge key={t.id} variant="outline" className="text-xs">
																	{t.name}
																</Badge>
															))
														: <span className="text-sm text-muted-foreground">—</span>}
												</div>
											</TableCell>
											<TableCell className="text-right">
												<div className="flex items-center justify-end gap-2">
													{opp.status === 'DRAFT' && (
														<Button
															size="sm"
															variant="outline"
															disabled={updateStatus.isPending}
															onClick={() =>
																updateStatus.mutate({ id: opp.id, status: 'PUBLISHED' })
															}
														>
															Publish
														</Button>
													)}
													{opp.status === 'PUBLISHED' && (
														<Button
															size="sm"
															variant="outline"
															disabled={updateStatus.isPending}
															onClick={() =>
																updateStatus.mutate({ id: opp.id, status: 'CLOSED' })
															}
														>
															Close
														</Button>
													)}
													<Button
														size="sm"
														variant="ghost"
														onClick={() => openEdit(opp)}
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
