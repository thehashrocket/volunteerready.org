'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const TABS = [
	{ href: '/app/admin/platform/catalog/skills', label: 'Skills' },
	{
		href: '/app/admin/platform/catalog/screener-defaults',
		label: 'Screener defaults',
	},
];

export default function CatalogLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const pathname = usePathname();

	return (
		<div className="mx-auto max-w-5xl p-6">
			<nav className="mb-6 flex gap-1 border-b">
				{TABS.map((tab) => {
					const active = pathname?.startsWith(tab.href);
					return (
						<Link
							key={tab.href}
							href={tab.href}
							className={cn(
								'px-3 py-2 text-sm font-medium transition-colors',
								active
									? 'border-b-2 border-primary text-foreground'
									: 'text-muted-foreground hover:text-foreground',
							)}
						>
							{tab.label}
						</Link>
					);
				})}
			</nav>
			{children}
		</div>
	);
}
