// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';
import { sentryBeforeSend } from './src/lib/sentry-before-send';
import { SERVER_DATA_COLLECTION } from './src/lib/sentry-data-collection';
import { scrubSpan } from './src/lib/sentry-url-scrub';

Sentry.init({
	dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
	tracesSampleRate: 0.1,
	debug: false,
	dataCollection: SERVER_DATA_COLLECTION,
	// Same scrubber as the Node server: strips Authorization, Cookie (header and
	// parsed request.cookies) and webhook signature headers from error events.
	beforeSend: sentryBeforeSend,
	// Spans stream past beforeSend, and Next's request span carries the raw
	// URL (path tokens, ?token=, OAuth codes, tRPC input) in its name and
	// attributes. See src/lib/sentry-url-scrub.ts.
	beforeSendSpan: scrubSpan,
});
