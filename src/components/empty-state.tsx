import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
	title: string;
	description?: string;
	icon?: LucideIcon;
	action?: ReactNode;
	editorial?: boolean;
}

export function EmptyState({
	title,
	description,
	icon: Icon,
	action,
	editorial,
}: EmptyStateProps) {
	return (
		<div className="rounded-lg border border-dashed bg-muted/30 p-10 text-center">
			{Icon ? (
				<div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted">
					<Icon className="h-5 w-5 text-muted-foreground" />
				</div>
			) : null}
			<h2
				className={cn(
					'mt-4 text-lg font-semibold',
					editorial && 'font-display',
				)}
			>
				{title}
			</h2>
			{description ? (
				<p className="mt-1 text-sm text-muted-foreground">{description}</p>
			) : null}
			{action ? <div className="mt-6 flex justify-center">{action}</div> : null}
		</div>
	);
}
