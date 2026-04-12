'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { FadeInOnScroll } from '@/components/fade-in-on-scroll';
import { Button } from '@/components/ui/button';
import { FOUNDER_BOOKING_URL } from '@/lib/constants';

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
					<p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
						{region}
					</p>
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
				<div className="sm:col-span-5">
					<FadeInOnScroll delay={200}>
						{!imgError && (
							<div className="overflow-hidden rounded-lg border border-border/40 bg-card shadow-sm">
								<Image
									src="/images/dashboard-screenshot.png"
									alt="VolunteerReady dashboard showing volunteer screening status"
									width={1200}
									height={675}
									className="w-full"
									onError={() => setImgError(true)}
								/>
							</div>
						)}
					</FadeInOnScroll>
				</div>
			</div>
		</section>
	);
}
