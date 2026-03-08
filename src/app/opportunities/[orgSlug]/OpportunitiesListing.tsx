'use client';

import {
	Calendar,
	Clock,
	MapPin,
	Search,
	Sparkles,
	Users,
	Wifi,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatDateRange } from '@/lib/format-date';
import type { MatchResult } from '@/server/domain/volunteer-matching';
import type { listPublishedOpportunities } from '@/server/repositories/publicOpportunityRepo';

// ---------------------------------------------------------------------------
// Types — derived from the repo return shape so they stay in sync automatically
// ---------------------------------------------------------------------------

type ListResult = NonNullable<
	Awaited<ReturnType<typeof listPublishedOpportunities>>
>;
type Opportunity = ListResult['opportunities'][number];
type Org = ListResult['org'];
type Requirement = Opportunity['requirements'][number];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TAG_PALETTES: Array<'warning' | 'success' | 'info' | 'neutral' | 'secondary'> = [
	'warning',
	'success',
	'info',
	'neutral',
	'secondary',
];

function tagVariant(name: string): typeof TAG_PALETTES[number] {
	let hash = 0;
	for (let i = 0; i < name.length; i++)
		hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
	return TAG_PALETTES[Math.abs(hash) % TAG_PALETTES.length];
}

// ---------------------------------------------------------------------------
// RequirementChips
// ---------------------------------------------------------------------------

function RequirementChips({
	requirements,
	separator,
}: {
	requirements: Requirement[];
	separator: boolean;
}) {
	if (requirements.length === 0) return null;
	const required = requirements.filter((r) => r.level === 'REQUIRED');
	const preferred = requirements.filter((r) => r.level === 'PREFERRED');
	return (
		<div
			className={`mb-5 space-y-2.5 pt-3 ${separator ? 'border-t' : ''}`}
		>
			{required.length > 0 && (
				<div>
					<p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
						Skills needed
					</p>
					<div className="flex flex-wrap gap-1.5">
						{required.map((r) => (
							<span
								key={r.id}
								className="inline-flex items-center rounded-full bg-foreground px-2.5 py-0.5 text-xs font-medium text-background"
							>
								{r.skill}
							</span>
						))}
					</div>
				</div>
			)}
			{preferred.length > 0 && (
				<div>
					<p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
						Nice to have
					</p>
					<div className="flex flex-wrap gap-1.5">
						{preferred.map((r) => (
							<span
								key={r.id}
								className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-border"
							>
								{r.skill}
							</span>
						))}
					</div>
				</div>
			)}
		</div>
	);
}

// ---------------------------------------------------------------------------
// MatchBadge — shows how well a volunteer matches an opportunity
// ---------------------------------------------------------------------------

function MatchBadge({ match }: { match: MatchResult }) {
	if (match.matchType === 'PERFECT') {
		return (
			<Badge variant="success">
				<Sparkles className="h-3 w-3" />
				Perfect match
			</Badge>
		);
	}
	if (match.matchType === 'PARTIAL') {
		return <Badge variant="warning">{match.score}% match</Badge>;
	}
	return <Badge variant="neutral">Skills needed</Badge>;
}

// ---------------------------------------------------------------------------
// OpportunityCard
// ---------------------------------------------------------------------------

