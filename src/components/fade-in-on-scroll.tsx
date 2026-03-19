'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

type FadeInOnScrollProps = {
	children: React.ReactNode;
	className?: string;
	/** Delay in ms before animation starts (useful for staggering siblings) */
	delay?: number;
};

export function FadeInOnScroll({
	children,
	className,
	delay = 0,
}: FadeInOnScrollProps) {
	const ref = useRef<HTMLDivElement>(null);
	const [isVisible, setIsVisible] = useState(false);

	useEffect(() => {
		const prefersReduced = window.matchMedia(
			'(prefers-reduced-motion: reduce)',
		).matches;
		if (prefersReduced) {
			setIsVisible(true);
			return;
		}

		const el = ref.current;
		if (!el) return;

		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					if (delay > 0) {
						setTimeout(() => setIsVisible(true), delay);
					} else {
						setIsVisible(true);
					}
					observer.unobserve(el);
				}
			},
			{ threshold: 0.15 },
		);

		observer.observe(el);
		return () => observer.disconnect();
	}, [delay]);

	return (
		<div
			ref={ref}
			className={cn(
				'transition-[transform,opacity] duration-500 ease-out',
				isVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
				className,
			)}
		>
			{children}
		</div>
	);
}
