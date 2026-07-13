import { cva, type VariantProps } from 'class-variance-authority';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const eyebrowVariants = cva(
	'text-xs font-semibold uppercase tracking-[0.25em]',
	{
		variants: {
			tone: {
				primary: 'text-primary/70',
				muted: 'text-muted-foreground',
			},
		},
		defaultVariants: {
			tone: 'muted',
		},
	},
);

type EyebrowProps = VariantProps<typeof eyebrowVariants> & {
	children: ReactNode;
	as?: 'p' | 'h2' | 'dt';
	className?: string;
};

export function Eyebrow({
	children,
	as: Tag = 'p',
	tone,
	className,
}: EyebrowProps) {
	return (
		<Tag className={cn(eyebrowVariants({ tone }), className)}>{children}</Tag>
	);
}
