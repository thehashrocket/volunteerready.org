'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Briefcase, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { CardList } from '@/components/app/card-list';
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
import { usePendingIds } from '@/lib/hooks/use-pending-ids';
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

	const pending = usePendingIds();
	const updateStatus = trpc.opportunities.updateStatus.useMutation({
		onMutate: (vars) => pending.start(vars.id),
		onSettled: (_data, _err, vars) => pending.finish(vars.id),
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
					// A fragment, not a wrapper `div`: `PageHeader` already lays its
					// actions out as a `flex min-w-0 flex-wrap items-center gap-2` row,
					// and a second identical row nested inside it re-introduced the
					// `min-width: auto` overhang that one was given `min-w-0` to fix —
					// at 375px this Select plus the button is 343px of content in a
					// 311px column, and the inner row ran past the page padding to sit
					// flush against the viewport edge.
					actions={
						<>
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
						</>
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
					<>
						{/* Both trees render from the same array and are switched by CSS,
						    never by `useMediaQuery`: that hook initialises to `false` and
						    only resolves in an effect, so gating the LIST on it paints the
						    card shape to every desktop user and swaps it after hydration.
						    `display: none` also removes the hidden tree from the
						    accessibility tree, so exactly one Publish/Close/Edit per
						    opportunity is ever reachable. Visibility goes on a wrapper,
						    never on `Card`/`CardList` — `hidden` and Card's own `flex` are
						    both display utilities and tailwind-merge drops one of them. */}
						<div className="hidden lg:block" data-testid="opportunities-table">
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
													<TableCell className="font-medium">
														{opp.title}
													</TableCell>
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
														{/* The visible labels stay one word, per the table's
												    density; only the accessible names name the target,
												    so a rotor does not read N identical "Publish"
												    buttons. Same treatment as ShiftsClient's icon
												    buttons and the roster's Remove. */}
														<div className="flex items-center justify-end gap-2">
															{opp.status === 'DRAFT' && (
																<Button
																	size="sm"
																	variant="outline"
																	aria-label={`Publish "${opp.title}"`}
																	disabled={pending.has(opp.id)}
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
																	aria-label={`Close "${opp.title}"`}
																	disabled={pending.has(opp.id)}
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
																aria-label={`Edit "${opp.title}"`}
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
						</div>

						{/* `Tags` drops out below `lg` and location/dates/capacity fold
						    into one muted line. The ACTIONS stay, which is the one place
						    this deliberately departs from the roster's shape: there the
						    row became the whole tap target and `Remove` moved into the
						    detail dialog, but `Publish`/`Close` exist on this list and
						    NOWHERE else — the opportunity detail page has only `Edit`. So
						    a whole-row card here would not be a narrower surface, it would
						    be a phone that cannot publish an opportunity at all.

						    Because the card holds its own buttons it is a `<div>`, not a
						    `<button>`: the title carries the navigation, and a nested
						    interactive element inside a tappable row is both a mis-tap
						    generator and invalid markup. */}
						<div className="lg:hidden" data-testid="opportunities-card-list">
							<CardList>
								{opportunities.map((opp) => {
									const dates = formatDateRange(opp.startDate, opp.endDate);
									return (
										<div key={opp.id} className="flex flex-col gap-3 px-4 py-3">
											<div className="flex items-start justify-between gap-2">
												{/* min-w-0 so truncate engages inside the flex row: a
												    long title otherwise widens the card past the
												    viewport, which is the sideways scroll this layout
												    exists to remove. */}
												<Link
													href={`/app/opportunities/${opp.id}`}
													className="min-w-0 truncate font-medium hover:underline"
												>
													{opp.title}
												</Link>
												<OpportunityStatusBadge
													status={opp.status}
													className="shrink-0"
												/>
											</div>

											<div className="truncate text-xs text-muted-foreground">
												{[
													locationLabel(opp),
													dates,
													opp.capacity == null
														? null
														: `${opp.capacity} places`,
												]
													.filter(Boolean)
													.join(' · ')}
											</div>

											<div className="flex gap-2">
												{opp.status === 'DRAFT' && (
													<Button
														className="h-11 flex-1"
														variant="outline"
														aria-label={`Publish "${opp.title}"`}
														disabled={pending.has(opp.id)}
														onClick={() =>
															updateStatus.mutate({
																id: opp.id,
																status: 'PUBLISHED',
															})
														}
													>
														Publish
													</Button>
												)}
												{opp.status === 'PUBLISHED' && (
													<Button
														className="h-11 flex-1"
														variant="outline"
														aria-label={`Close "${opp.title}"`}
														disabled={pending.has(opp.id)}
														onClick={() =>
															updateStatus.mutate({
																id: opp.id,
																status: 'CLOSED',
															})
														}
													>
														Close
													</Button>
												)}
												<Button
													className="h-11 flex-1"
													variant="outline"
													aria-label={`Edit "${opp.title}"`}
													onClick={() => openEdit(opp)}
												>
													Edit
												</Button>
											</div>
										</div>
									);
								})}
							</CardList>
						</div>
					</>
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
