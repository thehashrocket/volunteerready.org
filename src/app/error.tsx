'use client';

import * as Sentry from '@sentry/nextjs';
import { RefreshCw } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function RootError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		try {
			Sentry.captureException(error);
		} catch {
			// Never let Sentry failure break the error boundary UI
		}
	}, [error]);

	return (
		<div className="flex min-h-[80vh] flex-col items-center justify-center bg-background px-4 text-center">
			<h1 className="font-display text-4xl font-bold text-primary md:text-5xl">
				Something went wrong
			</h1>
			<p className="mt-4 max-w-md text-lg text-muted-foreground">
				{error.message || 'An unexpected error occurred.'}
			</p>
			{error.digest && (
				<p className="mt-2 font-mono text-xs text-muted-foreground/50">
					Error ID: {error.digest}
				</p>
			)}
			<div className="mt-8 flex gap-3">
				<Button onClick={reset}>
					<RefreshCw className="mr-2 h-4 w-4" />
					Try again
				</Button>
				<Button asChild variant="outline">
					<a href="/">Go home</a>
				</Button>
			</div>
		</div>
	);
}
