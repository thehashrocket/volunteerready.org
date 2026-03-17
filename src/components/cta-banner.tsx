import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

type CTABannerProps = {
	icon?: LucideIcon;
	heading: string;
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
		<section className="bg-primary px-4 py-16 text-primary-foreground sm:py-20">
			<div className="mx-auto max-w-xl text-center">
				{Icon && (
					<Icon className="mx-auto mb-4 h-8 w-8 text-primary-foreground/70" />
				)}
				<h2 className="font-display mb-3 text-2xl font-bold [text-wrap:balance] sm:text-[32px]">
					{heading}
				</h2>
				<p className="mb-8 text-primary-foreground/75">{description}</p>
				<div className="flex flex-wrap items-center justify-center gap-3">
					{actions}
				</div>
			</div>
		</section>
	);
}
