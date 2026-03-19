'use client';

import { Download, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

interface BeforeInstallPromptEvent extends Event {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'vr-install-prompt-dismissed';

export function InstallPrompt() {
	const [deferredPrompt, setDeferredPrompt] =
		useState<BeforeInstallPromptEvent | null>(null);
	const [isIos, setIsIos] = useState(false);
	const [isDismissed, setIsDismissed] = useState(true);
	const [isMobile, setIsMobile] = useState(false);

	useEffect(() => {
		// Only show on mobile
		const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
		setIsMobile(mobile);
		if (!mobile) return;

		// Check if already dismissed
		if (localStorage.getItem(DISMISSED_KEY)) return;
		setIsDismissed(false);

		// Check if already installed (standalone mode)
		if (window.matchMedia('(display-mode: standalone)').matches) {
			setIsDismissed(true);
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
			setIsDismissed(true);
		}
		setDeferredPrompt(null);
	}, [deferredPrompt]);

	const handleDismiss = useCallback(() => {
		localStorage.setItem(DISMISSED_KEY, '1');
		setIsDismissed(true);
	}, []);

	if (isDismissed || !isMobile) return null;

	// Show only if we have the Android prompt event OR are on iOS
	if (!deferredPrompt && !isIos) return null;

	return (
		<div className="rounded-lg bg-[#E8DCC8] p-4">
			<div className="flex items-start gap-3">
				<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#1B3C2A]">
					<Download className="h-5 w-5 text-white" />
				</div>
				<div className="flex-1">
					<p className="font-medium text-[#252422]">Install VolunteerReady</p>
					<p className="text-sm text-[#5C5955]">
						{isIos
							? 'Tap the share button, then "Add to Home Screen" for faster access to your shifts.'
							: 'Get faster access to your shifts.'}
					</p>
					{!isIos && (
						<Button
							size="sm"
							className="mt-2 bg-[#1B3C2A] text-white hover:bg-[#2D5E42]"
							onClick={handleInstall}
						>
							Install
						</Button>
					)}
				</div>
				<button
					type="button"
					onClick={handleDismiss}
					className="shrink-0 rounded p-1 text-[#5C5955] hover:bg-[#C4A882]/30"
					aria-label="Dismiss install prompt"
				>
					<X className="h-4 w-4" />
				</button>
			</div>
		</div>
	);
}
