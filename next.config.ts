import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
	allowedDevOrigins: ['client-frontend.ngrok.io'],
	// TypeScript 7 is the native (Go) port and ships no `lib/typescript.js`, so
	// Next cannot load the JS compiler API it normally type-checks the build
	// with: it fails the build outright with "TypeScript 7.0.2 does not provide
	// the compiler API required by Next.js". This flag spawns the `tsc` CLI as a
	// child process instead. The other option is staying on TypeScript 6.
	//
	// As of Next 16.3 the CLI checker is the DEFAULT, so this is now redundant —
	// kept explicit because the value we need is not the one we'd get by
	// accident: setting it to `false` (or a future default flipping back) makes
	// `next build` exit outright while we are on TS 7. Do not delete it without
	// also moving off TypeScript 7.
	//
	// Note that failure is INVISIBLE to CI: `pnpm typecheck` shells out to `tsc`
	// and passes on TS 7 regardless. Only `next build` (i.e. Vercel) sees it,
	// which is exactly how the dependabot PR came up green and still broke the
	// deploy. Build-time checking is unchanged in strictness, and got faster
	// (9.1s -> 0.4s on this repo).
	experimental: { useTypeScriptCli: true },
	headers: async () => [
		{
			source: '/sw.js',
			headers: [
				{ key: 'Service-Worker-Allowed', value: '/' },
				{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
			],
		},
	],
	redirects: async () => [
		{
			source: '/for-volunteers',
			destination: '/for/volunteers',
			permanent: true,
		},
		{
			source: '/for-nonprofits',
			destination: '/for/nonprofits',
			permanent: true,
		},
		{
			source: '/for-employers',
			destination: '/for/employers',
			permanent: true,
		},
		{
			source: '/app/company/:companyId/team',
			destination: '/app/company/:companyId/esg',
			permanent: true,
		},
		{
			source: '/app/credentials',
			destination: '/app/settings/background-checks',
			permanent: true,
		},
	],
};

export default withSentryConfig(nextConfig, {
	// For all available options, see:
	// https://www.npmjs.com/package/@sentry/webpack-plugin#options

	org: 'volunteerready',

	project: 'volunteer-ready-org',

	// Only print logs for uploading source maps in CI
	silent: !process.env.CI,

	// For all available options, see:
	// https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

	// Upload a larger set of source maps for prettier stack traces (increases build time)
	widenClientFileUpload: true,

	// Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
	// This can increase your server load as well as your hosting bill.
	// Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
	// side errors will fail.
	tunnelRoute: '/monitoring',

	webpack: {
		// Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
		// See the following for more information:
		// https://docs.sentry.io/product/crons/
		// https://vercel.com/docs/cron-jobs
		automaticVercelMonitors: true,

		// Tree-shaking options for reducing bundle size
		treeshake: {
			// Automatically tree-shake Sentry logger statements to reduce bundle size
			removeDebugLogging: true,
		},
	},
});
