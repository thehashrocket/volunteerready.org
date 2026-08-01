'use client';

import { ChevronDown, LogOut, Menu, MessageSquare, X } from 'lucide-react';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { type ReactNode, useEffect, useState } from 'react';
import { AppSidebar } from '@/components/app/app-sidebar';
import { NotificationBell } from '@/components/app/notification-bell';
import { CompanySwitcher } from '@/components/company/CompanySwitcher';
import { OrgSwitcher } from '@/components/org/OrgSwitcher';
import { ThemeToggle } from '@/components/theme-toggle';
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
	/** Resolved server-side so the nav item never flashes in then disappears. */
	hasVolunteerRoster?: boolean;
}

export function AppShell({
	children,
	hasOrg,
	hasCompany,
	companyId,
	hasVolunteerRoster = false,
}: AppShellProps) {
	const { data: session } = useSession();
	const initial = session?.user?.email?.[0]?.toUpperCase() ?? 'U';
	const homeHref = hasOrg ? '/app' : '/app/browse';
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);

	return (
		<div
			className="min-h-screen bg-background text-foreground"
			data-theme-transition
		>
			<header
				className="sticky top-0 z-40 border-b border-border/60 bg-background/95 backdrop-blur-sm"
				data-theme-transition
			>
				{/* `min-w-0` on the left cluster is what stops this row overflowing the
				    viewport. A flex item's default `min-width: auto` resolves to its
				    content's intrinsic width, so without it the cluster refuses to
				    shrink and `justify-between` pushes the right cluster (theme,
				    bell, account) straight off the right edge — ~22px at 375px, and
				    ~126px in the 768-1023px band, where the wordmark and BOTH
				    switchers render alongside a toggle that is still `lg:hidden`.
				    The switchers already truncate themselves correctly; nothing they
				    do helps while their parent cannot shrink. */}
				<div className="flex h-14 items-center justify-between gap-2 px-4">
					<div className="flex min-w-0 items-center gap-2 sm:gap-3">
						{/* Mobile sidebar toggle */}
						<Button
							variant="ghost"
							size="icon"
							className="h-11 w-11 shrink-0 lg:hidden"
							onClick={() => setSidebarOpen(!sidebarOpen)}
							aria-label="Toggle navigation"
						>
							{sidebarOpen ? (
								<X className="h-5 w-5" />
							) : (
								<Menu className="h-5 w-5" />
							)}
						</Button>

						<Link
							className="flex shrink-0 items-center gap-2.5"
							href={homeHref}
						>
							<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
								V
							</div>
							{/* Hidden below `sm` rather than truncated: this is the widest
							    node in the cluster that cannot shrink (no `truncate`, so
							    its min-content width is the whole 14-character word), and
							    "Volunt…" is a worse answer than the mark alone, which
							    already identifies the app. */}
							<span className="hidden text-sm font-semibold tracking-tight text-foreground sm:inline">
								VolunteerReady
							</span>
						</Link>
						<OrgSwitcher />
						<CompanySwitcher />
					</div>
					{/* `shrink-0` declares the intent — these are the row's actions and
					    the left cluster is the side that gives. It is currently
					    DEFENSIVE rather than load-bearing: measured at 375/800/1280 the
					    account control is the same width with or without it, because
					    `min-w-0` plus truncation on the left absorbs all the pressure
					    before this cluster feels any. Kept because it is free and
					    becomes real the moment anything unshrinkable lands here; NOT
					    pinned by a test, since one would assert nothing today. */}
					<div className="flex shrink-0 items-center gap-1">
						<ThemeToggle />
						<NotificationBell />
						{mounted ? (
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant="ghost" className="h-8 gap-2 text-xs">
										<div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
											{initial}
										</div>
										{/* Capped because the right cluster is `shrink-0`: an
										    uncapped address (a seeded
										    `orgadmin@volunteermatch.local` is ~200px) is taken
										    out of the row before the org name gets any, so the
										    switchers end up squeezed to bare ellipses in the
										    tablet band. The dropdown below still shows it in
										    full. */}
										<span className="hidden max-w-40 truncate text-muted-foreground sm:inline">
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
									<DropdownMenuItem asChild>
										<Link href="/app/my-feedback">
											<MessageSquare className="mr-2 h-4 w-4" />
											My feedback
										</Link>
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
							hasVolunteerRoster={hasVolunteerRoster}
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
								hasVolunteerRoster={hasVolunteerRoster}
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
