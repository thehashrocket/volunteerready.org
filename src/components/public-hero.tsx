import type { ReactNode } from 'react';
import { Eyebrow } from '@/components/eyebrow';
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
	/**
	 * Optional right-column side note. When provided, hero renders as a 7/5
	 * grid (left copy + right note) per V2 DESIGN.md. Accepts either a
	 * ReactNode (fully custom) or a `{ label, note }` shape which renders
	 * the standard eyebrow label + bordered note pattern.
	 */
	side?: ReactNode | { label: string; note: ReactNode };
};

function isStructuredSide(
	value: unknown,
): value is { label: string; note: ReactNode } {
	return (
		typeof value === 'object' &&
		value !== null &&
		!Array.isArray(value) &&
		'label' in (value as Record<string, unknown>) &&
		'note' in (value as Record<string, unknown>)
	);
}

export function PublicHero({
	eyebrow,
	heading,
	description,
	actions,
	gradientClass = 'from-primary/5 via-background to-accent/10',
	side,
}: PublicHeroProps) {
	const sideContent = isStructuredSide(side) ? (
		<div>
			<Eyebrow className="mb-3">{side.label}</Eyebrow>
			<div className="max-w-[320px] border-l-2 border-accent pl-4 text-sm leading-relaxed text-muted-foreground [&_em]:not-italic [&_em]:font-medium [&_em]:text-primary [&_em.italic]:italic">
				{side.note}
			</div>
		</div>
	) : (
		side
	);

	return (
		<section
			className={cn(
				'relative overflow-hidden px-4 py-14 md:py-20',
				`bg-gradient-to-br ${gradientClass}`,
			)}
		>
			<div
				className={cn(
					'relative mx-auto',
					sideContent
						? 'grid max-w-[1040px] grid-cols-1 gap-10 md:grid-cols-[7fr_5fr] md:items-end md:gap-14'
						: 'max-w-2xl',
				)}
			>
				<div className="max-w-[640px] text-left">
					{eyebrow && (
						<Eyebrow tone="primary" className="mb-4">
							{eyebrow}
						</Eyebrow>
					)}
					<h1 className="font-display text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl sm:leading-tight [text-wrap:balance]">
						{heading}
					</h1>
					<p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
						{description}
					</p>
					{actions && (
						<div className="mt-8 flex flex-wrap items-center justify-start gap-3">
							{actions}
						</div>
					)}
				</div>
				{sideContent && <div className="md:pb-3">{sideContent}</div>}
			</div>
		</section>
	);
}
