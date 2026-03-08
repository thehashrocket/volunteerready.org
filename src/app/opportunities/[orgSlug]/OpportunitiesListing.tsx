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

const TAG_PALETTES = [
	'bg-amber-100 text-amber-800',
	'bg-emerald-100 text-emerald-800',
	'bg-sky-100 text-sky-800',
	'bg-rose-100 text-rose-800',
	'bg-violet-100 text-violet-800',
	'bg-orange-100 text-orange-800',
];

function tagColor(name: string): string {
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
			className={`mb-5 pt-3 space-y-2.5 ${separator ? 'border-t border-stone-100' : ''}`}
		>
			{required.length > 0 && (
				<div>
					<p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-stone-400">
						Skills needed
					</p>
					<div className="flex flex-wrap gap-1.5">
						{required.map((r) => (
							<span
								key={r.id}
								className="inline-flex items-center rounded-full bg-stone-800 px-2.5 py-0.5 text-xs font-medium text-white"
							>
								{r.skill}
							</span>
						))}
					</div>
				</div>
			)}
			{preferred.length > 0 && (
				<div>
					<p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-stone-400">
						Nice to have
					</p>
					<div className="flex flex-wrap gap-1.5">
						{preferred.map((r) => (
							<span
								key={r.id}
								className="inline-flex items-center rounded-full bg-stone-50 px-2.5 py-0.5 text-xs font-medium text-stone-500 ring-1 ring-stone-200"
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
			<span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700 ring-1 ring-green-200">
				<Sparkles className="h-3 w-3" />
				Perfect match
			</span>
		);
	}
	if (match.matchType === 'PARTIAL') {
		return (
			<span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
				{match.score}% match
			</span>
		);
	}
	return (
		<span className="inline-flex items-center gap-1 rounded-full bg-stone-50 px-2.5 py-0.5 text-xs font-medium text-stone-400 ring-1 ring-stone-200">
			Skills needed
		</span>
	);
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
		<article className="group flex flex-col rounded-2xl border border-stone-200 bg-white p-6 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
			{/* Location / remote badge */}
			<div className="mb-3 flex flex-wrap gap-2">
				{opp.isRemote && (
					<span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 ring-1 ring-green-200">
						<Wifi className="h-3 w-3" />
						Remote
					</span>
				)}
				{opp.location && (
					<span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600">
						<MapPin className="h-3 w-3" />
						{opp.location}
					</span>
				)}
				{matchResult && <MatchBadge match={matchResult} />}
			</div>

			{/* Title */}
			<h3 className="mb-2 text-lg font-semibold text-stone-900 transition-colors group-hover:text-green-800">
				{opp.title}
			</h3>

			{/* Description */}
			<p className="mb-4 line-clamp-3 flex-1 text-sm leading-relaxed text-stone-500">
				{opp.description}
			</p>

			{/* Meta row */}
			{(dateRange || opp.commitmentHours != null || opp.capacity != null) && (
				<div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-400">
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
							<span
								key={tag.id}
								className={`rounded-full px-2 py-0.5 text-xs font-medium ${tagColor(tag.name)}`}
							>
								{tag.name}
							</span>
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

			<Link
				href={`/apply/${orgSlug}?opportunityId=${opp.id}`}
				className="mt-auto inline-flex w-full items-center justify-center rounded-xl bg-green-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700 focus-visible:ring-offset-2"
			>
				Apply now
			</Link>
		</article>
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
		<main className="min-h-[calc(100vh-3.5rem)] bg-stone-50">
			{/* Hero */}
			<div className="border-b border-stone-200 bg-white px-4 py-14 text-center">
				<p className="mb-3 text-xs font-semibold uppercase tracking-widest text-green-700">
					Volunteer opportunities
				</p>
				<h1
					className="mx-auto max-w-2xl text-4xl italic leading-tight text-stone-900 sm:text-5xl"
					style={{ fontFamily: 'var(--font-playfair)' }}
				>
					Volunteer with {org.name}
				</h1>
				<p className="mx-auto mt-4 max-w-xl text-base text-stone-500">
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
						<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
						<input
							type="search"
							placeholder="Search opportunities…"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="w-full rounded-xl border-0 bg-white py-2.5 pl-9 pr-4 text-sm text-stone-900 ring-1 ring-stone-200 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-green-700"
						/>
					</div>

					{/* Filter row */}
					<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
						{/* Work mode toggle */}
						<div className="flex overflow-hidden rounded-xl bg-white ring-1 ring-stone-200">
							{REMOTE_OPTIONS.map(([value, label]) => (
								<button
									key={value}
									type="button"
									aria-pressed={remoteFilter === value}
									onClick={() => setRemoteFilter(value)}
									className={`px-3 py-2 text-sm font-medium transition-colors ${
										remoteFilter === value
											? 'bg-green-700 text-white'
											: 'text-stone-600 hover:bg-stone-50'
									}`}
								>
									{label}
								</button>
							))}
						</div>

						{/* Sort */}
						<select
							value={sortBy}
							onChange={(e) => setSortBy(e.target.value as SortBy)}
							className="rounded-xl bg-white px-3 py-2 text-sm text-stone-700 ring-1 ring-stone-200 focus:outline-none focus:ring-2 focus:ring-green-700"
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
							<button
								type="button"
								aria-pressed={activeTag === null}
								onClick={() => setActiveTag(null)}
								className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
									activeTag === null
										? 'bg-green-700 text-white'
										: 'bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-100'
								}`}
							>
								All
							</button>
							{allTags.map((tagName) => (
								<button
									type="button"
									key={tagName}
									aria-pressed={activeTag === tagName}
									onClick={() =>
										setActiveTag(activeTag === tagName ? null : tagName)
									}
									className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
										activeTag === tagName
											? 'bg-green-700 text-white'
											: 'bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-100'
									}`}
								>
									{tagName}
								</button>
							))}
						</div>
					)}

					{/* Results bar */}
					{hasActiveFilters && (
						<div className="mb-6 flex items-center justify-between text-sm">
							<span className="text-stone-500">
								{`${filtered.length} ${filtered.length === 1 ? 'result' : 'results'}`}
							</span>
							<button
								type="button"
								onClick={clearFilters}
								className="text-green-700 hover:underline"
							>
								Clear filters
							</button>
						</div>
					)}

					{/* Grid */}
					{filtered.length === 0 ? (
						<div className="text-center text-sm text-stone-400">
							<p>No opportunities match your filters.</p>
							<button
								type="button"
								onClick={clearFilters}
								className="mt-2 text-green-700 hover:underline"
							>
								Clear filters
							</button>
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
