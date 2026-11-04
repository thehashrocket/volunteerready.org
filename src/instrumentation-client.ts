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

function currentUrlIsSecret(): boolean {
	return (
		typeof window !== 'undefined' &&
		isSecretUrl(window.location.pathname + window.location.search)
	);
}

// Replay's DOM recording stores `location.href` in a meta event that no hook
// can rewrite, so a page whose URL carries a secret (an invite or claim
// token, ?token=) is never recorded. See src/lib/sentry-url-scrub.ts.
// Once true for a page load it stays true: leaving for a secret URL in-app
// also sets it (onRouterTransitionStart), so a replay that has not finished
// loading yet can never start afterwards.
let replayBlocked = currentUrlIsSecret();

Sentry.init({
	dsn: 'https://fba2ea33a15f2a443b2aa02c3b899025@o4511061592834048.ingest.us.sentry.io/4511061594406912',

	// Replay is NOT in the first-load bundle: it was ~120 KB of the largest
	// client chunk, paid by every visitor (mobile Lighthouse TBT). It loads as
	// a separate chunk once the page is idle, see loadReplayWhenIdle() below.
	integrations: [],

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

// Held here rather than read back with Sentry.getReplay(): referencing any
// export of @sentry/replay through @sentry/nextjs pulls the whole module
// (rrweb included) back into the main bundle, which is what this avoids.
type StoppableReplay = { stop: () => Promise<void> | void };
let activeReplay: StoppableReplay | undefined;

/**
 * Loads Session Replay after the page is idle instead of shipping it in the
 * main bundle. A dynamic import makes it its own chunk on our origin: Sentry's
 * CDN (lazyLoadIntegration) is on common blocklists and would silently mean no
 * replay for those visitors, where /monitoring already tunnels their events.
 * The secret-URL rule is checked again when the chunk arrives, because the
 * visitor may have navigated in-app while it was downloading.
 */
export async function loadReplay(): Promise<void> {
	if (replayBlocked) return;
	try {
		const { replayIntegration } = await import('@sentry/replay');
		if (replayBlocked || currentUrlIsSecret()) return;
		const replay = replayIntegration({
			beforeAddRecordingEvent: scrubRecordingEvent,
		});
		Sentry.addIntegration(replay);
		activeReplay = replay;
	} catch {
		// Chunk failed to load (offline, deploy mid-session): no replay only.
	}
}

function loadReplayWhenIdle(): void {
	if (typeof window === 'undefined' || replayBlocked) return;
	const schedule = () => {
		if ('requestIdleCallback' in window) {
			window.requestIdleCallback(() => void loadReplay(), { timeout: 5000 });
		} else {
			setTimeout(() => void loadReplay(), 2000);
		}
	};
	if (document.readyState === 'complete') schedule();
	else window.addEventListener('load', schedule, { once: true });
}

loadReplayWhenIdle();

export function onRouterTransitionStart(
	href: string,
	navigationType: string,
): void {
	// Leaving for a secret URL inside the app: stop recording before the new
	// page renders. A stopped replay stays stopped for this page load.
	if (isSecretUrl(href)) {
		replayBlocked = true;
		void activeReplay?.stop();
	}
	Sentry.captureRouterTransitionStart(href, navigationType);
}
