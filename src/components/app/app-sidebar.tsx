'use client';

import {
	Briefcase,
	Calendar,
	ClipboardList,
	FileText,
	LayoutDashboard,
	Search,
	Settings,
	Star,
	User,
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
	{ label: 'Team', href: '/app/settings/team', icon: Users },
	{ label: 'Settings', href: '/app/credentials', icon: Settings },
];

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
	// Exact match for dashboard (/app), prefix match for everything else
	const isActive =
		item.href === '/app'
			? pathname === '/app'
			: pathname.startsWith(item.href);

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
}

export function AppSidebar({ hasOrg }: AppSidebarProps) {
	const pathname = usePathname();

	return (
		<nav className="flex flex-col gap-1">
			{/* Volunteers always see the volunteer section */}
			<p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
				Volunteer
			</p>
			{VOLUNTEER_NAV.map((item) => (
				<NavLink key={item.href} item={item} pathname={pathname} />
			))}

			{/* Staff section only shows when user belongs to an org */}
			{hasOrg && (
				<>
					<div className="my-3 border-t" />
					<p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
						Organization
					</p>
					{STAFF_NAV.map((item) => (
						<NavLink key={item.href} item={item} pathname={pathname} />
					))}
				</>
			)}
		</nav>
	);
}
