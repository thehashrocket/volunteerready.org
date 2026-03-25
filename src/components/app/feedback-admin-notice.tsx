'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/lib/trpc/client';

export function FeedbackAdminNotice() {
	const { data: session } = useSession();
	const isPlatformAdmin = session?.user?.isPlatformAdmin;

	if (!isPlatformAdmin) return null;

	return <AdminNoticeInner />;
}

function AdminNoticeInner() {
	const { data, isLoading, isError } = trpc.feedback.stats.useQuery(undefined, {
		staleTime: 60_000,
	});

	if (isLoading) {
		return <Skeleton className="h-12 rounded-lg" />;
	}

	if (isError || !data || data.newCount === 0) {
		return null;
	}

	return (
		<Link
			href="/app/admin/feedback"
			className="flex items-center justify-between rounded-lg bg-muted px-4 py-3 text-sm text-foreground transition-colors hover:bg-muted/80"
		>
			<span>
				<strong className="font-semibold">{data.newCount} new</strong> feedback{' '}
				{data.newCount === 1 ? 'item' : 'items'}
			</span>
			<ArrowRight className="h-4 w-4 text-muted-foreground" />
		</Link>
	);
}