function OpportunityCard({
	opp,
	orgSlug,
	matchResult,
}: {
	opp: Opportunity;
	orgSlug: string;
	matchResult?: MatchResult | null;
}) {
	const dateRange = formatDateRange(opp.startDate, opp.endDate);

	return (
		<Card className="group flex flex-col transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
			<CardContent className="flex flex-1 flex-col p-6">
				{/* Location / remote badge */}
				<div className="mb-3 flex flex-wrap gap-2">
					{opp.isRemote && (
						<Badge variant="success">
							<Wifi className="h-3 w-3" />
							Remote
						</Badge>
					)}
					{opp.location && (
						<Badge variant="neutral">
							<MapPin className="h-3 w-3" />
							{opp.location}
						</Badge>
					)}
					{matchResult && <MatchBadge match={matchResult} />}
				</div>

				{/* Title */}
				<h3 className="mb-2 text-lg font-semibold text-foreground transition-colors group-hover:text-primary">
					{opp.title}
				</h3>

				{/* Description */}
				<p className="mb-4 line-clamp-3 flex-1 text-sm leading-relaxed text-muted-foreground">
					{opp.description}
				</p>

				{/* Meta row */}
				{(dateRange || opp.commitmentHours != null || opp.capacity != null) && (
					<div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
						{dateRange && (
							<span className="flex items-center gap-1">
								<Calendar className="h-3 w-3 shrink-0" />
								{dateRange}
							</span>
						)}
						{opp.commitmentHours != null && (
							<span className="flex items-center gap-1">
								<Clock className="h-3 w-3 shrink-0" />
								{opp.commitmentHours}h/week
							</span>
						)}
						{opp.capacity != null && (
							<span className="flex items-center gap-1">
								<Users className="h-3 w-3 shrink-0" />
								{opp.capacity} spots
							</span>
						)}
					</div>
				)}

				{/* Tags */}
				{opp.tags.some((t) => t.name) && (
					<div className="mb-4 flex flex-wrap gap-1.5">
						{opp.tags
							.filter((tag) => tag.name)
							.map((tag) => (
								<Badge key={tag.id} variant={tagVariant(tag.name)}>
									{tag.name}
								</Badge>
							))}
					</div>
				)}

				{/* Requirements */}
				<RequirementChips
					requirements={opp.requirements}
					separator={
						!!dateRange ||
						opp.commitmentHours != null ||
						opp.capacity != null ||
						opp.tags.some((t) => t.name)
					}
				/>

				<Button asChild className="mt-auto w-full">
					<Link href={`/apply/${orgSlug}?opportunityId=${opp.id}`}>
						Apply now
					</Link>
				</Button>
			</CardContent>
		</Card>
	);
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type RemoteFilter = 'all' | 'remote' | 'in-person';
type SortBy = 'newest' | 'soonest' | 'commitment' | 'best-match';

const REMOTE_OPTIONS: [RemoteFilter, string][] = [
	['all', 'All'],
	['remote', 'Remote'],
	['in-person', 'In-person'],
];

export function OpportunitiesListing({
	org,
	opportunities,
	matchResults,
}: {
	org: Org;
	opportunities: Opportunity[];
	/** Optional match results keyed by opportunityId (only present for authenticated volunteers). */
	matchResults?: Record<string, MatchResult>;
}) {
	const hasMatching =
		matchResults != null && Object.keys(matchResults).length > 0;

	const [activeTag, setActiveTag] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState('');
	const [remoteFilter, setRemoteFilter] = useState<RemoteFilter>('all');
	const [sortBy, setSortBy] = useState<SortBy>(
		hasMatching ? 'best-match' : 'newest',
	);

	// Collect unique tag names across all opportunities. Tag name is the filter
	// identity, so use it as the React key rather than borrowing a per-opportunity
	// tag ID (which varies depending on which opportunity appeared first).
	const allTags = useMemo(() => {
		const seen = new Set<string>();
		for (const opp of opportunities) {
			for (const tag of opp.tags) {
				if (tag.name) seen.add(tag.name);
			}
		}
		return Array.from(seen);
	}, [opportunities]);

	const filtered = useMemo(() => {
		let results = opportunities;

		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			results = results.filter(
				(o) =>
					o.title.toLowerCase().includes(q) ||
					o.description.toLowerCase().includes(q),
			);
		}

		if (remoteFilter === 'remote') results = results.filter((o) => o.isRemote);
		if (remoteFilter === 'in-person')
			results = results.filter((o) => !o.isRemote);

		if (activeTag)
			results = results.filter((o) => o.tags.some((t) => t.name === activeTag));

		const sorted = [...results];
		if (sortBy === 'best-match' && matchResults) {
			sorted.sort((a, b) => {
				const sa = matchResults[a.id]?.score ?? 0;
				const sb = matchResults[b.id]?.score ?? 0;
				return sb - sa;
			});
		} else if (sortBy === 'soonest') {
			sorted.sort((a, b) => {
				if (a.startDate == null) return 1;
				if (b.startDate == null) return -1;
				return (
					new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
				);
			});
		} else if (sortBy === 'commitment') {
			sorted.sort((a, b) => {
				if (a.commitmentHours == null) return 1;
				if (b.commitmentHours == null) return -1;
				return a.commitmentHours - b.commitmentHours;
			});
		}

		return sorted;
	}, [
		opportunities,
		searchQuery,
		remoteFilter,
		activeTag,
		sortBy,
		matchResults,
	]);

	// Sorting alone does not narrow results, so it does not count as an active
	// filter. Only changes that actually reduce the result set trigger the
	// results bar and "Clear filters" affordance.
	const hasActiveFilters =
		searchQuery.trim() !== '' || remoteFilter !== 'all' || activeTag !== null;

	function clearFilters() {
		setSearchQuery('');
		setRemoteFilter('all');
		setActiveTag(null);
	}

	return (
		<main className="min-h-[calc(100vh-3.5rem)]">
			{/* Hero */}
			<div className="border-b bg-background px-4 py-14 text-center">
				<p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">
					Volunteer opportunities
				</p>
				<h1 className="mx-auto max-w-2xl text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl">
					Volunteer with {org.name}
				</h1>
				<p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground">
					{opportunities.length === 0
						? 'No open opportunities right now — check back soon.'
						: `${opportunities.length} open position${opportunities.length === 1 ? '' : 's'} available`}
				</p>
			</div>

			{/* Body — only rendered when there are opportunities to show */}
			{opportunities.length > 0 && (
				<div className="mx-auto max-w-5xl px-4 py-10">
					{/* Search */}
					<div className="relative mb-4">
						<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							type="search"
							placeholder="Search opportunities…"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-9"
						/>
					</div>

					{/* Filter row */}
					<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
						{/* Work mode toggle */}
						<div className="flex overflow-hidden rounded-md border">
							{REMOTE_OPTIONS.map(([value, label]) => (
								<Button
									key={value}
									type="button"
									variant={remoteFilter === value ? 'default' : 'ghost'}
									size="sm"
									aria-pressed={remoteFilter === value}
									onClick={() => setRemoteFilter(value)}
									className="rounded-none"
								>
									{label}
								</Button>
							))}
						</div>

						{/* Sort */}
						<select
							value={sortBy}
							onChange={(e) => setSortBy(e.target.value as SortBy)}
							className="rounded-md border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
						>
							{hasMatching && <option value="best-match">Best match</option>}
							<option value="newest">Newest</option>
							<option value="soonest">Starting soonest</option>
							<option value="commitment">Shortest commitment</option>
						</select>
					</div>

					{/* Tag filters */}
					{allTags.length > 0 && (
						<div className="mb-6 flex flex-wrap gap-2">
							<Button
								type="button"
								variant={activeTag === null ? 'default' : 'outline'}
								size="sm"
								aria-pressed={activeTag === null}
								onClick={() => setActiveTag(null)}
								className="rounded-full"
							>
								All
							</Button>
							{allTags.map((tagName) => (
								<Button
									type="button"
									key={tagName}
									variant={activeTag === tagName ? 'default' : 'outline'}
									size="sm"
									aria-pressed={activeTag === tagName}
									onClick={() =>
										setActiveTag(activeTag === tagName ? null : tagName)
									}
									className="rounded-full"
								>
									{tagName}
								</Button>
							))}
						</div>
					)}

					{/* Results bar */}
					{hasActiveFilters && (
						<div className="mb-6 flex items-center justify-between text-sm">
							<span className="text-muted-foreground">
								{`${filtered.length} ${filtered.length === 1 ? 'result' : 'results'}`}
							</span>
							<Button
								type="button"
								variant="link"
								size="sm"
								onClick={clearFilters}
								className="h-auto p-0"
							>
								Clear filters
							</Button>
						</div>
					)}

					{/* Grid */}
					{filtered.length === 0 ? (
						<div className="text-center text-sm text-muted-foreground">
							<p>No opportunities match your filters.</p>
							<Button
								type="button"
								variant="link"
								onClick={clearFilters}
								className="mt-2 h-auto p-0"
							>
								Clear filters
							</Button>
						</div>
					) : (
						<div className="grid gap-6 sm:grid-cols-2">
							{filtered.map((opp) => (
								<OpportunityCard
									key={opp.id}
									opp={opp}
									orgSlug={org.slug}
									matchResult={matchResults?.[opp.id]}
								/>
							))}
						</div>
					)}
				</div>
			)}
		</main>
	);
}
