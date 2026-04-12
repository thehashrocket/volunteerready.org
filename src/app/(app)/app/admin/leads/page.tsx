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

export default function LeadsAdminPage() {
	const [locationFilter, setLocationFilter] = useState<string>('all');

	const { data, isLoading } = trpc.leads.list.useQuery({
		locationSlug: locationFilter === 'all' ? undefined : locationFilter,
		limit: 100,
	});

	return (
		<div className="mx-auto max-w-4xl space-y-6 p-6">
			<PageHeader
				title="Leads"
				description="Inbound leads from geo-targeted landing pages"
			/>

			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					<Select value={locationFilter} onValueChange={setLocationFilter}>
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
				</div>
				{data && (
					<p className="text-sm text-muted-foreground">
						{data.total} lead{data.total !== 1 ? 's' : ''}
					</p>
				)}
			</div>

			{isLoading && (
				<div className="flex items-center justify-center py-12">
					<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
				</div>
			)}

			{data && data.leads.length === 0 && (
				<Card className="py-12 text-center">
					<p className="text-muted-foreground">No leads yet.</p>
					<p className="mt-1 text-sm text-muted-foreground">
						Leads from location landing pages will appear here.
					</p>
				</Card>
			)}

			{data && data.leads.length > 0 && (
				<div className="space-y-3">
					{data.leads.map((lead) => (
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
											{LOCATIONS.find((l) => l.slug === lead.locationSlug)
												?.name ?? lead.locationSlug}
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
