'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BUILD_ID } from '@/lib/app-version';

/**
 * Polls `/api/version` and reports whether the deployed build differs from the
 * one this tab is running.
 *
 * ```
 *                    ┌──────────────────────────────────────────┐
 *                    │  mount, or tab becomes visible / focused  │
 *                    └───────────────────┬──────────────────────┘
 *                                        v
 *                        shouldCheckForUpdate(...)  ── false ──> stay put
 *                                        │ true                  (hidden tab,
 *                                        v                        or within
 *                                  fetch /api/version             the floor)
 *                                        │
 *          ┌─────────────┬───────────────┼────────────────┬──────────────┐
 *          v             v               v                v              v
 *      rejects      non-2xx         non-JSON        empty buildId    ok + JSON
 *     (offline)                    (HTML error)    (unset at build)      │
 *          └─────────────┴───────────────┴────────────────┘              │
 *                            │                                           │
 *                            v                                           v
 *                      UNKNOWN — never "changed".                 buildId equals
 *                      failure counter++; one console            ours? -> idle
 *                      report at exactly N.                      differs? -> check
 *                      Counter resets on any success.            the loop guard,
 *                                                                then UPDATE
 *                                                                AVAILABLE
 * ```
 *
 * Every failure branch collapses to "unknown", never to "changed". A version
 * check is a background nicety: a missed update costs someone a reload a few
 * minutes later, while a false positive tells people to throw away unsaved
 * work for no reason.
 */

export const CHECK_FLOOR_MS = 5 * 60 * 1000;

/** Consecutive failures before one report. Ordinary offline blips are 1-2. */
export const FAILURE_BREADCRUMB_THRESHOLD = 3;

/**
 * Where the loop guard's memory lives (decision 25).
 *
 * `sessionStorage`, NOT a ref or a module variable: the thing it must survive
 * is `location.reload()`, which destroys every piece of in-memory state in the
 * tab. It must also NOT survive the tab, because "this build is bad" is not a
 * fact worth carrying into tomorrow — which is exactly `sessionStorage`'s
 * lifetime, and exactly not `localStorage`'s.
 */
export const RELOADED_FOR_KEY = 'vr_app_update_reloaded_for';

export type AppUpdateState = {
	/** True once a DIFFERENT build id has been seen from the server. */
	isUpdateAvailable: boolean;
	/**
	 * The deployed build id, as an opaque token.
	 *
	 * Exposed ONLY so the Reload button can hand it to `markReloadingFor`
	 * before reloading. It is deliberately not the display string — see
	 * `deployedVersion` — and nothing should render it.
	 */
	deployedBuildId: string;
	/** The deployed release string, for display. Empty until a check succeeds. */
	deployedVersion: string;
	/** Whether the deployed build asked to interrupt (decision 22). */
	severity: 'silent' | 'notice';
};

/**
 * Whether a check should run right now. Extracted as a PURE function because
 * the interesting branches are arithmetic over two timestamps plus a
 * visibility string, and testing them through a `visibilitychange` listener
 * means stubbing `document.visibilityState` per case — a stub that silently
 * stops working leaves green tests asserting nothing.
 *
 * Same split as `useFrozenDesktopShell`: the resolution rule is pure and
 * tested, the DOM wiring stays thin enough to read.
 */
export function shouldCheckForUpdate(
	lastCheckedAt: number | null,
	now: number,
	floorMs: number,
	visibilityState: DocumentVisibilityState,
): boolean {
	if (visibilityState !== 'visible') return false;
	if (lastCheckedAt === null) return true;
	return now - lastCheckedAt >= floorMs;
}

/**
 * Records that this tab is reloading in response to `buildId`, so that if the
 * reload lands on a stale cached shell we do not prompt for the same build
 * again and again with no way out.
 *
 * Called by the Reload button immediately before `location.reload()`.
 */
