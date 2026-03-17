'use client';

import { ChevronDown, LogOut, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { type ReactNode, useEffect, useState } from 'react';
import { AppSidebar } from '@/components/app/app-sidebar';
import { CompanySwitcher } from '@/components/company/CompanySwitcher';
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
	hasCompany: boolean;
	companyId?: string | null;
}

export function AppShell({
	children,
	hasOrg,
	hasCompany,
	companyId,
}: AppShellProps) {
	const { data: session } = useSession();
	const initial = session?.user?.email?.[0]?.toUpperCase() ?? 'U';
	const homeHref = hasOrg ? '/app' : '/app/browse';
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);

	return (
		<div className="min-h-screen bg-background text-foreground">
			<header className="sticky top-0 z-40 border-b border-border/60 bg-background/95 backdrop-blur-sm">
				<div className="flex h-14 items-center justify-between px-4">
					<div className="flex items-center gap-3">
						{/* Mobile sidebar toggle */}
						<Button
							variant="ghost"
							size="sm"
							className="lg:hidden"
							onClick={() => setSidebarOpen(!sidebarOpen)}
							aria-label="Toggle navigation"
						>
							{sidebarOpen ? (
								<X className="h-5 w-5" />
							) : (
								<Menu className="h-5 w-5" />
							)}
						</Button>

						<Link className="flex items-center gap-2.5" href={homeHref}>
							<div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
								V
							</div>
							<span className="text-sm font-semibold tracking-tight text-foreground">
								VolunteerReady
							</span>
						</Link>
						<OrgSwitcher />
						<CompanySwitcher />
					</div>
					{mounted ? (
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
					) : (
						<Button variant="ghost" className="h-8 gap-2 text-xs">
							<div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
								{initial}
							</div>
							<ChevronDown className="h-4 w-4 text-muted-foreground" />
						</Button>
					)}
				</div>
			</header>

			<div className="flex">
				{/* Desktop sidebar */}
				<aside className="hidden w-56 shrink-0 border-r border-border/60 lg:block">
					<div className="sticky top-14 max-h-[calc(100vh-3.5rem)] overflow-y-auto p-4">
						<AppSidebar
							hasOrg={hasOrg}
							hasCompany={hasCompany}
							companyId={companyId}
						/>
					</div>
				</aside>

				{/* Mobile sidebar overlay */}
				{sidebarOpen && (
					<>
						<button
							type="button"
							aria-label="Close sidebar"
							className="fixed inset-0 top-14 z-30 bg-black/40 lg:hidden"
							onClick={() => setSidebarOpen(false)}
						/>
						<aside className="fixed left-0 top-14 z-30 h-[calc(100vh-3.5rem)] w-56 overflow-y-auto border-r border-border/60 bg-background p-4 lg:hidden">
							<AppSidebar
								hasOrg={hasOrg}
								hasCompany={hasCompany}
								companyId={companyId}
							/>
						</aside>
					</>
				)}

				{/* Main content */}
				<main className="min-w-0 flex-1 px-4 py-8 sm:px-6 lg:px-8">
					{children}
				</main>
			</div>
		</div>
	);
}
