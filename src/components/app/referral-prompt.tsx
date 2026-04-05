'use client';

import { Copy, Share2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

const DISMISSED_KEY = 'vr_referral_prompt_dismissed';

type ReferralPromptProps = {
	orgSlug: string;
	backgroundCheckCompleteCount: number;
};

export function ReferralPrompt({
	orgSlug,
	backgroundCheckCompleteCount,
}: ReferralPromptProps) {
	const [dismissed, setDismissed] = useState(true);
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		setDismissed(localStorage.getItem(DISMISSED_KEY) === 'true');
	}, []);

	if (dismissed) return null;
	if (backgroundCheckCompleteCount === 0) return null;
	if (!orgSlug) return null;

	const referralUrl = `${window.location.origin}/apply/refer?from=${orgSlug}`;

	function handleCopy() {
		navigator.clipboard.writeText(referralUrl);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}

	function handleDismiss() {
		localStorage.setItem(DISMISSED_KEY, 'true');
		setDismissed(true);
	}

	return (
		<div className="rounded-xl border border-accent/40 bg-accent/10 px-5 py-4">
			<div className="flex items-start gap-3">
				<Share2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
				<div className="flex-1">
					<p className="text-sm font-semibold text-foreground">
						Your first background check is complete!
					</p>
					<p className="mt-1 text-sm text-muted-foreground">
						Know another nonprofit that could use this? Share your referral
						link.
					</p>
					<div className="mt-3 flex items-center gap-2">
						<Button variant="outline" size="sm" onClick={handleCopy}>
							<Copy className="mr-1.5 h-3.5 w-3.5" />
							{copied ? 'Copied!' : 'Copy link'}
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={handleDismiss}
							className="text-muted-foreground"
						>
							Dismiss
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
