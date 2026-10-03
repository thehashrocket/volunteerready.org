import type { BrowserOptions, NodeOptions } from '@sentry/nextjs';

type DataCollection = NonNullable<NodeOptions['dataCollection']>;

// Sentry 11 removed `sendDefaultPii` and made `dataCollection` the only
// switch, with permissive defaults (user info, IPs, every header, request
// bodies). Leaving it unset would have quietly started sending more than v10
// did, so each runtime states it explicitly.
//
// The first five snippets are v10's own PII header deny-list, which v11
// deleted. 'proxied' is ours, for Vercel's `x-vercel-proxied-for` client-IP
// header, which none of v10's snippets match. 'signature' is ours too: Checkr and Stripe webhook signature headers
// were scrubbed from error events by `sentryBeforeSend` but reached spans raw,
// and with streamed spans `beforeSend` never sees a span at all. v11 also
// always filters keys containing auth, token, session, cookie and the like,
// whatever is set here.
const DENY = [
	'forwarded',
	'-ip',
	'remote-',
	'via',
	'-user',
	'proxied',
	'signature',
];

// Query strings carry more than headers do: NextAuth's magic-link callback puts
// the address in `email=`, and the Checkr OAuth callback carries `code=` and
// `state=`. Matching is a case-insensitive substring test, so this also masks
// keys like `zipcode`; over-filtering a query key is the cheaper mistake.
// It covers the URLs Sentry builds (error-event `request.url`/`query_string`,
// span `url.full`/`url.query`), not the raw `http.target` attribute Next sets
// on its own request span (tracked in docs/TODOS.md).
const QUERY_DENY = [...DENY, 'email', 'code', 'state'];

// Node server and edge: v10's `sendDefaultPii: false` behaviour, except that
// request bodies are not collected at all (v10 attached incoming bodies up to
// a medium size, which included webhook and volunteer form payloads).
export const SERVER_DATA_COLLECTION: DataCollection = {
	userInfo: false,
	cookies: { deny: DENY },
	httpHeaders: { deny: DENY },
	urlQueryParams: { deny: QUERY_DENY },
	httpBodies: [],
	graphQL: { document: true, variables: true },
	genAI: { inputs: false, outputs: false },
	databaseQueryData: false,
	queues: false,
	stackFrameVariables: false,
	frameContextLines: 7,
};

// Browser: the equivalent of the `sendDefaultPii: true` the client set in
// v10. Bodies, database data, queues and local variables have no browser
// consumer, so they are off rather than left at the permissive default.
export const BROWSER_DATA_COLLECTION: NonNullable<
	BrowserOptions['dataCollection']
> = {
	userInfo: true,
	cookies: true,
	httpHeaders: true,
	urlQueryParams: true,
	httpBodies: [],
	graphQL: { document: true, variables: true },
	genAI: { inputs: true, outputs: true },
	databaseQueryData: false,
	queues: false,
	stackFrameVariables: false,
	frameContextLines: 7,
};
