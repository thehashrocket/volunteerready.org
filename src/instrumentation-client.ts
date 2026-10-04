// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';
import { BROWSER_DATA_COLLECTION } from '@/lib/sentry-data-collection';
import {
	isSecretUrl,
	scrubBreadcrumb,
	scrubRecordingEvent,
	scrubSentryEvent,
	scrubSpan,
} from '@/lib/sentry-url-scrub';

// Replay's DOM recording stores `location.href` in a meta event that no hook
// can rewrite, so a page whose URL carries a secret (an invite or claim
// token, ?token=) is never recorded. See src/lib/sentry-url-scrub.ts.
const onSecretUrl =
	typeof window !== 'undefined' &&
	isSecretUrl(window.location.pathname + window.location.search);

Sentry.init({
	dsn: 'https://fba2ea33a15f2a443b2aa02c3b899025@o4511061592834048.ingest.us.sentry.io/4511061594406912',

	// Add optional integrations for additional features
	integrations: onSecretUrl
		? []
		: [
				Sentry.replayIntegration({
					beforeAddRecordingEvent: scrubRecordingEvent,
				}),
			],

	// Every URL the SDK records goes through the same scrubber: error events,
	// breadcrumbs and spans (pageload/navigation names, fetch URLs).
	beforeSend: scrubSentryEvent,
	beforeBreadcrumb: scrubBreadcrumb,
	beforeSendSpan: scrubSpan,

	// Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
	tracesSampleRate: 1,

	// Define how likely Replay events are sampled.
	// This sets the sample rate to be 10%. You may want this to be 100% while
	// in development and sample at a lower rate in production
	replaysSessionSampleRate: 0.1,

	// Define how likely Replay events are sampled when an error occurs.
	replaysOnErrorSampleRate: 1.0,

	// What the SDK collects (replaces v10's `sendDefaultPii: true`).
	// See src/lib/sentry-data-collection.ts.
	dataCollection: BROWSER_DATA_COLLECTION,

	// Filter known browser extension and third-party noise.
	// These patterns generate false-positive alerts that drown real errors.
	ignoreErrors: [
		// Password manager extensions (LastPass, Bitwarden, 1Password)
		/Object Not Found Matching Id:\d+/,
		// Benign browser warning, not an error
		/ResizeObserver loop completed with undelivered notifications/,
		/ResizeObserver loop limit exceeded/,
		// Browser extensions throwing strings instead of Error objects
		/Non-Error promise rejection captured with value/,
		// Network failures on visitor devices (flaky connections, nav away mid-fetch)
		/Failed to fetch/,
		/Load failed/,
		/NetworkError when attempting to fetch resource/,
		/ChunkLoadError/,
		/Loading chunk [\d]+ failed/,
		// Legacy browser globals
		'top.GLOBALS',
		'originalCreateNotification',
		'canvas.contentDocument',
	],

	denyUrls: [
		// Browser extensions inject scripts that throw errors in the page context
		/extensions\//i,
		/^chrome-extension:\/\//,
		/^moz-extension:\/\//,
		/^safari-extension:\/\//,
		// Cloudflare scripts
		/cdn-cgi/,
	],
});

// Replay events (which list visited URLs) skip beforeSend; an event processor
// reaches them.
Sentry.addEventProcessor(scrubSentryEvent);

export function onRouterTransitionStart(
	href: string,
	navigationType: string,
): void {
	// Leaving for a secret URL inside the app: stop recording before the new
	// page renders. A stopped replay stays stopped for this page load.
	if (isSecretUrl(href)) void Sentry.getReplay()?.stop();
	Sentry.captureRouterTransitionStart(href, navigationType);
}