export function markReloadingFor(buildId: string): void {
	try {
		window.sessionStorage.setItem(RELOADED_FOR_KEY, buildId);
	} catch {
		// Storage blocked. The loop guard is a safety net, not a correctness
		// requirement — losing it costs a repeated prompt, not a wrong one.
	}
}

function readReloadedFor(): string | null {
	try {
		return window.sessionStorage.getItem(RELOADED_FOR_KEY);
	} catch {
		return null;
	}
}

type VersionPayload = {
	buildId?: unknown;
	version?: unknown;
	severity?: unknown;
};

function parse(payload: VersionPayload): AppUpdateState | null {
	const { buildId, version, severity } = payload;
	// An empty build id means the server cannot identify its own build. It
	// never equals ours, so treating it as data would prompt everyone forever.
	if (typeof buildId !== 'string' || buildId === '') return null;
	return {
		deployedBuildId: buildId,
		isUpdateAvailable: buildId !== BUILD_ID,
		deployedVersion: typeof version === 'string' ? version : '',
		severity: severity === 'notice' ? 'notice' : 'silent',
	};
}

const IDLE: AppUpdateState = {
	isUpdateAvailable: false,
	deployedBuildId: '',
	deployedVersion: '',
	severity: 'silent',
};

export function useAppUpdateCheck(): AppUpdateState {
	const [state, setState] = useState<AppUpdateState>(IDLE);
	const lastCheckedAt = useRef<number | null>(null);
	const consecutiveFailures = useRef(0);
	const loopReported = useRef(false);

	const check = useCallback(async () => {
		lastCheckedAt.current = Date.now();
		try {
			const response = await fetch('/api/version', { cache: 'no-store' });
			if (!response.ok) throw new Error(`status ${response.status}`);
			// An edge proxy or a framework error page returns HTML; `.json()`
			// throws here rather than yielding something that reads as a version.
			const parsed = parse((await response.json()) as VersionPayload);
			if (!parsed) throw new Error('unusable payload');

			consecutiveFailures.current = 0;

			if (
				parsed.isUpdateAvailable &&
				readReloadedFor() === parsed.deployedBuildId
			) {
				// We already reloaded for this build and came back running the old
				// one — almost certainly a stale cached shell, whose root cause
				// (`public/sw.js` never rotating its cache) is out of scope here.
				// Report once and stay quiet: a prompt the user cannot escape by
				// complying is worse than no prompt.
				if (!loopReported.current) {
					loopReported.current = true;
					console.error(
						'[app-update-check] reload did not change the running build',
						{ deployed: parsed.deployedBuildId, running: BUILD_ID },
					);
				}
				return;
			}

			setState(parsed);
		} catch (error) {
			consecutiveFailures.current += 1;
			if (consecutiveFailures.current === FAILURE_BREADCRUMB_THRESHOLD) {
				// Exactly AT the threshold, not >=, so a long outage reports once
				// rather than once per check. `console.error` reaches Sentry via
				// its console integration and is never throttled.
				console.error(
					`[app-update-check] ${FAILURE_BREADCRUMB_THRESHOLD} consecutive failures`,
					error,
				);
			}
			// Deliberately no state change. A broken version check is not
			// something to put in front of a user.
		}
	}, []);

	useEffect(() => {
		const maybeCheck = () => {
			if (
				shouldCheckForUpdate(
					lastCheckedAt.current,
					Date.now(),
					CHECK_FLOOR_MS,
					document.visibilityState,
				)
			) {
				void check();
			}
		};

		// Checked on MOUNT, subject to the same floor. The argument that a fresh
		// mount is guaranteed current holds only for a hard page load: on a
		// client-side navigation from a public page into /app, the App Router
		// mounts this shell using the already-loaded bundle, so the mount is
		// exactly when a stale client walks into the app (decision 16).
		maybeCheck();

		document.addEventListener('visibilitychange', maybeCheck);
		window.addEventListener('focus', maybeCheck);
		return () => {
			document.removeEventListener('visibilitychange', maybeCheck);
			window.removeEventListener('focus', maybeCheck);
		};
	}, [check]);

	return state;
}
