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
	Star,
	TrendingUp,
	User,
	UserSearch,
	Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
	{ label: 'Settings', href: '/app/credentials', icon: Settings },
	{ label: 'Billing', href: '/app/billing', icon: CreditCard },
];

function getCompanyNav(companyId: string | null | undefined): NavItem[] {
	if (!companyId)
		return [{ label: 'Company', href: '/app/company', icon: Building2 }];
	return [
		{ label: 'Company', href: `/app/company/${companyId}`, icon: Building2 },
		{
			label: 'ESG Report',
			href: `/app/company/${companyId}/team`,
			icon: BarChart3,
		},
	];
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
	// Exact match for dashboard (/app), prefix match for everything else
	const isActive =
		item.href === '/app' ? pathname === '/app' : pathname.startsWith(item.href);

	const Icon = item.icon;

	return (
		<Link
			href={item.href}
			className={cn(
				'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
				isActive
					? 'bg-primary/10 text-primary'
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

export function AppSidebar({ hasOrg, hasCompany, companyId }: AppSidebarProps) {
	const pathname = usePathname();

	return (
		<nav className="flex flex-col gap-1">
			{/* Volunteer section only shows when user is not an org member */}
			{!hasOrg && (
				<>
					<p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
						Volunteer
					</p>
					{VOLUNTEER_NAV.map((item) => (
						<NavLink key={item.href} item={item} pathname={pathname} />
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
						<NavLink key={item.href} item={item} pathname={pathname} />
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
					{getCompanyNav(companyId).map((item) => (
						<NavLink key={item.href} item={item} pathname={pathname} />
					))}
				</>
			)}
		</nav>
	);
}
