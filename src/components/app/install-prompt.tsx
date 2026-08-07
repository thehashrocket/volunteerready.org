'use client';

import { Download, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useDismissible } from '@/lib/hooks/use-dismissible';

interface BeforeInstallPromptEvent extends Event {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'vr-install-prompt-dismissed';

export function InstallPrompt() {
	const [deferredPrompt, setDeferredPrompt] =
		useState<BeforeInstallPromptEvent | null>(null);
	const [isIos, setIsIos] = useState(false);
	// The dismissal was an unguarded localStorage read; it is now guarded and
	// cross-tab. See `useDismissible`.
	const { isDismissed, dismiss } = useDismissible(DISMISSED_KEY);
	// SEPARATE from the dismissal on purpose. `isDismissed` used to carry three
	// unrelated meanings at once — "the user said no", "the app is already
	// installed" and "the install was accepted" — so an accepted install wrote
	// nothing to storage yet looked identical to a refusal, and the standalone
	// check could not be reasoned about without knowing which meaning was live.
	// This flag means only "there is nothing to offer".
	const [isUnavailable, setIsUnavailable] = useState(false);
	const [isMobile, setIsMobile] = useState(false);

	useEffect(() => {
		// Only show on mobile
		const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
		setIsMobile(mobile);
		if (!mobile) return;

		// Already installed — nothing to offer, regardless of any dismissal.
		if (window.matchMedia('(display-mode: standalone)').matches) {
			setIsUnavailable(true);
			return;
		}

		// iOS detection (no beforeinstallprompt)
		const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
		setIsIos(ios);

		// Android: listen for beforeinstallprompt
		const handler = (e: Event) => {
			e.preventDefault();
			setDeferredPrompt(e as BeforeInstallPromptEvent);
		};
		window.addEventListener('beforeinstallprompt', handler);

		return () => window.removeEventListener('beforeinstallprompt', handler);
	}, []);

	const handleInstall = useCallback(async () => {
		if (!deferredPrompt) return;
		await deferredPrompt.prompt();
		const { outcome } = await deferredPrompt.userChoice;
		if (outcome === 'accepted') {
			// Installed, not refused — so this must NOT write the dismissal key.
			setIsUnavailable(true);
		}
		setDeferredPrompt(null);
	}, [deferredPrompt]);

	if (isDismissed || isUnavailable || !isMobile) return null;

	// Show only if we have the Android prompt event OR are on iOS
	if (!deferredPrompt && !isIos) return null;

	return (
		<div className="rounded-lg bg-muted p-4">
			<div className="flex items-start gap-3">
				<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary">
					<Download className="h-5 w-5 text-white" />
				</div>
				<div className="flex-1">
					<p className="font-medium text-foreground">Install VolunteerReady</p>
					<p className="text-sm text-muted-foreground">
						{isIos
							? 'Tap the share button, then "Add to Home Screen" for faster access to your shifts.'
							: 'Get faster access to your shifts.'}
					</p>
					{!isIos && (
						<Button
							size="sm"
							className="mt-2 bg-primary text-white hover:bg-primary-hover"
							onClick={handleInstall}
						>
							Install
						</Button>
					)}
				</div>
				<button
					type="button"
					onClick={dismiss}
					className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent/30"
					aria-label="Dismiss install prompt"
				>
					<X className="h-4 w-4" />
				</button>
			</div>
		</div>
	);
}
