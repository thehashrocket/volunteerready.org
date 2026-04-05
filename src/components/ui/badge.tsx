import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
	'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
	{
		variants: {
			variant: {
				default: 'border-transparent bg-primary text-primary-foreground',
				secondary: 'border-transparent bg-secondary text-secondary-foreground',
				destructive:
					'border-transparent bg-destructive text-destructive-foreground',
				outline: 'text-foreground',
				success: 'border-success/30 bg-success-muted text-success-foreground',
				warning: 'border-warning/30 bg-warning-muted text-warning-foreground',
				info: 'border-info/30 bg-info-muted text-info-foreground',
				neutral: 'border-neutral/30 bg-neutral-muted text-neutral-foreground',
				pending: 'border-transparent bg-accent-soft text-foreground',
			},
		},
		defaultVariants: {
			variant: 'default',
		},
	},
);

export { badgeVariants };

export interface BadgeProps
	extends React.HTMLAttributes<HTMLDivElement>,
		VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
	return (
		<div className={cn(badgeVariants({ variant }), className)} {...props} />
	);
}
