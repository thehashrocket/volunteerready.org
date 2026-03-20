'use client';

import dynamic from 'next/dynamic';
import { PageHeader } from '@/components/page-header';
import { Skeleton } from '@/components/ui/skeleton';

const Scanner = dynamic(() => import('./Scanner'), {
	ssr: false,
	loading: () => (
		<div className="space-y-4">
			<Skeleton className="h-10 w-64" />
			<Skeleton className="aspect-square w-full max-w-md" />
			<Skeleton className="h-24 w-full" />
		</div>
	),
});

export default function ScanPage() {
	return (
		<div className="space-y-6">
			<PageHeader
				title="Check-in Scanner"
				description="Scan volunteer QR codes to mark attendance."
			/>
			<Scanner />
		</div>
	);
}
