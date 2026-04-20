'use client';

import { Loader2, Search } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { trpc } from '@/lib/trpc/client';

export default function PlatformOrgsPage() {
	const [search, setSearch] = useState('');
	const [cursor, setCursor] = useState<string | null>(null);

	const { data, isLoading, isError } = trpc.platformAdmin.orgs.list.useQuery({
		search: search.trim() || undefined,
		cursor,
		limit: 50,
	});

	return (
		<div className="mx-auto max-w-5xl space-y-6 p-6">
			<PageHeader
				title="Organizations"
				description="Every org on the platform."
			/>

			<div className="flex items-center gap-2">
				<div className="relative flex-1 max-w-md">
					<Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Search by slug or name"
						value={search}
						onChange={(e) => {
							setSearch(e.target.value);
							setCursor(null);
						}}
						className="pl-8"
					/>
				</div>
			</div>

			{isLoading ? (
				<div className="flex items-center justify-center py-12">
					<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
				</div>
			) : isError ? (
				<Card className="p-6 text-sm text-destructive">
					Failed to load orgs.
				</Card>
			) : !data || data.orgs.length === 0 ? (
				<Card className="p-6 text-sm text-muted-foreground">
					No orgs match that search.
				</Card>
			) : (
				<Card className="divide-y divide-border">
					{data.orgs.map((org) => (
						<Link
							key={org.id}
							href={`/app/admin/platform/orgs/${org.id}`}
							className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
						>
							<div className="flex-1 min-w-0">
								<div className="flex items-center gap-2">
									<span className="font-medium truncate">{org.name}</span>
									<span className="text-xs text-muted-foreground">
										{org.slug}
									</span>
									<span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
										{org.planTier}
									</span>
									{org.suspendedAt && (
										<span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-destructive">
											Suspended
										</span>
									)}
								</div>
								<div className="text-xs text-muted-foreground mt-0.5">
									{org.memberCount} members · {org.opportunityCount} opps ·{' '}
									{org.applicationCount} apps · created{' '}
									{new Date(org.createdAt).toLocaleDateString()}
								</div>
							</div>
						</Link>
					))}
				</Card>
			)}

			{data?.nextCursor && (
				<div className="flex justify-center">
					<Button variant="outline" onClick={() => setCursor(data.nextCursor)}>
						Load more
					</Button>
				</div>
			)}
		</div>
	);
}
