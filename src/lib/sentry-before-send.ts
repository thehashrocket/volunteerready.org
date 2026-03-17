import type { ErrorEvent } from '@sentry/nextjs';

export function sentryBeforeSend(event: ErrorEvent): ErrorEvent {
	// Scrub sensitive headers to prevent PII leakage
	// (Checkr webhook bodies, Stripe webhooks, OAuth tokens)
	if (event.request?.headers) {
		delete event.request.headers.authorization;
		delete event.request.headers.cookie;
		delete event.request.headers['x-checkr-signature'];
		delete event.request.headers['stripe-signature'];
	}
	return event;
}
