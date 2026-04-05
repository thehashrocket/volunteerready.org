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
			<body
				style={{
					margin: 0,
					fontFamily:
						'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
					backgroundColor: '#FAFAF8',
					color: '#141311',
				}}
			>
				<div
					style={{
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						justifyContent: 'center',
						minHeight: '100vh',
						padding: '2rem',
						textAlign: 'center',
					}}
				>
					<div
						style={{
							backgroundColor: '#1B3C2A',
							color: '#FAFAF8',
							padding: '8px 20px',
							borderRadius: '6px',
							fontSize: '14px',
							fontWeight: 700,
							marginBottom: '24px',
							letterSpacing: '-0.01em',
						}}
					>
						VolunteerReady
					</div>
					<h1
						style={{
							fontSize: '2.25rem',
							fontWeight: 700,
							color: '#1B3C2A',
							margin: '0 0 12px',
						}}
					>
						Something went wrong
					</h1>
					<p
						style={{
							fontSize: '1.125rem',
							color: '#787571',
							maxWidth: '28rem',
							margin: '0 0 24px',
							lineHeight: 1.6,
						}}
					>
						An unexpected error occurred. Please try again.
					</p>
					{error.digest && (
						<p
							style={{
								fontFamily: 'monospace',
								fontSize: '0.75rem',
								color: '#787571',
								marginBottom: '16px',
							}}
						>
							Error ID: {error.digest}
						</p>
					)}
					<div style={{ display: 'flex', gap: '12px' }}>
						<button
							type="button"
							onClick={reset}
							style={{
								backgroundColor: '#1B3C2A',
								color: '#FAFAF8',
								border: 'none',
								borderRadius: '8px',
								padding: '12px 24px',
								fontSize: '1rem',
								fontWeight: 600,
								cursor: 'pointer',
							}}
						>
							Try again
						</button>
						<a
							href="/"
							style={{
								display: 'inline-flex',
								alignItems: 'center',
								backgroundColor: 'transparent',
								color: '#1B3C2A',
								border: '1px solid #E8E6E1',
								borderRadius: '8px',
								padding: '12px 24px',
								fontSize: '1rem',
								fontWeight: 600,
								textDecoration: 'none',
								cursor: 'pointer',
							}}
						>
							Go home
						</a>
					</div>
				</div>
			</body>
		</html>
	);
}
