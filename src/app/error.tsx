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
			{/* Deliberately NOT `{error.message}`. React replaces a Server
			    Component's message with its own generic string in production, so
			    that half was already opaque — but a CLIENT-side render error keeps
			    its real text, and this boundary covers every public and
			    authenticated route. The digest below is the handle support needs;
			    the message itself is in Sentry and the console, where it is useful
			    to us and not to a stranger reading a marketing page. */}
			<p className="mt-4 max-w-md text-lg text-muted-foreground">
				An unexpected error occurred.
			</p>
			{error.digest && (
				/* Promoted from `text-xs …/50` (~1.9:1, well under the 4.5:1 AA
				   floor). Now that the message is gone this ID is the only thing
				   distinguishing one failure from another and the only handle a
				   user can quote to support — it is content, not chrome. */
				<p className="mt-2 font-mono text-sm text-muted-foreground">
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
