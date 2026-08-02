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
	const [remaining, setRemaining] = useState<number>(() => {
		return new Date(expiresAt).getTime() - Date.now();
	});
	const [ending, setEnding] = useState(false);
	const [endError, setEndError] = useState<string | null>(null);
	const hasNavigated = useRef(false);

	useEffect(() => {
		const iv = setInterval(() => {
			const next = new Date(expiresAt).getTime() - Date.now();
			setRemaining(next);
			if (next <= 0) {
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
						<span className="tabular-nums">{formatRemaining(remaining)}</span>
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
