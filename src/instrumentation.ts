import * as Sentry from '@sentry/nextjs';

export async function register() {
	if (process.env.NEXT_RUNTIME === 'nodejs') {
		await import('../sentry.server.config');

		// Boot guard: seed reference data on startup (belt-and-suspenders with runtime check)
		try {
			const { ensureReferenceData } = await import(
				'@/server/services/referenceDataService'
			);
			await ensureReferenceData();
		} catch {
			// Non-fatal — runtime guard will catch it on first request
			if (process.env.NODE_ENV === 'development') {
				console.warn(
					'\n⚠️  Reference data check failed at startup.',
					'\n   Run `pnpm seed` to seed your local database.\n',
				);
			}
		}
	}

	if (process.env.NEXT_RUNTIME === 'edge') {
		await import('../sentry.edge.config');
	}
}

export const onRequestError = Sentry.captureRequestError;
