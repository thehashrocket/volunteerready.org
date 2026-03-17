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
	// beforeSend scrubs sensitive headers (Authorization, Cookie, webhook signatures)
	// before events are sent to Sentry — prevents PII leakage from Checkr/Stripe webhooks
	beforeSend: sentryBeforeSend,
});
