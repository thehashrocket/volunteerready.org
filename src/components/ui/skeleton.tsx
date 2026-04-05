import { cn } from '@/lib/utils';

function Skeleton({
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn(
				'rounded-md bg-muted motion-reduce:animate-none',
				className,
			)}
			style={{ animation: 'warm-shimmer 2s ease-in-out infinite' }}
			{...props}
		/>
	);
}

export { Skeleton };
