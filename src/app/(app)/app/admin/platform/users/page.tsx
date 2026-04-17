'use client';

import { Loader2, Search, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { trpc } from '@/lib/trpc/client';

export default function PlatformUsersPage() {
	const [search, setSearch] = useState('');
	const [cursor, setCursor] = useState<string | null>(null);

	const { data, isLoading, isError } = trpc.platformAdmin.users.list.useQuery({
		search: search.trim() || undefined,
		cursor,
		limit: 50,
	});

	return (
		<div className="mx-auto max-w-5xl space-y-6 p-6">
			<PageHeader
				title="Users"
				description="Search, inspect, impersonate, or grant platform admin."
			/>

			<div className="flex items-center gap-2">
				<div className="relative flex-1 max-w-md">
					<Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Search by email or name"
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
					Failed to load users.
				</Card>
			) : !data || data.users.length === 0 ? (
				<Card className="p-6 text-sm text-muted-foreground">
					No users match that search.
				</Card>
			) : (
				<Card className="divide-y">
					{data.users.map((u) => (
						<Link
							key={u.id}
							href={`/app/admin/platform/users/${u.id}`}
							className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
						>
							<div className="min-w-0 flex-1">
								<div className="flex items-center gap-2">
									<span className="font-medium truncate">
										{u.email ?? u.id}
									</span>
									{u.isPlatformAdmin && (
										<ShieldCheck className="h-3.5 w-3.5 text-primary" />
									)}
								</div>
								<div className="text-xs text-muted-foreground truncate">
									{u.name ? `${u.name} · ` : ''}
									{u.orgMembershipCount} orgs · {u.companyMembershipCount}{' '}
									companies · created{' '}
									{new Date(u.createdAt).toLocaleDateString()}
								</div>
							</div>
							<div className="text-xs text-muted-foreground">
								{u.lastSessionExpires
									? `last seen ${new Date(
											u.lastSessionExpires,
										).toLocaleDateString()}`
									: 'no session'}
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
