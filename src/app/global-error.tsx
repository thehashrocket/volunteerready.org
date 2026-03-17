'use client';
import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
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

	// Inline styles are intentional — CSS may not load when the root layout crashes
	return (
		<html lang="en">
			<body>
				<div style={{ padding: '2rem', textAlign: 'center' }}>
					<h2>Something went wrong</h2>
					<button type="button" onClick={reset}>
						Try again
					</button>
				</div>
			</body>
		</html>
	);
}
