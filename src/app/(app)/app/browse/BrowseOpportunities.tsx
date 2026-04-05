'use client';

import {
	Calendar,
	CheckCircle2,
	Clock,
	MapPin,
	Search,
	Sparkles,
	Users,
	Wifi,
} from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useMemo, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatDateRange } from '@/lib/format-date';
import { trpc } from '@/lib/trpc/client';
import type { ApplicationStatus } from '@/prisma/generated/client';
import type { MatchResult } from '@/server/domain/volunteer-matching';
import type { listAllPublishedOpportunities } from '@/server/repositories/publicOpportunityRepo';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Opportunity = Awaited<
	ReturnType<typeof listAllPublishedOpportunities>
>[number];
type Requirement = Opportunity['requirements'][number];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TAG_PALETTES: Array<
	'warning' | 'success' | 'info' | 'neutral' | 'secondary'
> = ['warning', 'success', 'info', 'neutral', 'secondary'];

function tagVariant(name: string): (typeof TAG_PALETTES)[number] {
	let hash = 0;
	for (let i = 0; i < name.length; i++)
		hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
	return TAG_PALETTES[Math.abs(hash) % TAG_PALETTES.length];
}

type AppliedApp = {
	applicationId: string;
	status: ApplicationStatus;
	submittedAt: Date | string;
};

const APPLIED_BADGE_CONFIG: Record<
	string,
	{ label: string; textClass: string; borderClass: string }
> = {
	SUBMITTED: {
		label: 'Applied — Pending',
		textClass: 'text-amber-700 border-amber-700',
		borderClass: 'border-l-amber-700',
	},
	REVIEW: {
		label: 'Applied — In Review',
		textClass: 'text-blue-700 border-blue-700',
		borderClass: 'border-l-blue-700',
	},
	APPROVED: {
		label: 'Applied — Approved',
		textClass: 'text-success border-success',
		borderClass: 'border-l-success',
	},
};

// ---------------------------------------------------------------------------
// RequirementChips
// ---------------------------------------------------------------------------

function RequirementChips({ requirements }: { requirements: Requirement[] }) {
	if (requirements.length === 0) return null;
	const required = requirements.filter((r) => r.level === 'REQUIRED');
	const preferred = requirements.filter((r) => r.level === 'PREFERRED');
	return (
		<div className="mb-4 space-y-2 border-t pt-3">
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
								{r.skill?.name ?? r.family?.name}
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
								{r.skill?.name ?? r.family?.name}
							</span>
						))}
					</div>
				</div>
			)}
		</div>
	);
}

