import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

type CTABannerProps = {
	icon?: LucideIcon;
	heading: ReactNode;
	description: string;
	actions: ReactNode;
};

export function CTABanner({
	icon: Icon,
	heading,
	description,
	actions,
}: CTABannerProps) {
	return (
		<section className="relative overflow-hidden bg-primary px-4 py-16 text-primary-foreground sm:py-20">
			<div
				className="pointer-events-none absolute inset-0"
				style={{
					background:
						'radial-gradient(ellipse at 20% 0%, rgba(196, 168, 130, 0.14) 0%, transparent 50%)',
				}}
				aria-hidden
			/>
			<div className="relative mx-auto grid max-w-[1040px] grid-cols-1 gap-6 text-left md:grid-cols-[7fr_5fr] md:items-end md:gap-12">
				<div className="max-w-[560px]">
					{Icon && <Icon className="mb-4 h-8 w-8 text-primary-foreground/70" />}
					<h2 className="font-display mb-3 text-2xl font-bold leading-tight [text-wrap:balance] sm:text-[32px]">
						{heading}
					</h2>
					<p className="max-w-[520px] text-primary-foreground/75">
						{description}
					</p>
				</div>
				<div className="flex flex-wrap items-center justify-start gap-3 md:pb-1">
					{actions}
				</div>
			</div>
		</section>
	);
}
