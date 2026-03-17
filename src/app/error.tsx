'use client';

import * as Sentry from '@sentry/nextjs';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

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
		<div className="container mx-auto flex min-h-[60vh] items-center justify-center px-4">
			<Card className="w-full max-w-md">
				<CardContent className="pt-6 text-center">
					<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
						<AlertCircle className="h-6 w-6 text-destructive" />
					</div>
					<h2 className="text-lg font-semibold">Something went wrong</h2>
					<p className="mt-2 text-sm text-muted-foreground">
						{error.message || 'An unexpected error occurred.'}
					</p>
					{error.digest && (
						<p className="mt-1 font-mono text-xs text-muted-foreground/60">
							Error ID: {error.digest}
						</p>
					)}
					<div className="mt-6 flex justify-center gap-2">
						<Button onClick={reset} variant="outline" size="sm">
							<RefreshCw className="mr-2 h-4 w-4" />
							Try again
						</Button>
						<Button asChild size="sm">
							<a href="/">Go home</a>
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
