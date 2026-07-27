'use client';

import { BookUser, Search } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
	QueryErrorCard,
	safeErrorMessage,
} from '@/components/app/query-error-card';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import { VolunteerStatusBadge } from '@/components/volunteers/volunteer-status-badge';
import { FOUNDER_BOOKING_URL } from '@/lib/constants';
import { trpc } from '@/lib/trpc/client';
import { ROSTER_POPULATED_THRESHOLD } from '@/server/domain/org-volunteer';
import { AddVolunteerDialog } from './AddVolunteerDialog';

const COLUMNS = ['Volunteer', 'Added', 'Shifts', 'Status', ''] as const;

/**
 * Table-shaped skeleton with the REAL column headers and width-matched cells,
 * so nothing reflows when data lands. The alternative idiom in this repo —
 * five grey bars — visibly jumps on a list you are about to scan.
 * Shape copied from applications/page.tsx:40-75.
 */
function TableSkeleton() {
	return (
		<Card>
			<CardContent className="pt-6">
				<Table>
					<TableHeader>
						<TableRow>
							{COLUMNS.map((h) => (
								<TableHead key={h}>{h}</TableHead>
							))}
						</TableRow>
					</TableHeader>
					<TableBody>
						{Array.from({ length: 5 }).map((_, i) => (
							<TableRow key={i}>
								{[180, 96, 40, 110, 72].map((w, j) => (
									<TableCell key={j}>
										<Skeleton className="h-4" style={{ width: w }} />
									</TableCell>
								))}
							</TableRow>
						))}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}

/**
 * The concierge offer. Shown while the roster is below the "populated"
 * threshold and hidden after.
 *
 * The threshold is deliberately the SAME number as the success metric and the
 * onboarding milestone. An org that types three names, realises it has 57 more
 * and closes the tab is exactly the org that needs this — and if the offer
 * lived only in the empty state, it is exactly the org that would never see it
 * again.
 */
function ConciergeLine() {
	return (
		<p className="text-center text-sm text-muted-foreground">
			Have a spreadsheet?{' '}
			<a
				href={FOUNDER_BOOKING_URL}
				target="_blank"
				rel="noopener noreferrer"
				className="underline underline-offset-4 hover:text-foreground"
			>
				Send it over and we&apos;ll import it for you.
			</a>
		</p>
	);
}

export default function VolunteersPage() {
	const [search, setSearch] = useState('');
	const [cursor, setCursor] = useState<string | null>(null);

	const roster = trpc.volunteers.list.useQuery(
		{ cursor, search: search.trim() || null },
		{
			// Keeps the previous page on screen while the next one loads, so
			// "Load more" never blanks a list mid-scroll.
			placeholderData: (prev) => prev,
		},
	);
	const count = trpc.volunteers.count.useQuery();
	const utils = trpc.useUtils();

	const removeVolunteer = trpc.volunteers.remove.useMutation({
		onSuccess: () => {
			toast.success('Removed from your roster.', {
				description: 'Recorded hours stay in your reports.',
			});
			utils.volunteers.invalidate();
		},
		onError: (error) => {
			toast.error(
				safeErrorMessage(error) ?? 'Could not remove that volunteer.',
			);
		},
	});

	function refresh() {
		setCursor(null);
		utils.volunteers.invalidate();
	}

	const volunteers = roster.data?.volunteers ?? [];
	const total = count.data ?? 0;
	const isSearching = search.trim().length > 0;
	const showConcierge = total < ROSTER_POPULATED_THRESHOLD;

	return (
		<div className="space-y-6">
			<PageHeader
				title="Volunteers"
				description={
					count.data === undefined
						? undefined
						: `${total} ${total === 1 ? 'volunteer' : 'volunteers'}`
				}
				actions={<AddVolunteerDialog onAdded={refresh} />}
			/>

			<div className="flex items-center gap-2">
				<div className="relative max-w-md flex-1">
					{/* An sr-only label, not placeholder-as-label: a placeholder stops
					    being a label the moment the field has content. */}
					<Label htmlFor="volunteer-search" className="sr-only">
						Search volunteers
					</Label>
					<Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
					<Input
						id="volunteer-search"
						placeholder="Search by name or email"
						value={search}
						onChange={(e) => {
							setSearch(e.target.value);
							setCursor(null);
						}}
						className="pl-8"
					/>
				</div>
			</div>

			{roster.isLoading ? (
				<TableSkeleton />
			) : roster.isError ? (
				<QueryErrorCard
					title="Couldn't load your volunteers"
					message={safeErrorMessage(roster.error)}
					onRetry={() => roster.refetch()}
					isRetrying={roster.isFetching}
				/>
			) : volunteers.length === 0 ? (
				// Two distinct empty states. Conflating them makes a working filter
				// look like an empty roster.
				isSearching ? (
					<EmptyState title="No volunteers match that search." icon={Search} />
				) : (
					<EmptyState
						icon={BookUser}
						title="No volunteers yet"
						description="Add the volunteers you already work with. They don't need to sign up first — you can schedule them and track their hours right away."
						action={<AddVolunteerDialog onAdded={refresh} />}
					/>
				)
			) : (
				<Card>
					<CardContent className="pt-6">
						<Table>
							<TableHeader>
								<TableRow>
									{COLUMNS.map((h) => (
										<TableHead key={h}>{h}</TableHead>
									))}
								</TableRow>
							</TableHeader>
							<TableBody>
								{volunteers.map((v) => (
									<TableRow key={v.id}>
										<TableCell>
											{/* Two lines, no avatar — no table in this app has
											    avatars, and adding them here is net-new vocabulary
											    for no informational gain. */}
											<div className="font-medium">{v.displayName}</div>
											<div className="text-xs text-muted-foreground">
												{v.email}
											</div>
										</TableCell>
										<TableCell className="tabular-nums text-sm text-muted-foreground">
											{new Date(v.addedAt).toLocaleDateString()}
										</TableCell>
										<TableCell className="tabular-nums text-sm">
											{v.attendedShifts}
										</TableCell>
										<TableCell>
											<VolunteerStatusBadge state={v.accountState} />
										</TableCell>
										<TableCell className="text-right">
											<Button
												variant="outline"
												size="sm"
												className="h-11"
												disabled={removeVolunteer.isPending}
												onClick={() =>
													removeVolunteer.mutate({ volunteerId: v.id })
												}
											>
												Remove
											</Button>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>

						{roster.data?.nextCursor ? (
							<div className="flex justify-center pt-4">
								<Button
									variant="outline"
									onClick={() => setCursor(roster.data.nextCursor)}
									disabled={roster.isFetching}
								>
									{roster.isFetching ? 'Loading…' : 'Load more'}
								</Button>
							</div>
						) : null}
					</CardContent>
				</Card>
			)}

			{showConcierge && !roster.isLoading && !roster.isError ? (
				<ConciergeLine />
			) : null}
		</div>
	);
}
