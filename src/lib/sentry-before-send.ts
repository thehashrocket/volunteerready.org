import type { ErrorEvent } from '@sentry/nextjs';
import { scrubSentryEvent } from './sentry-url-scrub';

export function sentryBeforeSend(event: ErrorEvent): ErrorEvent {
	// Scrub sensitive headers to prevent PII leakage
	// (Checkr webhook bodies, Stripe webhooks, OAuth tokens)
	if (event.request?.headers) {
		delete event.request.headers.authorization;
		delete event.request.headers.cookie;
		delete event.request.headers['x-checkr-signature'];
		delete event.request.headers['stripe-signature'];
	}
	// The request-data integration also parses the Cookie header into
	// `request.cookies`, so deleting the header alone left the session token
	// on the event.
	if (event.request?.cookies) {
		delete event.request.cookies;
	}
	// Invite, claim and status tokens, OAuth codes and tRPC input travel in
	// URLs; see sentry-url-scrub.ts.
	return scrubSentryEvent(event);
}
