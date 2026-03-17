import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type PublicHeroProps = {
	/** Small uppercase label above the heading */
	eyebrow?: string;
	/** Main heading — can include JSX for italic emphasis */
	heading: ReactNode;
	/** Description paragraph below the heading */
	description: string;
	/** CTA buttons */
	actions?: ReactNode;
	/** Background gradient classes (defaults to primary/sand tones) */
	gradientClass?: string;
};

export function PublicHero({
	eyebrow,
	heading,
	description,
	actions,
	gradientClass = 'from-primary/5 via-background to-[#C4A882]/10',
}: PublicHeroProps) {
	return (
		<section
			className={cn(
				'relative overflow-hidden px-4 py-20 sm:py-28',
				`bg-gradient-to-br ${gradientClass}`,
			)}
		>
			<div className="relative mx-auto max-w-2xl text-center sm:text-left">
				{eyebrow && (
					<p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-primary/70">
						{eyebrow}
					</p>
				)}
				<h1 className="font-display text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl sm:leading-tight [text-wrap:balance]">
					{heading}
				</h1>
				<p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground sm:mx-0">
					{description}
				</p>
				{actions && (
					<div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:justify-start">
						{actions}
					</div>
				)}
			</div>
		</section>
	);
}
