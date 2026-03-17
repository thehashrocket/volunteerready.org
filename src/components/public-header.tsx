'use client';

import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const navLinks = [
	{ label: 'For Volunteers', href: '/for-volunteers' },
	{ label: 'For Nonprofits', href: '/for-nonprofits' },
	{ label: 'For Employers', href: '/for-employers' },
	{ label: 'How It Works', href: '/how-it-works' },
	{ label: 'Pricing', href: '/pricing' },
	{ label: 'About', href: '/about' },
];

export function PublicHeader() {
	const [open, setOpen] = useState(false);
	const pathname = usePathname();

	return (
		<header className="sticky top-0 z-40 border-b border-border/60 bg-background/95 backdrop-blur-sm">
			<div className="container mx-auto flex h-14 items-center justify-between px-4">
				{/* Logo */}
				<Link
					href="/"
					className="flex min-h-[44px] items-center gap-2.5"
					onClick={() => setOpen(false)}
				>
					<div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">
						V
					</div>
					<span className="text-sm font-semibold tracking-tight text-foreground">
						VolunteerReady
					</span>
				</Link>

				{/* Desktop nav */}
				<nav className="hidden items-center gap-4 md:flex">
					{navLinks.map((link) => (
						<Link
							key={link.href}
							href={link.href}
							className={cn(
								'px-1.5 py-3 text-sm transition-colors hover:text-foreground',
								pathname === link.href
									? 'font-medium text-foreground'
									: 'text-muted-foreground',
							)}
						>
							{link.label}
						</Link>
					))}
					<Link
						href="/login"
						className="py-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
					>
						Sign in
					</Link>
				</nav>

				{/* Mobile hamburger */}
				<button
					type="button"
					className="flex items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground md:hidden"
					aria-label={open ? 'Close menu' : 'Open menu'}
					onClick={() => setOpen((v) => !v)}
				>
					{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
				</button>
			</div>

			{/* Mobile menu */}
			{open && (
				<div className="border-t border-border/60 bg-background px-4 pb-4 md:hidden">
					<nav className="flex flex-col gap-1 pt-2">
						{navLinks.map((link) => (
							<Link
								key={link.href}
								href={link.href}
								onClick={() => setOpen(false)}
								className={cn(
									'rounded-md px-3 py-2.5 text-sm transition-colors hover:bg-muted',
									pathname === link.href
										? 'font-medium text-foreground'
										: 'text-muted-foreground',
								)}
							>
								{link.label}
							</Link>
						))}
						<Link
							href="/login"
							onClick={() => setOpen(false)}
							className="rounded-md px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
						>
							Sign in
						</Link>
					</nav>
				</div>
			)}
		</header>
	);
}
