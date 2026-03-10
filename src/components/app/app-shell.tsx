'use client';

import { ChevronDown, LogOut } from 'lucide-react';
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
	hasOrg: boolean;
}

export function AppShell({ children, hasOrg }: AppShellProps) {
	const { data: session } = useSession();
	const initial = session?.user?.email?.[0]?.toUpperCase() ?? 'U';
	const homeHref = hasOrg ? '/app' : '/app/my-applications';

	return (
		<div className="min-h-screen bg-background text-foreground">
			<header className="sticky top-0 z-40 border-b border-border/60 bg-background/95 backdrop-blur-sm">
				<div className="container mx-auto flex h-14 items-center justify-between px-4">
					<div className="flex items-center gap-4">
						<Link className="flex items-center gap-2.5" href={homeHref}>
							<div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
								V
							</div>
							<span className="text-sm font-semibold tracking-tight text-foreground">
								VolunteerReady
							</span>
						</Link>
						<OrgSwitcher />
					</div>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" className="h-8 gap-2 text-xs">
								<div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
									{initial}
								</div>
								<span className="hidden text-muted-foreground sm:inline">
									{session?.user?.email ?? 'Account'}
								</span>
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