// ---------------------------------------------------------------------------
// MatchBadge
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
	matchResult,
	appliedApp,
}: {
	opp: Opportunity;
	matchResult?: MatchResult | null;
	appliedApp?: AppliedApp | null;
}) {
	const dateRange = formatDateRange(opp.startDate, opp.endDate);
	const isApplied = appliedApp != null;
	const badgeConfig = isApplied
		? APPLIED_BADGE_CONFIG[appliedApp.status]
		: null;

	return (
		<Card
			className={`group flex flex-col transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
				isApplied && badgeConfig
					? `border-l-[3px] ${badgeConfig.borderClass}`
					: ''
			}`}
		>
			<CardContent className="flex flex-1 flex-col p-6">
				{/* Org name */}
				<p className="mb-2 text-xs font-medium text-muted-foreground">
					{opp.organization.name}
				</p>

				{/* Badges */}
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
					{isApplied && badgeConfig && (
						<Badge
							variant="outline"
							className={badgeConfig.textClass}
							aria-label="You have already applied to this opportunity"
						>
							<CheckCircle2 className="h-3 w-3" />
							{badgeConfig.label}
						</Badge>
					)}
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
				<RequirementChips requirements={opp.requirements} />

				{/* CTA: Apply now vs View My Application */}
				{isApplied ? (
					<Link
						href={`/app/my-applications/${appliedApp.applicationId}`}
						className="mt-auto inline-flex min-h-[44px] items-center justify-center py-3 text-sm font-medium text-success transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
					>
						View My Application &rarr;
					</Link>
				) : (
					<Button asChild className="mt-auto w-full">
						<Link
							href={`/apply/${opp.organization.slug}?opportunityId=${opp.id}`}
						>
							Apply now
						</Link>
					</Button>
				)}
			</CardContent>
		</Card>
	);
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

type RemoteFilter = 'all' | 'remote' | 'in-person';
type SortBy = 'newest' | 'soonest' | 'commitment' | 'best-match';

const REMOTE_OPTIONS: [RemoteFilter, string][] = [
	['all', 'All'],
	['remote', 'Remote'],
	['in-person', 'In-person'],
];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function BrowseOpportunities({
	opportunities,
	matchResults,
}: {
	opportunities: Opportunity[];
	matchResults?: Record<string, MatchResult>;
}) {
	const hasMatching =
		matchResults != null && Object.keys(matchResults).length > 0;

	const [searchQuery, setSearchQuery] = useState('');
	const [remoteFilter, setRemoteFilter] = useState<RemoteFilter>('all');
	const [activeTag, setActiveTag] = useState<string | null>(null);
	const [activeOrg, setActiveOrg] = useState<string | null>(null);
	const [sortBy, setSortBy] = useState<SortBy>(
		hasMatching ? 'best-match' : 'newest',
	);

	// Fetch applied status for authenticated users (cross-org)
	const { status: authStatus } = useSession();
	const isAuthenticated = authStatus === 'authenticated';
	const opportunityIds = useMemo(
		() => opportunities.map((o) => o.id),
		[opportunities],
	);
	const appliedQuery = trpc.screener.getMyAppliedOpportunitiesCrossOrg.useQuery(
		{ opportunityIds },
		{ enabled: isAuthenticated && opportunityIds.length > 0 },
	);
	const appliedMap = appliedQuery.data ?? {};

	// Unique orgs
	const allOrgs = useMemo(() => {
		const seen = new Map<string, string>();
		for (const opp of opportunities) {
			if (!seen.has(opp.organization.id)) {
				seen.set(opp.organization.id, opp.organization.name);
			}
		}
		return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
	}, [opportunities]);

	// Unique tags
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
					o.description.toLowerCase().includes(q) ||
					o.organization.name.toLowerCase().includes(q),
			);
		}

		if (remoteFilter === 'remote') results = results.filter((o) => o.isRemote);
		if (remoteFilter === 'in-person')
			results = results.filter((o) => !o.isRemote);

		if (activeTag)
			results = results.filter((o) => o.tags.some((t) => t.name === activeTag));

		if (activeOrg)
			results = results.filter((o) => o.organization.id === activeOrg);

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
		activeOrg,
		sortBy,
		matchResults,
	]);

	const hasActiveFilters =
		searchQuery.trim() !== '' ||
		remoteFilter !== 'all' ||
		activeTag !== null ||
		activeOrg !== null;

	function clearFilters() {
		setSearchQuery('');
		setRemoteFilter('all');
		setActiveTag(null);
		setActiveOrg(null);
	}

	return (
		<div className="space-y-6">
			<PageHeader
				title="Browse opportunities"
				description={`${opportunities.length} open position${opportunities.length === 1 ? '' : 's'} across ${allOrgs.length} organization${allOrgs.length === 1 ? '' : 's'}`}
			/>

			{opportunities.length === 0 ? (
				<EmptyState
					icon={Search}
					title="No opportunities available"
					description="There are no published volunteer opportunities right now. Check back soon!"
				/>
			) : (
				<>
					{/* Search */}
					<div className="relative">
						<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							type="search"
							placeholder="Search opportunities, organizations..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-9"
						/>
					</div>

					{/* Filter row */}
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div className="flex flex-wrap items-center gap-3">
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

							{/* Org filter */}
							{allOrgs.length > 1 && (
								<select
									value={activeOrg ?? ''}
									onChange={(e) => setActiveOrg(e.target.value || null)}
									className="rounded-md border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
								>
									<option value="">All organizations</option>
									{allOrgs.map((org) => (
										<option key={org.id} value={org.id}>
											{org.name}
										</option>
									))}
								</select>
							)}
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
						<div className="flex flex-wrap gap-2">
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
						<div className="flex items-center justify-between text-sm">
							<span className="text-muted-foreground">
								{filtered.length} {filtered.length === 1 ? 'result' : 'results'}
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
						<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
							{filtered.map((opp) => (
								<OpportunityCard
									key={opp.id}
									opp={opp}
									matchResult={matchResults?.[opp.id]}
									appliedApp={appliedMap[opp.id] as AppliedApp | undefined}
								/>
							))}
						</div>
					)}
				</>
			)}
		</div>
	);
}
