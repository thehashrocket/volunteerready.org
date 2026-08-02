// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';
import { sentryBeforeSend } from './src/lib/sentry-before-send';

Sentry.init({
	dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
	tracesSampleRate: 0.1,
	debug: false,
	enableLogs: true,
	// NO global `sampleRate` here, deliberately. A uniform 0.25 was tried and
	// reverted: it applies per-EVENT across the whole Node client, so it discards
	// three quarters of a signal that fires once a year exactly as readily as
	// three quarters of a flood. The things it would have thinned are the ones
	// worth keeping — `IMPERSONATION_RESOLVE_FAILED` (a fail-closed security
	// signal), the audit-integrity `captureMessage`, cron and webhook failures.
	//
	// The volume problem it was meant to solve is real but local to one path, so
	// the throttle lives there instead: see `withinReportBudget` in
	// `src/server/trpc/error-reporting.ts`, which bounds events per
	// procedure+code per minute and leaves everything else at 100%.
	//
	// `dedupeIntegration()` was removed with it: Sentry already GROUPS identical
	// errors without discarding them, whereas Dedupe drops them outright — so two
	// tenants hitting the same fault back to back became one event and every
	// "N occurrences in M minutes" alert silently under-counted.
	// beforeSend scrubs sensitive headers (Authorization, Cookie, webhook signatures)
	// before events are sent to Sentry — prevents PII leakage from Checkr/Stripe webhooks
	beforeSend: sentryBeforeSend,
});
