'use client';

import {
	BarChart3,
	Briefcase,
	Building2,
	Calendar,
	ClipboardList,
	CreditCard,
	FileText,
	LayoutDashboard,
	QrCode,
	Search,
	Settings,
	Shield,
	Star,
	TrendingUp,
	User,
	UserSearch,
	Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';

interface NavItem {
	label: string;
	href: string;
	icon: React.ElementType;
}

const VOLUNTEER_NAV: NavItem[] = [
	{ label: 'Browse opportunities', href: '/app/browse', icon: Search },
	{ label: 'My applications', href: '/app/my-applications', icon: FileText },
	{ label: 'My shifts', href: '/app/my-shifts', icon: Calendar },
	{ label: 'My skills', href: '/app/my-skills', icon: Star },
	{ label: 'Profile', href: '/app/profile', icon: User },
];

const STAFF_NAV: NavItem[] = [
	{ label: 'Dashboard', href: '/app', icon: LayoutDashboard },
	{ label: 'Opportunities', href: '/app/opportunities', icon: Briefcase },
	{ label: 'Applications', href: '/app/applications', icon: FileText },
	{ label: 'Screener', href: '/app/screener', icon: ClipboardList },
	{ label: 'Shifts', href: '/app/shifts', icon: Calendar },
	{ label: 'Scan', href: '/app/scan', icon: QrCode },
	{ label: 'Discover', href: '/app/discover', icon: UserSearch },
	{ label: 'Analytics', href: '/app/analytics', icon: TrendingUp },
	{ label: 'Team', href: '/app/settings/team', icon: Users },
	{ label: 'Settings', href: '/app/settings', icon: Settings },
	{ label: 'Billing', href: '/app/billing', icon: CreditCard },
];

function getCompanyNav(companyId: string | null | undefined): NavItem[] {
	if (!companyId)
		return [{ label: 'Company', href: '/app/company', icon: Building2 }];
	return [
		{ label: 'Company', href: `/app/company/${companyId}`, icon: Building2 },
		{
			label: 'ESG Report',
			href: `/app/company/${companyId}/esg`,
			icon: BarChart3,
		},
	];
}

/**
 * Resolve which nav item is active for the current pathname.
 *
 * Matching rules:
 * - Segment-boundary match: an item matches when the pathname equals its href
 *   or continues it past a "/" (so "/app/opportunities2" does NOT match
 *   "/app/opportunities").
 * - Longest match wins: when several items match (e.g. "/app/company/{id}"
 *   and "/app/company/{id}/esg"), only the most specific one is active.
 * - "/app" (Dashboard) matches exactly only — otherwise it would light up as
 *   a fallback on every unlisted /app/* page.
 */
export function getActiveHref(
	items: NavItem[],
	pathname: string,
): string | undefined {
	let best: string | undefined;
	for (const { href } of items) {
		const matches =
			href === '/app'
				? pathname === '/app'
				: pathname === href || pathname.startsWith(`${href}/`);
		if (matches && (best === undefined || href.length > best.length)) {
			best = href;
		}
	}
	return best;
}

function NavLink({ item, isActive }: { item: NavItem; isActive: boolean }) {
	const Icon = item.icon;

	return (
		<Link
			href={item.href}
			className={cn(
				'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
				isActive
					? 'bg-primary/10 text-primary border-l-2 border-primary'
					: 'text-muted-foreground hover:bg-muted hover:text-foreground',
			)}
		>
			<Icon className="h-4 w-4 shrink-0" />
			{item.label}
		</Link>
	);
}

interface AppSidebarProps {
	hasOrg: boolean;
	hasCompany: boolean;
	companyId?: string | null;
}

const PLATFORM_ADMIN_NAV: NavItem[] = [
	{
		label: 'Organizations',
		href: '/app/admin/platform/orgs',
		icon: Building2,
	},
	{ label: 'Users', href: '/app/admin/platform/users', icon: Users },
	{ label: 'Audit log', href: '/app/admin/platform/audit', icon: FileText },
];

export function AppSidebar({ hasOrg, hasCompany, companyId }: AppSidebarProps) {
	const pathname = usePathname();
	const { data: session } = useSession();
	const isPlatformAdmin =
		(session?.user as { isPlatformAdmin?: boolean } | undefined)
			?.isPlatformAdmin === true;

	// Company pages are authorized by the URL's companyId (see
	// company/[companyId]/layout.tsx), not the session's active company. A
	// multi-company user browsing a non-active company would otherwise get
	// nav hrefs pointing at a different company than the page they're on.
	// /app/company/new is a static sibling route (the create-company form),
	// not a companyId — exclude it so nav links don't point at "company new".
	const urlCompanyIdMatch = pathname.match(/^\/app\/company\/([^/]+)/)?.[1];
	const urlCompanyId =
		urlCompanyIdMatch && urlCompanyIdMatch !== 'new' ? urlCompanyIdMatch : null;
	const companyNav = getCompanyNav(urlCompanyId ?? companyId);

	const visibleItems = [
		...(!hasOrg ? VOLUNTEER_NAV : []),
		...(hasOrg ? STAFF_NAV : []),
		...(hasCompany ? companyNav : []),
		...(isPlatformAdmin ? PLATFORM_ADMIN_NAV : []),
	];
	const activeHref = getActiveHref(visibleItems, pathname);

	return (
		<nav className="flex flex-col gap-1">
			{/* Volunteer section only shows when user is not an org member */}
			{!hasOrg && (
				<>
					<p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
						Volunteer
					</p>
					{VOLUNTEER_NAV.map((item) => (
						<NavLink
							key={item.href}
							item={item}
							isActive={item.href === activeHref}
						/>
					))}
				</>
			)}

			{/* Staff section only shows when user belongs to an org */}
			{hasOrg && (
				<>
					<p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
						Organization
					</p>
					{STAFF_NAV.map((item) => (
						<NavLink
							key={item.href}
							item={item}
							isActive={item.href === activeHref}
						/>
					))}
				</>
			)}

			{/* Company section only shows when user belongs to a company */}
			{hasCompany && (
				<>
					<div className="my-3 border-t" />
					<p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
						Company
					</p>
					{companyNav.map((item) => (
						<NavLink
							key={item.href}
							item={item}
							isActive={item.href === activeHref}
						/>
					))}
				</>
			)}

			{isPlatformAdmin && (
				<>
					<div className="my-3 border-t" />
					<p className="mb-1 flex items-center gap-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
						<Shield className="h-3 w-3" />
						Platform admin
					</p>
					{PLATFORM_ADMIN_NAV.map((item) => (
						<NavLink
							key={item.href}
							item={item}
							isActive={item.href === activeHref}
						/>
					))}
				</>
			)}
		</nav>
	);
}
