import { describe, expect, it, vi } from 'vitest';

/**
 * Pins the Sentry options `next.config.ts` passes to `withSentryConfig`.
 *
 * Cron monitoring is done by `withCronAuth` (src/server/lib/cron-auth.ts),
 * after the CRON_SECRET check. Sentry's automatic Vercel cron monitoring must
 * stay off: it starts a check-in on anything carrying Vercel's user agent
 * before any app code runs, so a forged request could post a failed run to a
 * real monitor. Its older `webpack.automaticVercelMonitors` form, like the
 * rest of a `webpack` block, also does nothing under Turbopack. The resolved
 * config (`next-config-images.test.ts`) cannot show these options, so the
 * wrapper is mocked to capture them.
 */

const captured = vi.hoisted(() => ({ options: undefined as unknown }));

vi.mock('@sentry/nextjs/config', () => ({
	withSentryConfig: (config: unknown, options: unknown) => {
		captured.options = options;
		return config;
	},
}));

await import('../next.config');

describe('next.config.ts Sentry options', () => {
	const options = () =>
		captured.options as {
			_experimental?: { vercelCronsMonitoring?: boolean };
			webpack?: unknown;
			tunnelRoute?: string;
		};

	it('leaves automatic Vercel cron monitoring off', () => {
		expect(options()._experimental?.vercelCronsMonitoring).not.toBe(true);
	});

	it('has no webpack block (automaticVercelMonitors, and Turbopack ignores it)', () => {
		expect(options().webpack).toBeUndefined();
	});

	it('keeps the ad-blocker tunnel for browser events', () => {
		expect(options().tunnelRoute).toBe('/monitoring');
	});
});
