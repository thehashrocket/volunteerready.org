'use client';

import { Bell, ChevronDown, LogOut } from 'lucide-react';
import Link from 'next/link';
import type { Session } from 'next-auth';
import { SessionProvider, signOut, useSession } from 'next-auth/react';
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
import { trpc } from '@/lib/trpc/client';
import { TRPCProvider } from '@/lib/trpc/provider';
import { HeaderShell, type MobileMenuControls } from './shell';

/**
 * The signed-in public header. Loaded with next/dynamic only once
 * ./index.tsx has seen a session, because next-auth/react, the tRPC client
 * with React Query, and the Radix dropdown together are ~140 KB that an
 * anonymous visitor (nearly every visitor to a marketing page) never uses.
 *
 * `session` is the one ./index.tsx already fetched, handed to SessionProvider
 * so it does not fetch /api/auth/session a second time on mount.
 */
export default function SignedInHeader({ session }: { session: Session }) {
	return (
		<SessionProvider session={session}>
			<TRPCProvider>
				<HeaderShell
					desktopAccount={<DesktopAccountMenu />}
					mobileAccount={(menu) => <MobileAccountLinks {...menu} />}
				/>
			</TRPCProvider>
		</SessionProvider>
	);
}

function useAccountLabels() {
	const { data: session } = useSession();
	const displayName =
		session?.user?.name || session?.user?.email || 'Volunteer';
	const initial = (
		session?.user?.name?.[0] ||
		session?.user?.email?.[0] ||
		'V'
	).toUpperCase();
	return { displayName, initial };
}

async function handleSignOut() {
	try {
		await signOut({ callbackUrl: '/' });
	} catch {
		toast.error('Sign out failed. Please try again.');
	}
}

function UserAvatar({ initial }: { initial: string }) {
	return (
		<div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
			{initial}
		</div>
	);
}

function DesktopAccountMenu() {
	const { displayName, initial } = useAccountLabels();

	return (
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
						onClick={handleSignOut}
					>
						<LogOut className="mr-2 h-4 w-4" />
						Sign out
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}

function MobileAccountLinks({ open, close }: MobileMenuControls) {
	return (
		<>
			<div className="my-1 border-t border-border/60" />
			{open && <MobileNotificationLink onNavigate={close} />}
			<Link
				href="/app"
				onClick={close}
				className="rounded-md px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
			>
				My Dashboard
			</Link>
			<Link
				href="/app/my-applications"
				onClick={close}
				className="rounded-md px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
			>
				My Applications
			</Link>
			<Link
				href="/app/profile"
				onClick={close}
				className="rounded-md px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
			>
				Edit Profile
			</Link>
			<div className="my-1 border-t border-border/60" />
			<button
				type="button"
				onClick={async () => {
					close();
					await handleSignOut();
				}}
				className="rounded-md px-3 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted"
			>
				Sign out
			</button>
		</>
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
