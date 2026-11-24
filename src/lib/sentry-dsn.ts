/**
 * The one Sentry DSN, shared by the browser, Node server and edge configs.
 *
 * A DSN is public by design (it only allows sending events), so it lives in
 * code rather than an env var. It must be the SAME value in all three configs:
 * since `@sentry/nextjs` 11.16 the `/monitoring` tunnel is served by the
 * server SDK, which forwards a browser envelope only if its DSN matches the
 * server client's own. A server with no DSN (or a different one) answers the
 * tunnel with a 404 locally and a 500 on Vercel, and browser errors are lost.
 * `sentry-dsn.test.ts` fails if a config stops importing this constant.
 */
export const SENTRY_DSN =
	'https://fba2ea33a15f2a443b2aa02c3b899025@o4511061592834048.ingest.us.sentry.io/4511061594406912';
