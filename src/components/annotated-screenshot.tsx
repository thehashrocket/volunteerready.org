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
 * the capture viewport stays 1280×720 (see e2e/capture-scenarios.ts). The
 * same coordinates apply to both the light and dark variant below — it's the
 * same UI, just re-themed.
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
	/**
	 * Dark-mode variant of `src`. When provided, both images render (each in
	 * their own frame + marker + legend block) and are toggled purely via
	 * Tailwind's `dark:` class variant — never a `useTheme()` hook. next-themes
	 * sets the `.dark` class on `<html>` in a blocking inline script before
	 * first paint, so a CSS-only swap is correct at first paint; a JS hook
	 * would only resolve after hydration, showing the wrong variant briefly
	 * (2026-07-14 eng review, decision 1B).
	 */
	darkSrc?: string;
	annotations?: ScreenshotAnnotation[];
	/**
	 * Styling for the image frame (border, background, radius). Section
	 * chrome (padding, caption, fade-in) stays with the caller.
	 */
	frameClassName?: string;
	sizes?: string;
	priority?: boolean;
	/** Notified once every declared variant has failed to load. */
	onError?: () => void;
}

function useVariantState(src: string | undefined, priority: boolean) {
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
			`[AnnotatedScreenshot] image failed to load, hiding this variant: ${src}`,
		);
		setHasError(true);
	}, [unoptimizedRetry, src]);

	// An image that errored BEFORE hydration never replays its error event
	// (relevant for the priority hero shot, fetched straight from SSR HTML) —
	// detect that case on mount so the documented hide-on-error behavior
	// holds instead of leaving markers floating over a broken image. Gated on
	// `priority`: a non-priority (lazy, or CSS-hidden dark-mode) image that
	// simply hasn't been requested yet ALSO reports complete=true/naturalWidth
	// 0 — applying this check there would misfire as "broken" on every
	// dark-mode variant, since it's `display:none` until the user is in dark
	// mode and never attempts to load in the meantime.
	useEffect(() => {
		if (!priority) return;
		const el = imgRef.current;
		if (el?.complete && el.naturalWidth === 0) {
			reportError();
		}
	}, [reportError, priority]);

	return { hasError, unoptimizedRetry, imgRef, reportError };
}

export function AnnotatedScreenshot({
	src,
	alt,
	darkSrc,
	annotations,
	frameClassName,
	sizes = '(max-width: 1024px) 100vw, 1024px',
	priority = false,
	onError,
}: AnnotatedScreenshotProps) {
	const light = useVariantState(src, priority);
	const dark = useVariantState(darkSrc, priority);
	const hasDarkVariant = darkSrc !== undefined;

	if (process.env.NODE_ENV !== 'production' && priority && hasDarkVariant) {
		// next/image's `priority` injects an eager preload `<link>` that isn't
		// gated by CSS display — unlike lazy images, both the visible AND the
		// CSS-hidden variant would be fetched unconditionally, doubling bytes
		// for what's supposed to be the one LCP-optimized image. No current
		// entry combines the two (dashboard has no darkSrc), so this only
		// warns a future caller before they introduce the regression.
		console.warn(
			`[AnnotatedScreenshot] priority + darkSrc combined for ${src} — both variants will eagerly preload regardless of active theme.`,
		);
	}

	const onErrorFired = useRef(false);
	// Fires once there is truly nothing left to show in ANY theme. A single
	// broken variant (say darkSrc 404s) does NOT hide anything — the other
	// theme still has a working image, and CSS alone decides which variant is
	// "currently visible," so hiding correctly re-evaluates on every theme
	// toggle without any JS theme detection (2026-07-14 eng review, decision
	// 3B). Guarded to fire at most once: `onError` is typically a fresh
	// inline arrow per parent render (ScreenshotSection's `() =>
	// setHasError(true)`), which would otherwise re-run this effect — and
	// therefore re-invoke onError — on every unrelated parent re-render after
	// the terminal failed state, which would replay any non-idempotent
	// caller side effect (e.g. an analytics event) repeatedly.
	useEffect(() => {
		if (onErrorFired.current) return;
		const nothingLeftToShow = hasDarkVariant
			? light.hasError && dark.hasError
			: light.hasError;
		if (nothingLeftToShow) {
			onErrorFired.current = true;
			onError?.();
		}
	}, [light.hasError, dark.hasError, hasDarkVariant, onError]);

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

	const showLight = !light.hasError;
	const showDark = hasDarkVariant && !dark.hasError;

	if (!showLight && !showDark) return null;

	const renderVariant = (
		variantSrc: string,
		state: ReturnType<typeof useVariantState>,
		visibilityClass: string | undefined,
	) => (
		<div className={visibilityClass}>
			<div className={cn('relative overflow-hidden', frameClassName)}>
				<Image
					ref={state.imgRef}
					src={variantSrc}
					alt={alt}
					width={CAPTURE_FRAME.width}
					height={CAPTURE_FRAME.height}
					sizes={sizes}
					className="w-full"
					priority={priority}
					unoptimized={state.unoptimizedRetry}
					onError={state.reportError}
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

	if (!hasDarkVariant) {
		return showLight ? renderVariant(src, light, undefined) : null;
	}

	// The theme-conditional class is only correct when BOTH variants are
	// healthy — each hides in the other's theme because the other is there
	// to take over. If one has failed, the survivor is the only image left
	// in ANY theme, so it must render unconditionally: a hardcoded
	// 'dark:hidden' on the lone light survivor would itself go invisible to
	// a dark-mode visitor, showing nothing despite a perfectly good image.
	return (
		<>
			{showLight &&
				renderVariant(src, light, showDark ? 'dark:hidden' : undefined)}
			{showDark &&
				renderVariant(
					darkSrc,
					dark,
					showLight ? 'hidden dark:block' : undefined,
				)}
		</>
	);
}
