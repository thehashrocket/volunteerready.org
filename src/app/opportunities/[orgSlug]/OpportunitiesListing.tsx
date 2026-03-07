'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { MapPin, Wifi, Clock, Users, Calendar } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types (inferred from repo return shape)
// ---------------------------------------------------------------------------

type Tag = { id: string; name: string };

type Opportunity = {
	id: string;
	title: string;
	description: string;
	location: string | null;
	isRemote: boolean;
	startDate: Date | string | null;
	endDate: Date | string | null;
	commitmentHours: number | null;
	capacity: number | null;
	tags: Tag[];
};

type Org = { id: string; name: string; slug: string };

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
	for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
	return TAG_PALETTES[Math.abs(hash) % TAG_PALETTES.length];
}

function formatDateRange(start: Date | string | null, end: Date | string | null): string | null {
	const fmt = (d: Date | string) =>
		new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(
			d instanceof Date ? d : new Date(d),
		);
	if (start && end) return `${fmt(start)} – ${fmt(end)}`;
	if (start) return `From ${fmt(start)}`;
	if (end) return `Until ${fmt(end)}`;
	return null;
}

// ---------------------------------------------------------------------------
// OpportunityCard
// ---------------------------------------------------------------------------

function OpportunityCard({ opp, orgSlug }: { opp: Opportunity; orgSlug: string }) {
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
				<div className="mb-5 flex flex-wrap gap-1.5">
					{opp.tags.filter((tag) => tag.name).map((tag) => (
						<span
							key={tag.id}
							className={`rounded-full px-2 py-0.5 text-xs font-medium ${tagColor(tag.name)}`}
						>
							{tag.name}
						</span>
					))}
				</div>
			)}

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

export function OpportunitiesListing({
	org,
	opportunities,
}: {
	org: Org;
	opportunities: Opportunity[];
}) {
	const [activeTag, setActiveTag] = useState<string | null>(null);

	// Collect unique tag names across all opportunities. Tag name is the filter
	// identity, so use it as the React key rather than borrowing a per-opportunity
	// tag ID (which varies depending on which opportunity happened to appear first).
	const allTags = useMemo(() => {
		const seen = new Set<string>();
		for (const opp of opportunities) {
			for (const tag of opp.tags) {
				if (tag.name) seen.add(tag.name);
			}
		}
		return Array.from(seen);
	}, [opportunities]);

	const filtered = useMemo(
		() =>
			activeTag
				? opportunities.filter((o) => o.tags.some((t) => t.name === activeTag))
				: opportunities,
		[opportunities, activeTag],
	);

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

			{/* Body */}
			<div className="mx-auto max-w-5xl px-4 py-10">
				{/* Tag filters */}
				{allTags.length > 0 && (
					<div className="mb-8 flex flex-wrap gap-2">
						<button
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
								key={tagName}
								aria-pressed={activeTag === tagName}
								onClick={() => setActiveTag(activeTag === tagName ? null : tagName)}
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

				{/* Grid */}
				{filtered.length === 0 ? (
					<p className="text-center text-sm text-stone-400">
						No opportunities match that filter.
					</p>
				) : (
					<div className="grid gap-6 sm:grid-cols-2">
						{filtered.map((opp) => (
							<OpportunityCard key={opp.id} opp={opp} orgSlug={org.slug} />
						))}
					</div>
				)}
			</div>
		</main>
	);
}
