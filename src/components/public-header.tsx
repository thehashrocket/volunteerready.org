'use client';

import { Bell, ChevronDown, LogOut, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SessionProvider, signOut, useSession } from 'next-auth/react';
import { useState } from 'react';
import { toast } from 'sonner';
import { NotificationBell } from '@/components/app/notification-bell';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { TRPCProvider } from '@/lib/trpc/provider';
import { trpc } from '@/lib/trpc/client';

const navLinks = [
	{ label: 'For Volunteers', href: '/for-volunteers' },
	{ label: 'For Nonprofits', href: '/for-nonprofits' },
	{ label: 'For Employers', href: '/for-employers' },
	{ label: 'How It Works', href: '/how-it-works' },
	{ label: 'Pricing', href: '/pricing' },
	{ label: 'About', href: '/about' },
];

function UserAvatar({ initial }: { initial: string }) {
	return (
		<div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
			{initial}
		</div>
	);
}

function AvatarSkeleton() {
	return (
		<div
			className="h-7 w-7 rounded-full bg-neutral-200 animate-pulse motion-reduce:animate-none"
			aria-hidden="true"
		>
			<span className="sr-only">Loading</span>
		</div>
	);
}

/** Public header with built-in SessionProvider — safe to use in any layout */
export function PublicHeader() {
	return (
		<SessionProvider>
			<TRPCProvider>
				<PublicHeaderInner />
			</TRPCProvider>
		</SessionProvider>
	);
}

function PublicHeaderInner() {
	const [open, setOpen] = useState(false);
	const pathname = usePathname();
	const { data: session, status } = useSession();

	const isAuthenticated = status === 'authenticated' && !!session?.user;
	const isLoading = status === 'loading';
	const displayName =
		session?.user?.name || session?.user?.email || 'Volunteer';
	const initial = (
		session?.user?.name?.[0] ||
		session?.user?.email?.[0] ||
		'V'
	).toUpperCase();

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

					{isLoading && <AvatarSkeleton />}

					{isAuthenticated && (
						<div className="flex items-center gap-1">
							<NotificationBell />
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<button
										type="button"
										className="flex items-center gap-1.5 rounded-md p-1 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
										aria-label="User menu"
									>
										<UserAvatar initial={initial} />
										<ChevronDown className="h-3 w-3 text-muted-foreground" />
									</button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end" className="w-52">
									<DropdownMenuLabel className="text-sm font-medium">
										Welcome back, {displayName}
									</DropdownMenuLabel>
									<DropdownMenuSeparator />
									<DropdownMenuItem asChild>
										<Link href="/app" className="font-medium">
											My Dashboard
										</Link>
									</DropdownMenuItem>
									<DropdownMenuItem asChild>
										<Link href="/app/my-applications">My Applications</Link>
									</DropdownMenuItem>
									<DropdownMenuItem asChild>
										<Link href="/app/profile">Edit Profile</Link>
									</DropdownMenuItem>
									<DropdownMenuSeparator />
									<DropdownMenuItem
										className="text-muted-foreground"
										onClick={async () => {
											try {
												await signOut({ callbackUrl: '/' });
											} catch {
												toast.error('Sign out failed. Please try again.');
											}
										}}
									>
										<LogOut className="mr-2 h-4 w-4" />
										Sign out
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					)}

					{!isLoading && !isAuthenticated && (
						<Link
							href="/login"
							className="py-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
						>
							Sign in
						</Link>
					)}
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

							{isAuthenticated && (
								<>
									<div className="my-1 border-t border-border/60" />
									{open && (
										<MobileNotificationLink onNavigate={() => setOpen(false)} />
									)}
									<Link
										href="/app"
										onClick={() => setOpen(false)}
										className="rounded-md px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
									>
										My Dashboard
									</Link>
									<Link
										href="/app/my-applications"
										onClick={() => setOpen(false)}
										className="rounded-md px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
									>
										My Applications
									</Link>
									<Link
										href="/app/profile"
										onClick={() => setOpen(false)}
										className="rounded-md px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
									>
										Edit Profile
									</Link>
									<div className="my-1 border-t border-border/60" />
									<button
										type="button"
										onClick={async () => {
											setOpen(false);
											try {
												await signOut({ callbackUrl: '/' });
											} catch {
												toast.error('Sign out failed. Please try again.');
											}
										}}
										className="rounded-md px-3 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted"
									>
										Sign out
									</button>
								</>
							)}

							{!isLoading && !isAuthenticated && (
								<Link
									href="/login"
									onClick={() => setOpen(false)}
									className="rounded-md px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
								>
									Sign in
								</Link>
							)}
						</nav>
					</div>
				</div>
			</div>
		</header>
	);
}

/** Mobile: plain link with unread count badge (no popover) */
function MobileNotificationLink({ onNavigate }: { onNavigate: () => void }) {
	const { data: unreadCount = 0 } = trpc.notifications.unreadCount.useQuery(
		undefined,
		{ refetchInterval: 30_000 },
	);

	return (
		<Link
			href="/app"
			onClick={onNavigate}
			className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
		>
			<Bell className="h-4 w-4" />
			Notifications
			{unreadCount > 0 && (
				<span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
					{unreadCount > 99 ? '99+' : unreadCount}
				</span>
			)}
		</Link>
	);
}
