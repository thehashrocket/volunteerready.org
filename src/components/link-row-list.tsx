import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface LinkRowItem {
	href: string;
	heading: string;
	description: string;
}

interface LinkRowListProps {
	items: LinkRowItem[];
}

export function LinkRowList({ items }: LinkRowListProps) {
	return (
		<div className="divide-y divide-border/40">
			{items.map((item, i) => (
				<Link
					key={item.href}
					href={item.href}
					className={`flex items-center justify-between py-4 transition-colors hover:bg-muted/50 ${
						i % 2 === 1 ? 'bg-muted/30' : ''
					}`}
				>
					<div>
						<h2 className="font-display text-xl font-bold text-foreground sm:text-2xl">
							{item.heading}
						</h2>
						<p className="mt-0.5 text-sm text-muted-foreground">
							{item.description}
						</p>
					</div>
					<ArrowRight className="h-5 w-5 shrink-0 text-primary" />
				</Link>
			))}
		</div>
	);
}
