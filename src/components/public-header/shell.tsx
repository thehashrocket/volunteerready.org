'use client';

import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, useState } from 'react';
import { ThemeToggle } from '@/components/theme-toggle';
import { FOUNDER_BOOKING_URL } from '@/lib/constants';
import { getNavPages } from '@/lib/public-pages';
import { cn } from '@/lib/utils';

const navLinks = getNavPages();

export interface MobileMenuControls {
	open: boolean;
	close: () => void;
}

interface HeaderShellProps {
	/** Right end of the desktop nav, after the theme toggle. */
	desktopAccount: ReactNode;
	/** Bottom of the mobile menu, after the page links. */
	mobileAccount: (menu: MobileMenuControls) => ReactNode;
}

/**
 * The public header's markup, with no auth code in it. Everything that needs
 * a session (next-auth, tRPC, the account dropdown) arrives through the two
 * slots, so anonymous visitors never download it. See ./index.tsx.
 */
export function HeaderShell({
	desktopAccount,
	mobileAccount,
}: HeaderShellProps) {
	const [open, setOpen] = useState(false);
	const pathname = usePathname();
	const close = () => setOpen(false);

	return (
		<header
			className="sticky top-0 z-40 border-b border-border/60 bg-background/95 backdrop-blur-sm"
			data-theme-transition
		>
			<div className="container mx-auto flex h-14 items-center justify-between px-4">
				{/* Logo */}
				<Link
					href="/"
					className="flex min-h-[44px] items-center gap-2.5"
					onClick={close}
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
								'whitespace-nowrap px-1.5 py-3 text-sm transition-colors hover:text-foreground',
								pathname === link.href
									? 'font-medium text-foreground'
									: 'text-muted-foreground',
							)}
						>
							{link.label}
						</Link>
					))}

					<ThemeToggle />

					{desktopAccount}
				</nav>

				{/* Mobile hamburger */}
				<button
					type="button"
					className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground md:hidden"
					aria-label={open ? 'Close menu' : 'Open menu'}
					onClick={() => setOpen((v) => !v)}
				>
					{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
				</button>
			</div>

			{/* Mobile menu */}
			<div
				className={cn(
					'grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none md:hidden',
					open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
				)}
				inert={!open}
			>
				<div className="overflow-hidden">
					<div className="border-t border-border/60 bg-background px-4 pb-4">
						<nav className="flex flex-col gap-1 pt-2">
							{navLinks.map((link) => (
								<Link
									key={link.href}
									href={link.href}
									onClick={close}
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

							{mobileAccount({ open, close })}
						</nav>
					</div>
				</div>
			</div>
		</header>
	);
}

export function AvatarSkeleton() {
	return (
		<div
			className="h-7 w-7 rounded-full bg-neutral-200 animate-pulse motion-reduce:animate-none"
			aria-hidden="true"
		>
			<span className="sr-only">Loading</span>
		</div>
	);
}

export function SignedOutDesktop() {
	return (
		<>
			<Link
				href="/login"
				className="whitespace-nowrap py-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
			>
				Sign in
			</Link>
			<a
				href={FOUNDER_BOOKING_URL}
				target="_blank"
				rel="noopener noreferrer"
				className="hidden min-h-[44px] items-center whitespace-nowrap rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 lg:inline-flex"
			>
				Book a setup call
			</a>
		</>
	);
}

export function SignedOutMobile({ close }: MobileMenuControls) {
	return (
		<>
			<Link
				href="/login"
				onClick={close}
				className="rounded-md px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
			>
				Sign in
			</Link>
			<a
				href={FOUNDER_BOOKING_URL}
				target="_blank"
				rel="noopener noreferrer"
				onClick={close}
				className="mt-2 inline-flex min-h-[44px] items-center justify-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
			>
				Book a setup call
			</a>
		</>
	);
}
