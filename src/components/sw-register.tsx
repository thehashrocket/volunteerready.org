'use client';

import { useEffect } from 'react';
import { BUILD_ID } from '@/lib/app-version';

/**
 * Registers `public/sw.js`, stamping this build's id onto the script URL.
 *
 * THE QUERY STRING IS THE VERSIONING MECHANISM, not a cache-buster. `sw.js` is
 * a static file that no build step rewrites, so its bytes are identical on
 * every deploy — and the Update algorithm's byte-for-byte comparison only
 * short-circuits when the script URL is unchanged. Changing the URL is
 * therefore what makes the browser install a new worker, which is what lets
 * `activate` run and rotate the cache. `sw.js` reads the same `?v=` back out of
 * `self.location` to name that cache, so the script URL and the cache name
 * cannot drift apart.
 *
 * `BUILD_ID` rather than `APP_VERSION` for the same reason the update check
 * uses it (see `lib/app-version.ts`): a rollback or a preview promote can ship
 * different code under the same semver, and each of those should get a fresh
 * cache.
 *
 * Mounted in the ROOT layout deliberately — PWA install and offline are wanted
 * on the public site too (plan decision 5, pinned by
 * `sw-update-banner.guard.test.ts`). That is also why `sw.js` may not cache
 * anything under `/app` or `/api`: this runs for signed-out visitors and for
 * every user who shares a device.
 */
export function SwRegister() {
	useEffect(() => {
		if (!('serviceWorker' in navigator)) return;
		navigator.serviceWorker
			.register(`/sw.js?v=${encodeURIComponent(BUILD_ID)}`)
			.catch(() => {
				// SW registration failed — not critical, app works without it
			});
	}, []);

	return null;
}
