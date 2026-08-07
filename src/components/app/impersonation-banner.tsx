'use client';

import { AlertTriangle, Loader2, LogOut } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface ImpersonationBannerProps {
	targetEmail: string | null;
	targetName: string | null;
	expiresAt: string; // ISO string — hydration-safe
}

function formatRemaining(ms: number) {
	if (ms <= 0) return 'expired';
	const total = Math.ceil(ms / 1000);
	const m = Math.floor(total / 60);
	const s = total % 60;
	return `${m}m ${s.toString().padStart(2, '0')}s`;
}

export function ImpersonationBanner({
	targetEmail,
	targetName,
	expiresAt,
}: ImpersonationBannerProps) {
	// `null` until mounted, and that is the whole point — do NOT seed this from
	// the clock.
	//
	// This component is `'use client'` but it is still SERVER-RENDERED, from
	// `app/(app)/app/layout.tsx`. A `useState` initializer runs in BOTH passes,
	// so `Date.now()` is read once on the server and again at hydration. Any
	// drift across that gap changes the rendered text — "29m 58s" against
	// "29m 57s" — and React treats a text mismatch as a failed hydration:
	//
	//     Uncaught Error: Hydration failed because the server rendered text
	//     didn't match the client. As a result this tree will be regenerated
	//     on the client.
	//
	// "Regenerated" is the damage. React throws away the whole tree and
	// re-renders it, and every control inside the app shell is dead to clicks
	// until that finishes. A coordinator who clicks during the gap watches
	// nothing happen.
	//
	// It hid for so long because the drift is usually sub-second: SSR and
	// hydration land inside the same tick, `formatRemaining` rounds to whole
	// seconds, and the strings match by luck. It reproduces when the response
	// is slow — a cold server, a slow connection — which is why the e2e suite
	// only caught it once it ran on a CI runner compiling routes on demand.
	const [remaining, setRemaining] = useState<number | null>(null);
	const [ending, setEnding] = useState(false);
	const [endError, setEndError] = useState<string | null>(null);
	const hasNavigated = useRef(false);

	useEffect(() => {
		const tick = () => {
			const next = new Date(expiresAt).getTime() - Date.now();
			setRemaining(next);
			return next;
		};

		// Immediately, not on the first interval: otherwise the placeholder below
		// sits there for a full second before the real countdown appears.
		if (tick() <= 0 && !hasNavigated.current) {
			hasNavigated.current = true;
			window.location.href = '/app/admin/platform/users';
			return;
		}

		const iv = setInterval(() => {
			if (tick() <= 0) {
				clearInterval(iv);
				if (!hasNavigated.current) {
					hasNavigated.current = true;
					window.location.href = '/app/admin/platform/users';
				}
			}
		}, 1000);
		return () => clearInterval(iv);
	}, [expiresAt]);

	async function handleEnd() {
		if (ending) return;
		setEnding(true);
		setEndError(null);
		try {
			const res = await fetch('/api/platform-admin/impersonation/end', {
				method: 'POST',
			});
			if (!res.ok) {
				// Deliberately NOT the response body. `res.text()` returns whatever
				// the route, the framework or an edge proxy produced — a Next.js
				// error page, a stack, a gateway's HTML — and rendered it verbatim
				// to the admin. The route itself has no contract to return
				// user-safe text on this path, and the guard test cannot see
				// `src/app/api/**`, so nothing would have flagged it.
				setEndError('Failed to end session. Try again.');
				setEnding(false);
				return;
			}
			window.location.href = '/app/admin/platform/users';
		} catch {
			setEndError('Network error. Check your connection and try again.');
			setEnding(false);
		}
	}

	const label = targetName?.trim()
		? `${targetName} (${targetEmail ?? 'no email'})`
		: (targetEmail ?? 'user');

	return (
		<div role="status" aria-live="polite" className="sticky top-0 z-[9999]">
			<div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-warning bg-warning/15 px-4 py-2 text-sm text-warning-foreground">
				<div className="flex items-center gap-2 font-medium">
					<AlertTriangle className="h-4 w-4 shrink-0" />
					<span>
						Impersonating <span className="font-semibold">{label}</span> ·
						expires in{' '}
						{/* The em-dash placeholder is what the SERVER renders, and it is
						    deliberately clock-free. `tabular-nums` plus a min-width keeps
						    the swap from reflowing the banner on the first tick. */}
						<span className="inline-block min-w-14 tabular-nums">
							{remaining === null ? '—' : formatRemaining(remaining)}
						</span>
					</span>
				</div>
				<button
					type="button"
					onClick={handleEnd}
					disabled={ending}
					className="inline-flex items-center gap-1.5 rounded-md border border-warning/40 bg-background/70 px-2.5 py-1 text-xs font-medium transition hover:bg-background disabled:opacity-60"
				>
					{ending ? (
						<Loader2 className="h-3.5 w-3.5 animate-spin" />
					) : (
						<LogOut className="h-3.5 w-3.5" />
					)}
					End session
				</button>
			</div>
			{endError && (
				<div className="border-b border-destructive/20 bg-destructive/10 px-4 py-1.5 text-xs text-destructive">
					{endError}
				</div>
			)}
		</div>
	);
}
