'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

export const COOKIE_CONSENT_STORAGE_KEY = 'vr-cookie-consent';

type CookiePreferences = {
	essential: true;
	analytics: boolean;
};

type ConsentState = 'undecided' | 'decided';

function getStoredPreferences(): CookiePreferences | null {
	if (typeof window === 'undefined') return null;
	try {
		const stored = localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
		if (!stored) return null;
		const parsed = JSON.parse(stored);
		// Validate shape — corrupted/old-schema values must not suppress the banner
		if (
			typeof parsed === 'object' &&
			parsed !== null &&
			'analytics' in parsed
		) {
			return parsed as CookiePreferences;
		}
		return null;
	} catch {
		return null;
	}
}

function storePreferences(prefs: CookiePreferences) {
	try {
		localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(prefs));
	} catch {
		// Storage full or blocked (private browsing) — consent still applies for this session
	}
	// Dispatch event so Analytics component can react
	window.dispatchEvent(
		new CustomEvent('cookie-consent-changed', { detail: prefs }),
	);
}

export function CookieConsentBanner() {
	const [state, setState] = useState<ConsentState>('decided'); // default to 'decided' to avoid flash
	const [showPreferences, setShowPreferences] = useState(false);
	const [analytics, setAnalytics] = useState(false);

	useEffect(() => {
		const stored = getStoredPreferences();
		if (!stored) {
			setState('undecided');
		}
		// else stay 'decided' — banner stays hidden
	}, []);

	const acceptAll = useCallback(() => {
		storePreferences({ essential: true, analytics: true });
		setState('decided');
	}, []);

	const declineAll = useCallback(() => {
		storePreferences({ essential: true, analytics: false });
		setState('decided');
	}, []);

	const savePreferences = useCallback(() => {
		storePreferences({ essential: true, analytics });
		setState('decided');
		setShowPreferences(false);
	}, [analytics]);

	if (state === 'decided') return null;

	return (
		<div
			role="dialog"
			aria-label="Cookie preferences"
			className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background"
		>
			<div className="mx-auto max-w-4xl px-4 py-4 sm:py-5">
				{/* ── Main banner ── */}
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<p className="text-sm leading-relaxed text-muted-foreground">
						We use cookies to keep you signed in and, with your permission, to
						collect anonymous usage analytics.{' '}
						<a
							href="/privacy#cookies-tracking"
							className="text-primary hover:underline"
						>
							Learn more
						</a>
					</p>
					<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
						<Button
							variant="ghost"
							size="sm"
							className="min-h-[44px] text-sm sm:order-1"
							onClick={() => setShowPreferences((v) => !v)}
						>
							Manage preferences
						</Button>
						<Button
							variant="outline"
							size="sm"
							className="min-h-[44px] rounded-full text-sm sm:order-2"
							onClick={declineAll}
						>
							Decline All
						</Button>
						<Button
							size="sm"
							className="min-h-[44px] rounded-full text-sm sm:order-3"
							onClick={acceptAll}
						>
							Accept All
						</Button>
					</div>
				</div>

				{/* ── Expanded preferences ── */}
				<div
					className={cn(
						'overflow-hidden transition-all duration-300',
						showPreferences
							? 'mt-4 max-h-[300px] opacity-100'
							: 'max-h-0 opacity-0',
					)}
				>
					<div className="rounded-lg border border-border bg-muted/30 p-4 sm:p-6">
						<p className="mb-4 text-sm font-semibold text-foreground">
							Cookie Preferences
						</p>
						<div className="space-y-4">
							{/* Essential */}
							<div className="flex items-center justify-between gap-4">
								<div>
									<p className="text-sm font-medium text-foreground">
										Essential
									</p>
									<p className="text-xs text-muted-foreground">
										Session auth, security features
									</p>
								</div>
								<Switch
									checked
									disabled
									aria-label="Essential cookies (always enabled)"
								/>
							</div>
							{/* Analytics */}
							<div className="flex items-center justify-between gap-4">
								<div>
									<p className="text-sm font-medium text-foreground">
										Analytics
									</p>
									<p className="text-xs text-muted-foreground">
										Anonymous usage statistics
									</p>
								</div>
								<Switch
									checked={analytics}
									onCheckedChange={setAnalytics}
									aria-label="Analytics cookies"
								/>
							</div>
						</div>
						<div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-3">
							<Button
								size="sm"
								className="min-h-[44px] rounded-full text-sm"
								onClick={savePreferences}
							>
								Save Preferences
							</Button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
