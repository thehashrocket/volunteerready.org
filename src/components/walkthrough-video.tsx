'use client';

import { Play } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { trackEvent } from '@/lib/analytics';
import { cn } from '@/lib/utils';

interface WalkthroughVideoProps {
	src: string;
	poster: string;
	/** e.g. "1-minute" — read out in the play button's accessible name. */
	durationLabel: string;
	transcript: readonly string[];
	/** One line under the video, above the transcript toggle. */
	caption?: string;
	className?: string;
}

/**
 * Click-to-play product walkthrough.
 *
 * The poster is a plain `next/image` with `priority` (it replaces the homepage
 * hero screenshot, so it is the LCP candidate), and the `<video>` element is
 * not mounted until someone presses play. That keeps the ~3.4 MB file off the
 * critical path entirely: `preload="none"` alone still lets some browsers fetch
 * metadata on page load.
 *
 * The video is silent with burned-in captions, which screen readers cannot
 * see, so the same lines are rendered as a text transcript below it.
 */
export function WalkthroughVideo({
	src,
	poster,
	durationLabel,
	transcript,
	caption,
	className,
}: WalkthroughVideoProps) {
	const [playing, setPlaying] = useState(false);
	const videoRef = useRef<HTMLVideoElement>(null);

	useEffect(() => {
		if (!playing) return;
		const video = videoRef.current;
		if (!video) return;
		video.focus();
		// Autoplay after an explicit click is allowed; if a browser still
		// refuses, the native controls are right there.
		void video.play()?.catch(() => {});
	}, [playing]);

	return (
		<div className={className}>
			<div className="relative overflow-hidden rounded-lg border border-border/40 bg-muted shadow-sm">
				{playing ? (
					// biome-ignore lint/a11y/useMediaCaption: silent video; captions are burned in and the transcript below carries the text
					<video
						ref={videoRef}
						src={src}
						poster={poster}
						controls
						playsInline
						preload="auto"
						className="block aspect-video w-full"
						aria-label={`VolunteerReady ${durationLabel} walkthrough`}
					/>
				) : (
					<button
						type="button"
						onClick={() => {
							trackEvent('walkthrough_play', {
								page_path: window.location.pathname,
							});
							setPlaying(true);
						}}
						aria-label={`Play the ${durationLabel} VolunteerReady walkthrough`}
						className="group relative block aspect-video w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
					>
						<Image
							src={poster}
							alt=""
							fill
							priority
							sizes="(max-width: 1024px) 100vw, 1024px"
							className="object-cover"
						/>
						<span className="absolute inset-0 bg-foreground/5 transition-colors group-hover:bg-foreground/10" />
						<span className="absolute inset-0 flex items-center justify-center">
							<span className="flex items-center gap-3 rounded-full bg-primary px-6 py-3 text-base font-medium text-primary-foreground shadow-lg transition-transform group-hover:scale-[1.03]">
								<Play className="h-5 w-5 fill-current" aria-hidden="true" />
								Watch the {durationLabel} walkthrough
							</span>
						</span>
					</button>
				)}
			</div>
			{caption ? (
				<p className="mx-auto mt-3 max-w-3xl text-center text-sm text-muted-foreground">
					{caption}
				</p>
			) : null}
			<details className="mx-auto mt-3 max-w-3xl text-sm text-muted-foreground">
				<summary className="cursor-pointer text-center font-medium text-foreground/80 hover:text-foreground">
					Read the transcript
				</summary>
				<ol className={cn('mt-3 list-decimal space-y-2 pl-5 text-left')}>
					{transcript.map((line) => (
						<li key={line}>{line}</li>
					))}
				</ol>
			</details>
		</div>
	);
}
