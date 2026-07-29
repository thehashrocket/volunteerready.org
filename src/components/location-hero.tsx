'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { Eyebrow } from '@/components/eyebrow';
import { Button } from '@/components/ui/button';
import { FOUNDER_BOOKING_URL } from '@/lib/constants';
import {
	CAPTURE_FRAME,
	MARKETING_SCREENSHOTS,
} from '@/lib/marketing-screenshots';

type LocationHeroProps = {
	region: string;
	headline: string;
	description: string;
};

export function LocationHero({
	region,
	headline,
	description,
}: LocationHeroProps) {
	const [imgError, setImgError] = useState(false);

	return (
		<section className="bg-gradient-to-br from-primary/5 via-background to-accent/10 px-4 py-16 sm:py-20">
			<div className="mx-auto grid max-w-6xl items-center gap-10 sm:grid-cols-12">
				{/* Text — col-span-7 on desktop */}
				<div className="sm:col-span-7">
					<Eyebrow tone="primary" className="mb-2">
						{region}
					</Eyebrow>
					<h1 className="font-display mb-4 text-[32px] font-bold leading-tight text-foreground sm:text-5xl [text-wrap:balance]">
						{headline}
					</h1>
					<p className="mb-8 max-w-lg text-lg text-muted-foreground">
						{description}
					</p>
					<div className="flex flex-wrap gap-3">
						<Button size="lg" className="rounded-full px-8" asChild>
							<Link href="#lead-form">Get Set Up Free</Link>
						</Button>
						<Button
							size="lg"
							variant="outline"
							className="rounded-full px-8"
							asChild
						>
							<a
								href={FOUNDER_BOOKING_URL}
								target="_blank"
								rel="noopener noreferrer"
							>
								See How It Works
							</a>
						</Button>
					</div>
				</div>

				{/* Screenshot — col-span-5 on desktop */}
				{/* Deliberately NOT wrapped in FadeInOnScroll, which is the FINDING-001
				    regression `screenshot-section.tsx` already carries: the wrapper holds
				    children at `opacity-0` until an IntersectionObserver reports 15%
				    visibility, so an above-the-fold `priority` image — the LCP candidate,
				    eagerly preloaded — is painted invisible on viewport heights where the
				    threshold never fires (~<820px). The `delay={200}` this replaced made
				    it strictly worse. `ScreenshotSection` encodes the same rule as
				    `{priority ? content : <FadeInOnScroll>}`; here the image is
				    unconditionally priority, so the wrapper is simply gone. */}
				<div className="sm:col-span-5">
					{!imgError && (
						<div className="overflow-hidden rounded-lg border border-border/40 bg-card shadow-sm">
							{/* Was a hardcoded `/images/dashboard-screenshot.png`, an asset
								    that has never existed on disk — so `onError` fired and the
								    guard above blanked the hero's whole right column on all six
								    location pages. It degraded quietly instead of showing a
								    broken icon, which is why it survived. Sourced from the
								    manifest now (src/lib/marketing-screenshots.ts), whose test
								    asserts the file exists, so a missing asset fails CI rather
								    than silently emptying the hero again.

								    Light-only + `priority`, deliberately, matching the homepage
								    hero rather than the annotated in-page screenshots: this is
								    above the fold (Next flags it as LCP without `priority`), and
								    a `dark:hidden` sibling is still fetched by the browser even
								    while hidden, so pairing an eager preload with a dark variant
								    doubles the hero's image cost — the 2026-07-14 eng review
								    (Tension 1) settled that tradeoff the same way, which is why
								    the `dashboard` manifest entry carries a `darkSrc` that its
								    hero call sites do not read. */}
							<Image
								src={MARKETING_SCREENSHOTS.dashboard.src}
								alt="VolunteerReady dashboard showing published opportunities, application counts by status, and organization setup progress"
								width={CAPTURE_FRAME.width}
								height={CAPTURE_FRAME.height}
								// Without `sizes`, next/image emits a DENSITY srcset for the
								// declared 1280 width and the browser unconditionally takes the
								// w=3840 candidate — for a slot that is 5/12 of a max-w-6xl grid
								// (~457px desktop, ~358px inside px-4 on mobile). Paired with
								// `priority` that oversized fetch lands on the LCP critical path
								// of all six /locations pages, which would give back much of what
								// making the hero visible just bought. `AnnotatedScreenshot`
								// carries a `sizes` default for exactly this reason.
								// The container caps at max-w-6xl (1152px), so above a ~1184px
								// viewport the slot stops growing at 5*(1152-440)/12 + 160 =
								// ~457px — a flat 40vw would over-declare by 26% at 1440px and
								// 68% at 1920px, on the LCP path. First clause pins the capped
								// case; second keeps a safe overestimate while the grid is
								// still fluid.
								sizes="(min-width: 1184px) 460px, (min-width: 640px) 40vw, 100vw"
								className="w-full"
								priority
								onError={() => setImgError(true)}
							/>
						</div>
					)}
				</div>
			</div>
		</section>
	);
}
