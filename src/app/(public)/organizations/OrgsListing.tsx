'use client';

import { keepPreviousData } from '@tanstack/react-query';
import { BadgeCheck, Building2, Users } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { trackEvent } from '@/lib/analytics';
import { trpc } from '@/lib/trpc/client';
import type { listMarketplaceOrgs } from '@/server/repositories/publicOpportunityRepo';

type OrgItem = Awaited<ReturnType<typeof listMarketplaceOrgs>>['items'][number];

interface Props {
	initialItems: OrgItem[];
	initialNextCursor: string | null;
}

export function OrgsListing({ initialItems, initialNextCursor }: Props) {
	const [verifiedOnly, setVerifiedOnly] = useState(false);
	const [items, setItems] = useState<OrgItem[]>(initialItems);
	const [cursor, setCursor] = useState<string | null>(initialNextCursor);
	const [isFilterMode, setIsFilterMode] = useState(false);

	const filterQuery = trpc.marketplace.getOrganizations.useQuery(
		{ verified: verifiedOnly ? true : undefined, limit: 20 },
		{ enabled: isFilterMode, placeholderData: keepPreviousData },
	);

	const loadMoreQuery = trpc.marketplace.getOrganizations.useQuery(
		{
			cursor: cursor ?? undefined,
			verified: verifiedOnly ? true : undefined,
			limit: 20,
		},
		{ enabled: false },
	);

	// Track page view
	useEffect(() => {
		trackEvent('marketplace_organizations_view');
	}, []);

	// Sync cursor when filter query loads a new page
	useEffect(() => {
		if (filterQuery.data && isFilterMode) {
			setCursor(filterQuery.data.nextCursor);
		}
	}, [filterQuery.data, isFilterMode]);

	const toggleVerified = () => {
		const next = !verifiedOnly;
		setVerifiedOnly(next);
		setIsFilterMode(true);
		setCursor(null);
		trackEvent('marketplace_org_filter', { verified_only: next ? 1 : 0 });
	};

	const handleLoadMore = useCallback(async () => {
		if (!cursor) return;
		const result = await loadMoreQuery.refetch();
		if (result.data) {
			setItems((prev) => [...prev, ...result.data.items]);
			setCursor(result.data.nextCursor);
		}
	}, [cursor, loadMoreQuery]);

	const displayItems = isFilterMode ? (filterQuery.data?.items ?? []) : items;

	const displayNextCursor = isFilterMode
		? (filterQuery.data?.nextCursor ?? null)
		: cursor;

	const isLoading = isFilterMode && filterQuery.isFetching;

	return (
		<main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
			{/* Header */}
			<div className="mb-8 space-y-2">
				<h1 className="font-display text-4xl font-bold tracking-tight text-foreground">
					Organizations
				</h1>
				<p className="text-lg text-muted-foreground">
					Discover nonprofits looking for dedicated volunteers.
				</p>
			</div>

			{/* Filter row */}
			<div className="mb-6 flex flex-wrap items-center gap-2">
				<Button
					size="sm"
					variant={!verifiedOnly ? 'default' : 'outline'}
					onClick={() => {
						setVerifiedOnly(false);
						setIsFilterMode(false);
						setItems(initialItems);
						setCursor(initialNextCursor);
					}}
					className="h-8 text-xs"
				>
					All
				</Button>
				<Button
					size="sm"
					variant={verifiedOnly ? 'default' : 'outline'}
					onClick={toggleVerified}
					className="h-8 text-xs"
				>
					<BadgeCheck className="mr-1 h-3 w-3" />
					Verified only
				</Button>
			</div>

			{/* Loading skeletons */}
			{isLoading ? (
				<ul className="divide-y" aria-label="Loading organizations">
					{[...Array(3)].map((_, i) => (
						<li
							key={i}
							className="h-20 animate-pulse rounded-lg bg-muted/40 my-2"
						/>
					))}
				</ul>
			) : displayItems.length === 0 ? (
				<div className="rounded-xl border border-dashed py-20 text-center text-muted-foreground">
					<Building2 className="mx-auto mb-3 h-10 w-10 opacity-40" />
					<p className="font-medium">
						No organizations on the marketplace yet.
					</p>
					<p className="mt-1 text-sm">Check back soon!</p>
				</div>
			) : (
				<ul className="divide-y" aria-label="Organizations">
					{displayItems.map((org) => (
						<li
							key={org.id}
							className="group py-5 -mx-2 px-2 rounded transition-colors hover:bg-muted/40"
						>
							<Link
								href={`/apply/${org.slug}`}
								className="block"
								onClick={() =>
									trackEvent('marketplace_org_click', { org_slug: org.slug })
								}
							>
								<div className="flex items-start gap-4">
									{/* Logo */}
									<div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg border bg-muted/30 overflow-hidden">
										{org.logoUrl ? (
											<Image
												src={org.logoUrl}
												alt={`${org.name} logo`}
												width={48}
												height={48}
												className="h-full w-full object-contain"
											/>
										) : (
											<Building2 className="h-5 w-5 text-muted-foreground" />
										)}
									</div>

									<div className="min-w-0 flex-1 space-y-1">
										<div className="flex items-center gap-2">
											<h3 className="font-display text-lg font-semibold text-primary group-hover:underline">
												{org.name}
											</h3>
											{org.verified && (
												<BadgeCheck
													className="h-4 w-4 flex-shrink-0 text-success"
													aria-label="Verified organization"
												/>
											)}
										</div>

										{org.description && (
											<p className="text-sm text-muted-foreground line-clamp-2">
												{org.description}
											</p>
										)}

										<div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
											<span className="flex items-center gap-1">
												<Building2 className="h-3 w-3" />
												{org._count.opportunities}{' '}
												{org._count.opportunities === 1
													? 'opportunity'
													: 'opportunities'}
											</span>
											<span className="flex items-center gap-1">
												<Users className="h-3 w-3" />
												{org._count.members}{' '}
												{org._count.members === 1 ? 'member' : 'members'}
											</span>
											{org.location && <span>{org.location}</span>}
										</div>

										{org.causeAreaTags.length > 0 && (
											<div className="flex flex-wrap gap-1.5 pt-0.5">
												{org.causeAreaTags.slice(0, 5).map((tag) => (
													<Badge
														key={tag}
														variant="secondary"
														className="h-5 px-2 text-xs"
													>
														{tag}
													</Badge>
												))}
											</div>
										)}
									</div>
								</div>
							</Link>
						</li>
					))}
				</ul>
			)}

			{/* Load more */}
			{!isLoading && displayNextCursor && (
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
