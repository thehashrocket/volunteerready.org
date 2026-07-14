'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CAPTURE_FRAME } from '@/lib/marketing-screenshots';
import { cn } from '@/lib/utils';

/*
 * Annotation coordinate system — percentages relative to the image box:
 *
 *   (0,0) ──────────── x% ───────────▶ (100,0)
 *     │  ┌───────────────────────────┐
 *     │  │        screenshot         │
 *    y%  │     (1) marker at         │
 *     │  │         x=62, y=38        │
 *     ▼  └───────────────────────────┘
 *  (0,100)                      (100,100)
 *
 * Markers are numbered dots (aria-hidden); the matching text lives in the
 * legend list below the image, so screen readers and search engines get real
 * HTML instead of pixels. Coordinates stay valid across recaptures as long as
 * the capture viewport stays 1280×720 (see e2e/capture-scenarios.ts).
 */

export interface ScreenshotAnnotation {
	/** Horizontal marker position as a percentage of image width (0-100) */
	x: number;
	/** Vertical marker position as a percentage of image height (0-100) */
	y: number;
	label: string;
}

interface AnnotatedScreenshotProps {
	src: string;
	alt: string;
	annotations?: ScreenshotAnnotation[];
	/**
	 * Styling for the image frame (border, background, radius). Section
	 * chrome (padding, caption, fade-in) stays with the caller.
	 */
	frameClassName?: string;
	sizes?: string;
	priority?: boolean;
	/** Notified when the image fails to load (the block also hides itself). */
	onError?: () => void;
}

export function AnnotatedScreenshot({
	src,
	alt,
	annotations,
	frameClassName,
	sizes = '(max-width: 1024px) 100vw, 1024px',
	priority = false,
	onError,
}: AnnotatedScreenshotProps) {
	const [hasError, setHasError] = useState(false);
	// First failure retries the raw static asset (bypassing the image
	// optimizer) — a transient optimizer 5xx must degrade to an unoptimized
	// image, not silently delete marketing content. Hide only when the raw
	// asset fails too (true 404).
	const [unoptimizedRetry, setUnoptimizedRetry] = useState(false);
	const imgRef = useRef<HTMLImageElement>(null);

	const reportError = useCallback(() => {
		if (!unoptimizedRetry) {
			console.warn(
				`[AnnotatedScreenshot] optimized image failed, retrying unoptimized: ${src}`,
			);
			setUnoptimizedRetry(true);
			return;
		}
		// Loud in the console so a production asset failure is observable —
		// the component otherwise hides itself silently.
		console.error(
			`[AnnotatedScreenshot] image failed to load, hiding block: ${src}`,
		);
		setHasError(true);
		onError?.();
	}, [unoptimizedRetry, src, onError]);

	// An image that errored BEFORE hydration never replays its error event
	// (relevant for the priority hero shot, fetched straight from SSR HTML) —
	// detect that case on mount so the documented hide-on-error behavior
	// holds instead of leaving markers floating over a broken image.
	useEffect(() => {
		const el = imgRef.current;
		if (el?.complete && el.naturalWidth === 0) {
			reportError();
		}
	}, [reportError]);

	if (hasError) return null;

	const hasAnnotations = annotations !== undefined && annotations.length > 0;

	if (process.env.NODE_ENV !== 'production' && hasAnnotations) {
		for (const { x, y } of annotations) {
			if (x < 0 || x > 100 || y < 0 || y > 100) {
				// Out-of-frame markers get clipped by overflow-hidden while their
				// legend entry still renders — a silent marker/legend desync.
				console.warn(
					`[AnnotatedScreenshot] marker (${x}, ${y}) outside the 0-100 coordinate frame for ${src}`,
				);
			}
		}
	}

	return (
		<div>
			<div className={cn('relative overflow-hidden', frameClassName)}>
				<Image
					ref={imgRef}
					src={src}
					alt={alt}
					width={CAPTURE_FRAME.width}
					height={CAPTURE_FRAME.height}
					sizes={sizes}
					className="w-full"
					priority={priority}
					unoptimized={unoptimizedRetry}
					onError={reportError}
				/>
				{hasAnnotations &&
					annotations.map((annotation, index) => (
						<span
							key={`${index}-${annotation.x}-${annotation.y}`}
							aria-hidden="true"
							className="absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground shadow-sm ring-2 ring-background"
							style={{ left: `${annotation.x}%`, top: `${annotation.y}%` }}
						>
							{index + 1}
						</span>
					))}
			</div>
			{hasAnnotations && (
				<ol className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
					{annotations.map((annotation, index) => (
						<li
							key={`${index}-${annotation.x}-${annotation.y}`}
							className="flex items-start gap-2.5 text-sm leading-relaxed text-muted-foreground"
						>
							<span
								aria-hidden="true"
								className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground"
							>
								{index + 1}
							</span>
							{annotation.label}
						</li>
					))}
				</ol>
			)}
		</div>
	);
}
