'use client';

import { Building2, Loader2, Mail, MapPin, Users } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { LOCATIONS } from '@/lib/locations';
import { trpc } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';
import {
	getLeadSourceLabel,
	VERTICAL_SLUGS,
} from '@/server/domain/lead-capture';

type Segment = 'all' | 'geo' | 'vertical-animal-shelters';

function relativeTime(date: Date | string): string {
	const now = Date.now();
	const then = new Date(date).getTime();
	const diff = now - then;
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return 'just now';
	if (mins < 60) return `${mins}m ago`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	if (days < 30) return `${days}d ago`;
	return new Date(date).toLocaleDateString();
}

const segments: { value: Segment; label: string }[] = [
	{ value: 'all', label: 'All' },
	{ value: 'geo', label: 'Geo' },
	...VERTICAL_SLUGS.map((slug) => ({
		value: slug as Segment,
		label: getLeadSourceLabel(slug),
	})),
];

export default function LeadsAdminPage() {
	const [segment, setSegment] = useState<Segment>('all');
	const [geoFilter, setGeoFilter] = useState<string>('all');

	// Determine the locationSlug to pass to the query
	const locationSlug = (() => {
		if (segment === 'all') return undefined;
		if (segment === 'geo') {
			return geoFilter === 'all' ? undefined : geoFilter;
		}
		// Vertical segment — use the slug directly
		return segment;
	})();

	const { data, isLoading } = trpc.leads.list.useQuery({
		locationSlug,
		limit: 100,
	});

	// For the "geo" segment with "all" sub-filter, we need to client-filter
	// to exclude vertical slugs from geo results
	const filteredLeads = (() => {
		if (!data) return [];
		if (segment !== 'geo' || geoFilter !== 'all') return data.leads;
		const verticalSet = new Set<string>(VERTICAL_SLUGS);
		return data.leads.filter((l) => !verticalSet.has(l.locationSlug));
	})();

	const totalCount =
		segment === 'geo' && geoFilter === 'all'
			? filteredLeads.length
			: (data?.total ?? 0);

	return (
		<div className="mx-auto max-w-4xl space-y-6 p-6">
			<PageHeader
				title="Leads"
				description="Inbound leads from landing pages"
			/>

			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					{/* Segmented control */}
					<div className="inline-flex rounded-lg border border-border bg-muted p-1">
						{segments.map((s) => (
							<button
								key={s.value}
								type="button"
								onClick={() => {
									setSegment(s.value);
									setGeoFilter('all');
								}}
								className={cn(
									'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
									segment === s.value
										? 'bg-background text-foreground shadow-sm'
										: 'text-muted-foreground hover:text-foreground',
								)}
							>
								{s.label}
							</button>
						))}
					</div>

					{/* Geo sub-filter */}
					{segment === 'geo' && (
						<Select value={geoFilter} onValueChange={setGeoFilter}>
							<SelectTrigger className="w-[200px]">
								<SelectValue placeholder="All locations" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All locations</SelectItem>
								{LOCATIONS.map((loc) => (
									<SelectItem key={loc.slug} value={loc.slug}>
										{loc.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
				</div>
				{data && (
					<p className="text-sm text-muted-foreground">
						{totalCount} lead{totalCount !== 1 ? 's' : ''}
					</p>
				)}
			</div>

			{isLoading && (
				<div className="flex items-center justify-center py-12">
					<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
				</div>
			)}

			{data && filteredLeads.length === 0 && (
				<Card className="py-12 text-center">
					<p className="text-muted-foreground">No leads yet.</p>
					<p className="mt-1 text-sm text-muted-foreground">
						Leads from landing pages will appear here.
					</p>
				</Card>
			)}

			{data && filteredLeads.length > 0 && (
				<div className="space-y-3">
					{filteredLeads.map((lead) => (
						<Card key={lead.id} className="p-4">
							<div className="flex items-start justify-between gap-4">
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
										<h3 className="truncate font-semibold text-foreground">
											{lead.orgName}
										</h3>
									</div>
									<div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
										<span className="inline-flex items-center gap-1">
											<Mail className="h-3.5 w-3.5" />
											<a
												href={`mailto:${lead.contactEmail}`}
												className="underline-offset-2 hover:underline"
											>
												{lead.contactEmail}
											</a>
										</span>
										<span className="inline-flex items-center gap-1">
											<MapPin className="h-3.5 w-3.5" />
											{getLeadSourceLabel(lead.locationSlug)}
										</span>
										{lead.volunteerCount && (
											<span className="inline-flex items-center gap-1">
												<Users className="h-3.5 w-3.5" />
												{lead.volunteerCount} volunteers
											</span>
										)}
									</div>
									{lead.currentProcess && (
										<p className="mt-1 text-sm text-muted-foreground">
											Current process: {lead.currentProcess}
										</p>
									)}
									{lead.painPoints && (
										<p className="mt-1 text-sm text-foreground/80">
											"{lead.painPoints}"
										</p>
									)}
								</div>
								<time
									className="shrink-0 text-xs text-muted-foreground"
									dateTime={
										typeof lead.createdAt === 'string'
											? lead.createdAt
											: new Date(lead.createdAt).toISOString()
									}
								>
									{relativeTime(lead.createdAt)}
								</time>
							</div>
						</Card>
					))}
				</div>
			)}
		</div>
	);
}
