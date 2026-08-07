// VolunteerReady Service Worker
//
// Cache strategy, in full:
//   /_next/static, /icons, /fonts, /images  -> cache-first
//   EVERYTHING ELSE                          -> not handled at all
//
// ==========================================================================
// READ BEFORE EDITING. This file installs onto devices we cannot reach, so a
// bad version of it is the highest-blast-radius change in this repo. Three
// bugs were fixed here at once (v0.41.18.0); each is easy to reintroduce.
//
// 1. THE CACHE NAME MUST VARY PER BUILD. It was the literal `1.0.0`, which
//    nothing in the build rewrote, so `STATIC_CACHE` was permanently
//    `vr-static-v1.0.0` — and `activate` (the only thing that deletes old
//    caches) ran exactly once on each device and then never again. The cache
//    grew without eviction for the life of the install.
//
//    The version now comes from the `?v=` on this script's own URL, which
//    `sw-register.tsx` sets from `BUILD_ID`. A changed script URL is enough
//    for the browser to install a new worker — the byte-for-byte shortcut in
//    the Update algorithm only applies when the URL is unchanged — so this
//    needs no build step and no generated file. Do NOT "simplify" it back to
//    a literal: a literal is a value nobody remembers to bump, which is the
//    exact failure being fixed.
//
// 2. HTML IS NEVER CACHED, AND THAT IS AN ALLOWLIST, NOT A RULE ABOUT PAGES.
//    This worker is registered from the ROOT layout, so it runs for anonymous
//    marketing visitors too, and there is ONE cache per device shared by every
//    user who signs in on it — a front-desk tablet at a nonprofit is a
//    realistic install target. A Cache Storage entry is keyed by the FULL
//    request URL, so the cache leaks in two different ways:
//      - the RESPONSE can identify a user. The previous version pre-cached
//        `['/app', '/app/my-shifts']` at install, so an anonymous visitor
//        stored the LOGIN page under the `/app` key (verified: `/app` 307s to
//        `/login?callbackUrl=%2Fapp` and the install-time fetch follows it),
//        and a signed-in coordinator stored their own dashboard HTML where the
//        next person on the device could be served it from the fallback path;
//      - the KEY itself can BE the credential. `/apply/status?token=…`,
//        `/invite/<token>`, `/invite/company/<token>` and
//        `/credentials/claim/<token>` all carry a one-time secret in the URL
//        while serving entirely generic HTML.
//
//    The first pass at this fixed it with a DENYLIST of paths not to cache.
//    That denylist missed four routes across two review passes — one found by
//    the author, three by a cross-model review — because it fails OPEN: any
//    new `/[token]` route is cached by default and nothing in the review path
//    reliably catches it. So the rule is inverted. `STATIC_PREFIXES` is an
//    ALLOWLIST of content-addressed build output, which cannot contain a
//    secret or user data by construction. Adding a route to this app can no
//    longer put anything in the cache.
//
//    DO NOT re-add a network-first branch for HTML. What it bought was the
//    public marketing site opening offline; what it cost was this whole bug
//    class, plus unbounded cache growth (every `utm_*` variant of a URL is its
//    own entry, and random query strings are an easy way to fill origin
//    storage until writes start failing silently). The installed PWA's
//    `start_url` is `/app`, which was never safely cacheable anyway — offline
//    app support needs a dedicated no-data fallback page, tracked in
//    `docs/TODOS.md`, not a cache of whatever the last user looked at.
//
// 3. NO `skipWaiting()`. `clients.claim()` stays. Together those two let a
//    worker from a new deploy take over a page built against the old one and
//    then delete the caches out from under it. Without `skipWaiting` a new
//    worker waits until every tab is closed, which is the standard lifecycle
//    and makes rotation safe; `clients.claim()` still runs on the FIRST
//    activation (there is no old worker to wait for), so a first-time visitor
//    is controlled immediately and the PWA install works as before.
//
//    Keeping `clients.claim()` is also load-bearing for a test: the
//    first-visit regression in `e2e/public-pages.spec.ts` reproduces the
//    v0.28.0.0 banner bug through the uncontrolled -> controlled transition,
//    and drops to vacuously-passing if nothing ever claims.
//
// Behaviour is asserted in a real browser by `e2e/service-worker.spec.ts`,
// not by reading this file.
// ==========================================================================

// `self.location` is this script's own URL, query included.
const SW_VERSION =
	new URL(self.location.href).searchParams.get('v') || 'unversioned';
const STATIC_CACHE = `vr-static-v${SW_VERSION}`;

// THE ALLOWLIST. Every one of these is build output committed to `public/` or
// emitted by the bundler: content-addressed, identical for every user, and
// incapable of carrying a secret in its URL. Nothing else is cached at all.
//
// Before adding a prefix, ask whether a URL under it can ever differ per user
// or carry a token. If yes — or if you are not certain — it does not go here.
const STATIC_PREFIXES = ['/_next/static/', '/icons/', '/fonts/', '/images/'];

// Install: nothing is pre-cached.
//
// It used to `cache.addAll(['/app', '/app/my-shifts'])`. Both are authenticated
// routes, so for the visitor this worker is most often installed by — an
// anonymous one on a marketing page — it cached two copies of the login page
// under app URLs. `addAll` is also atomic, so those two fetches decided whether
// the worker installed at all, and on a cold server they cost a full render of
// two routes the visitor had not asked for.
self.addEventListener('install', () => {
	// Deliberately empty. See note 3: no `skipWaiting()`.
});

// Activate: delete every cache this app owns except the current build's.
self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys
						.filter((key) => key.startsWith('vr-') && key !== STATIC_CACHE)
						.map((key) => caches.delete(key)),
				),
			)
			.then(() => self.clients.claim()),
	);
});

self.addEventListener('fetch', (event) => {
	const { request } = event;
	const url = new URL(request.url);

	// Skip non-GET requests
	if (request.method !== 'GET') return;

	// Skip cross-origin requests
	if (url.origin !== self.location.origin) return;

	// The allowlist. Returning without calling `respondWith` is not the same as
	// a pass-through `fetch()`: it declines to handle the request at all, so
	// nothing downstream can cache it by accident.
	if (!STATIC_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
		return;
	}

	event.respondWith(
		caches.match(request).then(
			(cached) =>
				cached ||
				fetch(request).then((response) => {
					// Only successful responses are stored. This branch is
					// cache-FIRST, so a cached 404 for a chunk would be served for
					// the life of the build rather than retried.
					if (response.ok) {
						const clone = response.clone();
						// `waitUntil`, not a floating promise: the response is handed to
						// the page immediately, and without this the worker can be
						// suspended before the write lands — leaving a cache that looks
						// populated and is not. A rejected put (quota) is swallowed here
						// deliberately; the consequence is a re-fetch, not an error the
						// user could act on.
						event.waitUntil(
							caches
								.open(STATIC_CACHE)
								.then((cache) => cache.put(request, clone))
								.catch(() => {}),
						);
					}
					return response;
				}),
		),
	);
});
