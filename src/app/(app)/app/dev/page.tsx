'use client';

import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { trpc } from '@/lib/trpc/client';

export default function DevPage() {
	const ping = trpc.health.ping.useQuery();
	const currentOrg = trpc.org.getCurrentOrg.useQuery();

	return (
		<div className="space-y-6">
			<PageHeader
				title="Dev Console"
				description="tRPC health and org context checks."
			/>
			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-sm">health.ping</CardTitle>
				</CardHeader>
				<CardContent>
					<pre className="overflow-auto rounded-md bg-muted p-3 text-sm text-muted-foreground">
						{ping.isLoading ? 'Loading...' : JSON.stringify(ping.data, null, 2)}
					</pre>
				</CardContent>
			</Card>
			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-sm">org.getCurrentOrg</CardTitle>
				</CardHeader>
				<CardContent>
					<pre className="overflow-auto rounded-md bg-muted p-3 text-sm text-muted-foreground">
						{currentOrg.isLoading
							? 'Loading...'
							: JSON.stringify(currentOrg.data, null, 2)}
					</pre>
				</CardContent>
			</Card>
		</div>
	);
}
