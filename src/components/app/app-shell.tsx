'use client';

import {
	ChevronDown,
	LogOut,
	Menu,
	MessageSquare,
	RefreshCw,
	X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { type ReactNode, useEffect, useState } from 'react';
import { AppSidebar } from '@/components/app/app-sidebar';
import { AppUpdatePrompt } from '@/components/app/app-update-prompt';
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
import { useAppUpdateCheck } from '@/lib/hooks/use-app-update-check';
import { useModalOpen } from '@/lib/hooks/use-modal-open';

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

	/**
	 * Called ONCE here, with the result passed to both consumers as props.
	 *
	 * Two hook instances would mean two `visibilitychange` listeners, two
	 * five-minute floors drifting apart, two failure counters with independent
	 * report thresholds and two `/api/version` fetches per focus — silently
	 * doubling the floor the whole design rests on. A context was rejected as
	 * premature: both consumers are children of this component.
	 */
	const update = useAppUpdateCheck();
	const isModalOpen = useModalOpen();
	const pathname = usePathname();

	/**
	 * Staff only, using props this component already receives.
	 *
	 * A volunteer opening the app on a phone to check Saturday's start time has
	 * no idea what a version is and is gone in twenty seconds — same
	 * interruption cost, near-zero value. `hasOrg` is an `OrganizationMember`
	 * row, which is exactly "is org staff", and it is already derived from the
	 * TARGET user under impersonation, so this gate inherits that for free.
	 *
	 * This gates the account-menu item as well as the strip. Those two started
	 * out disagreeing — the strip staff-gated, the menu item ungated — which,
	 * because `severity` defaults to `silent`, meant version information was
	 * shown to exactly the population it was designed to exclude and to nobody
	 * else. Keep them on one condition.
	 */
	const isStaff = hasOrg || hasCompany;

	/**
	 * `/app/scan` is the QR check-in scanner, used by volunteers on phones at a
	 * live event. `public/sw.js` already singles that route out as never-stale
	 * for the same reason. Detection keeps running; only the render is
	 * suppressed, so the strip appears on the next route.
	 */
	const isAllowedHere = isStaff && !pathname?.startsWith('/app/scan');

	const showUpdateAffordance = isStaff && update.isUpdateAvailable;

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
									{/* Permanent while an update is pending, so dismissing the
									    strip means "stop interrupting me" rather than "forget
									    this happened" — dismiss at 9am, hit a bug at 4pm, and
									    without this no surface anywhere says a newer build
									    exists. It is also the ONLY surface a `silent` release
									    renders, which is most of them. */}
									{showUpdateAffordance && (
										<>
											<DropdownMenuItem
												onClick={() => window.location.reload()}
											>
												<RefreshCw className="mr-2 h-4 w-4" />
												<span className="flex-1">Update available</span>
												{/* Mono because a four-part version is an ID, and
												    muted because it is reference material for a
												    support conversation, not something to read
												    mid-task. */}
												{update.deployedVersion && (
													<span className="ml-2 font-mono text-xs text-muted-foreground">
														{update.deployedVersion}
													</span>
												)}
											</DropdownMenuItem>
											<DropdownMenuSeparator />
										</>
									)}
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

			{/* Order: ImpersonationBanner -> sticky header -> update strip -> main.
			    The impersonation banner is a live security-state warning and must
			    never sit below a software-update notice; its `bg-warning/15` is
			    deliberately distinct from this strip's `bg-accent/10` so two
			    stacked bands do not read as one confused alert block.

			    In flow rather than sticky: a band that follows you down the page
			    is closer to a modal than a notice, and scrolling past it loses
			    nothing because the account menu keeps the affordance. */}
			<AppUpdatePrompt
				update={update}
				isModalOpen={isModalOpen}
				isAllowedHere={isAllowedHere}
			/>

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
