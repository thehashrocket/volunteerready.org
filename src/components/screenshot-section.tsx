'use client';

import { useState } from 'react';
import {
	AnnotatedScreenshot,
	type ScreenshotAnnotation,
} from '@/components/annotated-screenshot';
import { FadeInOnScroll } from '@/components/fade-in-on-scroll';
import { cn } from '@/lib/utils';

interface ScreenshotSectionProps {
	src: string;
	alt: string;
	caption: string;
	sectionBg?: 'white' | 'sand';
	containerBg?: 'white' | 'sand';
	priority?: boolean;
	annotations?: ScreenshotAnnotation[];
}

export function ScreenshotSection({
	src,
	alt,
	caption,
	sectionBg = 'white',
	containerBg = 'sand',
	priority = false,
	annotations,
}: ScreenshotSectionProps) {
	const [hasError, setHasError] = useState(false);

	if (hasError) return null;

	const sectionClass =
		sectionBg === 'sand'
			? 'bg-muted px-4 py-14 md:py-20'
			: 'px-4 py-14 md:py-20';
	const containerClass = cn(
		containerBg === 'sand' ? 'bg-muted' : 'bg-card',
		'rounded-lg border border-border/40 shadow-sm',
	);

	return (
		<section className={sectionClass}>
			<FadeInOnScroll>
				<div className="mx-auto max-w-5xl">
					<AnnotatedScreenshot
						src={src}
						alt={alt}
						annotations={annotations}
						frameClassName={containerClass}
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
