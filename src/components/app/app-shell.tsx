'use client';

import { ChevronDown, LogOut, User } from 'lucide-react';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import type { ReactNode } from 'react';
import { OrgSwitcher } from '@/components/org/OrgSwitcher';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface AppShellProps {
	children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
	const { data: session } = useSession();

	return (
		<div className="min-h-screen bg-background text-foreground">
			<header className="border-b">
				<div className="container mx-auto flex h-14 items-center justify-between px-4">
					<div className="flex items-center gap-4">
						<Link className="text-sm font-semibold" href="/app">
							VolunteerMatch
						</Link>
						<OrgSwitcher />
					</div>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" className="h-8 gap-2 text-xs">
								<User className="h-4 w-4" />
								<span>{session?.user?.email ?? 'Account'}</span>
								<ChevronDown className="h-4 w-4 text-muted-foreground" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-48">
							<DropdownMenuLabel>Signed in</DropdownMenuLabel>
							<DropdownMenuItem disabled>
								{session?.user?.email ?? 'No email'}
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem onClick={() => signOut()}>
								<LogOut className="mr-2 h-4 w-4" />
								Sign out
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</header>
			<main className="container mx-auto px-4 py-8">{children}</main>
		</div>
	);
}
