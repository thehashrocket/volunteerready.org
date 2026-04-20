'use client';

import Image from 'next/image';
import { useState } from 'react';
import { FadeInOnScroll } from '@/components/fade-in-on-scroll';

interface ScreenshotSectionProps {
	src: string;
	alt: string;
	caption: string;
	sectionBg?: 'white' | 'sand';
	containerBg?: 'white' | 'sand';
	priority?: boolean;
}

export function ScreenshotSection({
	src,
	alt,
	caption,
	sectionBg = 'white',
	containerBg = 'sand',
	priority = false,
}: ScreenshotSectionProps) {
	const [hasError, setHasError] = useState(false);

	if (hasError) return null;

	const sectionClass =
		sectionBg === 'sand'
			? 'bg-muted px-4 py-14 md:py-20'
			: 'px-4 py-14 md:py-20';
	const containerClass =
		containerBg === 'sand'
			? 'bg-muted rounded-lg border border-border/40 shadow-sm'
			: 'bg-card rounded-lg border border-border/40 shadow-sm';

	return (
		<section className={sectionClass}>
			<FadeInOnScroll>
				<div className={`mx-auto max-w-5xl overflow-hidden ${containerClass}`}>
					<Image
						src={src}
						alt={alt}
						width={1200}
						height={675}
						className="w-full"
						priority={priority}
						onError={() => setHasError(true)}
					/>
				</div>
				<p className="mx-auto mt-3 max-w-3xl text-center text-sm text-muted-foreground">
					{caption}
				</p>
			</FadeInOnScroll>
		</section>
	);
}
