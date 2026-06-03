'use client';

import { keepPreviousData } from '@tanstack/react-query';
import { Calendar, Clock, Heart, MapPin, Search, Wifi, X } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { trackEvent } from '@/lib/analytics';
import { formatDateRange } from '@/lib/format-date';
import { trpc } from '@/lib/trpc/client';
import type {
	getThisWeekendOpportunities,
	searchMarketplaceOpportunities,
} from '@/server/repositories/publicOpportunityRepo';

type InitialItem = Awaited<
	ReturnType<typeof searchMarketplaceOpportunities>
>['items'][number];
type WeekendItem = Awaited<
	ReturnType<typeof getThisWeekendOpportunities>
>[number];

interface Props {
	initialItems: InitialItem[];
	initialNextCursor: string | null;
	thisWeekend: WeekendItem[];
}

export function MarketplaceListing({
	initialItems,
	initialNextCursor,
	thisWeekend,
}: Props) {
	const [query, setQuery] = useState('');
	const [debouncedQuery, setDebouncedQuery] = useState('');
	const [isRemote, setIsRemote] = useState<boolean | undefined>(undefined);
	const [cursor, setCursor] = useState<string | null>(initialNextCursor);
	const [items, setItems] = useState<InitialItem[]>(initialItems);
	const [isSearchMode, setIsSearchMode] = useState(false);
	const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Interest toggle (requires auth; silently absent for unauthenticated users)
	const [pendingInterests, setPendingInterests] = useState<Set<string>>(
		new Set(),
	);
	const interestsQuery = trpc.marketplace.getMyInterests.useQuery(undefined, {
		retry: false,
	});
	const toggleInterest = trpc.marketplace.toggleInterest.useMutation({
		onMutate: ({ opportunityId }) => {
			setPendingInterests((prev) => new Set([...prev, opportunityId]));
		},
		onSettled: (_data, _err, { opportunityId }) => {
			setPendingInterests((prev) => {
				const next = new Set(prev);
				next.delete(opportunityId);
				return next;
			});
		},
		onSuccess: () => {
			void interestsQuery.refetch();
		},
	});
	const interestSet = new Set(interestsQuery.data ?? []);

	// Track page view
	useEffect(() => {
		trackEvent('marketplace_opportunities_view');
	}, []);

	// Debounce search query
	useEffect(() => {
		if (debounceTimer.current) clearTimeout(debounceTimer.current);
		debounceTimer.current = setTimeout(() => {
			const trimmed = query.trim();
			if (trimmed.length > 0) {
				trackEvent('marketplace_search', { query_length: trimmed.length });
			}
			setDebouncedQuery(query);
			setIsSearchMode(trimmed.length > 0 || isRemote !== undefined);
		}, 300);
		return () => {
			if (debounceTimer.current) clearTimeout(debounceTimer.current);
		};
	}, [query, isRemote]);

	// tRPC search query (fires when in search mode)
	const searchQuery = trpc.marketplace.searchOpportunities.useQuery(
		{ query: debouncedQuery || undefined, isRemote, limit: 20 },
		{
			enabled: isSearchMode,
			placeholderData: keepPreviousData,
		},
	);

	// Load more (cursor pagination, only in browse mode)
	const loadMoreQuery = trpc.marketplace.searchOpportunities.useQuery(
		{ cursor: cursor ?? undefined, isRemote, limit: 20 },
		{ enabled: false },
	);

	const handleLoadMore = useCallback(async () => {
		if (!cursor) return;
		const result = await loadMoreQuery.refetch();
		if (result.data) {
			setItems((prev) => [...prev, ...result.data.items]);
			setCursor(result.data.nextCursor);
		}
	}, [cursor, loadMoreQuery]);

	const handleClearSearch = () => {
		setQuery('');
		setDebouncedQuery('');
		setIsRemote(undefined);
		setIsSearchMode(false);
		setItems(initialItems);
		setCursor(initialNextCursor);
	};

	const displayItems = isSearchMode ? (searchQuery.data?.items ?? []) : items;

	const displayNextCursor = isSearchMode
		? (searchQuery.data?.nextCursor ?? null)
		: cursor;

	const isLoading = isSearchMode && searchQuery.isFetching;

	return (
		<main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
			{/* Header */}
			<div className="mb-8 space-y-2">
				<h1 className="font-display text-4xl font-bold tracking-tight text-foreground">
					Volunteer Opportunities
				</h1>
				<p className="text-lg text-muted-foreground">
					Find meaningful work with nonprofits in your community.
				</p>
			</div>

			{/* Search bar */}
			<div className="mb-4 flex gap-2">
				<div className="relative flex-1">
					<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Search volunteer opportunities..."
						className="pl-9"
						aria-label="Search opportunities"
					/>
					{query && (
						<button
							type="button"
							onClick={handleClearSearch}
							className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
							aria-label="Clear search"
						>
							<X className="h-4 w-4" />
						</button>
					)}
				</div>
			</div>

			{/* Filter row */}
			<div className="mb-6 flex flex-wrap items-center gap-2">
				<Button
					size="sm"
					variant={isRemote === undefined ? 'default' : 'outline'}
					onClick={() => {
						setIsRemote(undefined);
						setCursor(initialNextCursor);
					}}
					className="h-8 text-xs"
				>
					All
				</Button>
				<Button
					size="sm"
					variant={isRemote === false ? 'default' : 'outline'}
					onClick={() => {
						setIsRemote(false);
						setCursor(null);
					}}
					className="h-8 text-xs"
				>
					<MapPin className="mr-1 h-3 w-3" />
					In-person
				</Button>
				<Button
					size="sm"
					variant={isRemote === true ? 'default' : 'outline'}
					onClick={() => {
						setIsRemote(true);
						setCursor(null);
					}}
					className="h-8 text-xs"
				>
					<Wifi className="mr-1 h-3 w-3" />
					Remote
				</Button>
			</div>

			{/* This Weekend section */}
			{!isSearchMode && thisWeekend.length > 0 && (
				<section
					className="mb-8 rounded-xl px-5 py-4"
					style={{ backgroundColor: 'rgb(196 168 130 / 0.10)' }}
				>
					<h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
						This Weekend
					</h2>
					<div className="flex gap-3 overflow-x-auto pb-1">
						{thisWeekend.map((opp) => (
							<Link
								key={opp.id}
								href={`/apply/${opp.organization.slug}?opportunityId=${opp.id}&source=MARKETPLACE`}
								className="min-w-[220px] flex-shrink-0 rounded-lg border bg-background p-3 text-sm hover:shadow-sm transition-shadow"
							>
								<p className="font-semibold line-clamp-1 text-foreground">
									{opp.title}
								</p>
								<p className="mt-0.5 text-xs text-muted-foreground">
									{opp.organization.name}
								</p>
								{opp.startDate && (
									<p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
										<Calendar className="h-3 w-3" />
										{new Intl.DateTimeFormat('en-US', {
											weekday: 'short',
											month: 'short',
											day: 'numeric',
										}).format(new Date(opp.startDate))}
									</p>
								)}
								{!opp.startDate && opp.isRemote && (
									<p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
										<Wifi className="h-3 w-3" />
										Remote
									</p>
								)}
							</Link>
						))}
					</div>
				</section>
			)}

			{/* Results count */}
			{isSearchMode && !isLoading && (
				<p className="mb-4 text-sm text-muted-foreground">
					{displayItems.length === 0
						? 'No opportunities match your search.'
						: `Showing ${displayItems.length} result${displayItems.length !== 1 ? 's' : ''}`}
				</p>
			)}

			{/* Opportunity list */}
			{isLoading ? (
				<ul className="space-y-4" aria-label="Loading opportunities">
					{[...Array(3)].map((_, i) => (
						<li
							key={i}
							className="h-24 animate-pulse rounded-lg border bg-muted/40"
						/>
					))}
				</ul>
			) : displayItems.length === 0 && isSearchMode ? (
				<div className="rounded-xl border border-dashed py-16 text-center text-muted-foreground">
					<Search className="mx-auto mb-3 h-8 w-8 opacity-40" />
					<p className="font-medium">No opportunities match your search.</p>
					<p className="mt-1 text-sm">
						Try broader terms or clear your filters.
					</p>
					<Button
						variant="outline"
						size="sm"
						className="mt-4"
						onClick={handleClearSearch}
					>
						Clear filters
					</Button>
				</div>
			) : (
				<ul className="divide-y" aria-label="Volunteer opportunities">
					{displayItems.map((opp) => {
						const isInterested = interestSet.has(opp.id);
						return (
							<li
								key={opp.id}
								className="group py-5 transition-colors hover:bg-warm-50/40 -mx-2 px-2 rounded"
							>
								<div className="flex items-start gap-4">
									<Link
										href={`/apply/${opp.organization.slug}?opportunityId=${opp.id}&source=MARKETPLACE`}
										className="block min-w-0 flex-1"
										onClick={() =>
											trackEvent('marketplace_opportunity_click', {
												opportunity_id: opp.id,
											})
										}
									>
										<div className="min-w-0 flex-1 space-y-1.5">
											<h3 className="font-display text-lg font-semibold text-primary group-hover:underline line-clamp-1">
												{opp.title}
											</h3>
											<p className="text-sm text-muted-foreground">
												<span className="font-medium text-foreground">
													{opp.organization.name}
												</span>
												{opp.location && (
													<>
														{' '}
														·{' '}
														<span className="inline-flex items-center gap-0.5">
															<MapPin className="h-3 w-3" />
															{opp.location}
														</span>
													</>
												)}
												{opp.isRemote && !opp.location && (
													<>
														{' '}
														·{' '}
														<span className="inline-flex items-center gap-0.5">
															<Wifi className="h-3 w-3" />
															Remote
														</span>
													</>
												)}
												{(opp.startDate || opp.endDate) && (
													<>
														{' '}
														·{' '}
														<span className="inline-flex items-center gap-0.5">
															<Calendar className="h-3 w-3" />
															{formatDateRange(opp.startDate, opp.endDate)}
														</span>
													</>
												)}
												{opp.commitmentHours && (
													<>
														{' '}
														·{' '}
														<span className="inline-flex items-center gap-0.5">
															<Clock className="h-3 w-3" />
															{opp.commitmentHours}h
														</span>
													</>
												)}
											</p>
											{opp.tags.length > 0 && (
												<div className="flex flex-wrap gap-1.5">
													{opp.tags.slice(0, 5).map((tag) => (
														<Badge
															key={tag.id}
															variant="secondary"
															className="h-5 px-2 text-xs"
														>
															{tag.name}
														</Badge>
													))}
												</div>
											)}
										</div>
									</Link>
									{/* Interest toggle — only shown for authenticated users */}
									{interestsQuery.data !== undefined && (
										<button
											type="button"
											aria-label={
												isInterested ? 'Remove interest' : 'Express interest'
											}
											disabled={pendingInterests.has(opp.id)}
											onClick={() => {
												toggleInterest.mutate({ opportunityId: opp.id });
												trackEvent('marketplace_interest_toggle', {
													opportunity_id: opp.id,
													action: isInterested ? 'remove' : 'add',
												});
											}}
											className="mt-1 flex-shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:text-rose-500 disabled:opacity-50"
										>
											<Heart
												className={`h-5 w-5 transition-colors ${isInterested ? 'fill-rose-500 text-rose-500' : ''}`}
											/>
										</button>
									)}
								</div>
							</li>
						);
					})}
				</ul>
			)}

			{/* Empty state (browse mode, no results at all) */}
			{!isLoading && !isSearchMode && displayItems.length === 0 && (
				<div className="rounded-xl border border-dashed py-20 text-center text-muted-foreground">
					<p className="font-medium">
						No opportunities on the marketplace yet.
					</p>
					<p className="mt-1 text-sm">
						Check back soon — organizations are joining every week.
					</p>
				</div>
			)}

			{/* Load more */}
			{!isSearchMode && displayNextCursor && (
				<div className="mt-8 flex justify-center">
					<Button
						variant="outline"
						onClick={handleLoadMore}
						disabled={loadMoreQuery.isFetching}
					>
						{loadMoreQuery.isFetching ? 'Loading…' : 'Load more'}
					</Button>
				</div>
			)}
		</main>
	);
}
