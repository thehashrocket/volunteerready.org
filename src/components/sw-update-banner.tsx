'use client';

import { RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

export function SwUpdateBanner() {
	const [showUpdate, setShowUpdate] = useState(false);

	useEffect(() => {
		if (!('serviceWorker' in navigator)) return;

		const handleControllerChange = () => setShowUpdate(true);
		navigator.serviceWorker.addEventListener(
			'controllerchange',
			handleControllerChange,
		);

		return () => {
			navigator.serviceWorker.removeEventListener(
				'controllerchange',
				handleControllerChange,
			);
		};
	}, []);

	if (!showUpdate) return null;

	return (
		<div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm rounded-lg border bg-background p-4 shadow-lg md:left-auto md:right-4">
			<div className="flex items-center gap-3">
				<RefreshCw className="h-4 w-4 shrink-0 text-muted-foreground" />
				<p className="flex-1 text-sm">New version available.</p>
				<Button
					size="sm"
					variant="outline"
					onClick={() => window.location.reload()}
				>
					Reload
				</Button>
			</div>
		</div>
	);
}
