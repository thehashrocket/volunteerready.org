// VolunteerReady Service Worker
// Cache strategy: cache-first for static assets, network-first for API/pages
const SW_VERSION = '1.0.0';
const STATIC_CACHE = `vr-static-v${SW_VERSION}`;
const APP_SHELL_URLS = ['/app', '/app/my-shifts'];

// Install: pre-cache app shell
self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL_URLS)),
	);
	self.skipWaiting();
});

// Activate: delete old caches from previous versions
self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((keys) =>
			Promise.all(
				keys
					.filter((key) => key.startsWith('vr-') && key !== STATIC_CACHE)
					.map((key) => caches.delete(key)),
			),
		),
	);
	self.clients.claim();
});

// Fetch: network-first for API and pages, cache-first for static assets
self.addEventListener('fetch', (event) => {
	const { request } = event;
	const url = new URL(request.url);

	// Skip non-GET requests
	if (request.method !== 'GET') return;

	// Skip cross-origin requests
	if (url.origin !== self.location.origin) return;

	// API requests and /app/scan: always network-first (never stale)
	if (url.pathname.startsWith('/api/') || url.pathname === '/app/scan') {
		event.respondWith(
			fetch(request).catch(() => caches.match(request)),
		);
		return;
	}

	// Static assets (JS, CSS, images, fonts): cache-first
	if (
		url.pathname.startsWith('/_next/static/') ||
		url.pathname.startsWith('/icons/') ||
		url.pathname.startsWith('/fonts/') ||
		url.pathname.startsWith('/images/')
	) {
		event.respondWith(
			caches.match(request).then(
				(cached) =>
					cached ||
					fetch(request).then((response) => {
						const clone = response.clone();
						caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
						return response;
					}),
			),
		);
		return;
	}

	// App pages: network-first with cache fallback
	event.respondWith(
		fetch(request)
			.then((response) => {
				const clone = response.clone();
				caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
				return response;
			})
			.catch(() => caches.match(request)),
	);
});
