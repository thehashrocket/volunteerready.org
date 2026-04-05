'use client';

import { Share, X } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * Detects iOS Safari (not in standalone mode) and shows a banner
 * prompting the user to add the app to their home screen.
 * iOS does not support the beforeinstallprompt event.
 */
export function IosInstallPrompt() {
	const [show, setShow] = useState(false);

	useEffect(() => {
		// Only show on iOS Safari when not already installed (standalone)
		const ua = navigator.userAgent;
		const isIos =
			/iPad|iPhone|iPod/.test(ua) ||
			(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
		// Only Safari can install PWAs on iOS — exclude other browsers and in-app webviews
		const isSafari =
			isIos &&
			!/CriOS|FxiOS|EdgiOS|OPiOS|FBAN|FBAV|Instagram|Line|Twitter/.test(ua);
		const isStandalone =
			'standalone' in window.navigator &&
			(window.navigator as Navigator & { standalone?: boolean }).standalone;
		let dismissed = false;
		try {
			dismissed = !!localStorage.getItem('ios-install-dismissed');
		} catch {
			// localStorage blocked (privacy mode, enterprise policy)
		}

		if (isSafari && !isStandalone && !dismissed) {
			setShow(true);
		}
	}, []);

	if (!show) return null;

	function dismiss() {
		try {
			localStorage.setItem('ios-install-dismissed', '1');
		} catch {
			// localStorage blocked — dismiss for this session only
		}
		setShow(false);
	}

	return (
		<div className="fixed inset-x-0 bottom-0 z-50 p-4 pb-[env(safe-area-inset-bottom,16px)]">
			<div className="mx-auto max-w-md rounded-xl border border-border bg-card p-4 shadow-lg">
				<div className="flex items-start gap-3">
					<div className="flex-1">
						<p className="font-semibold text-neutral-800 text-sm">
							Install VolunteerReady
						</p>
						<p className="mt-1 text-neutral-600 text-xs leading-relaxed">
							Tap the{' '}
							<Share className="mb-0.5 inline-block h-4 w-4 text-info" /> share
							button, then select{' '}
							<span className="font-medium">
								&ldquo;Add to Home Screen&rdquo;
							</span>
						</p>
					</div>
					<button
						type="button"
						onClick={dismiss}
						className="rounded-full p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
						aria-label="Dismiss install prompt"
					>
						<X className="h-4 w-4" />
					</button>
				</div>
			</div>
		</div>
	);
}
