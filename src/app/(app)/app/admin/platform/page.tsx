import { BookOpen, Building2, CreditCard, FileText, Users } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { authOptions } from '@/server/auth';
import { isPlatformAdmin } from '@/server/domain/platform-admin';

const TILES = [
	{
		href: '/app/admin/platform/orgs',
		title: 'Organizations',
		description: 'Browse every org. Inspect members, opportunities, activity.',
		icon: Building2,
	},
	{
		href: '/app/admin/platform/users',
		title: 'Users',
		description:
			'Search by email or name. Grant/revoke platform admin. Impersonate.',
		icon: Users,
	},
	{
		href: '/app/admin/platform/audit',
		title: 'Audit log',
		description:
			'Filter every actor/action/entity across the platform. Shareable links.',
		icon: FileText,
	},
	{
		href: '/app/admin/platform/catalog',
		title: 'Catalog',
		description:
			'Edit skill families, skills, and default screener question templates.',
		icon: BookOpen,
	},
	{
		href: '/app/admin/platform/billing',
		title: 'Billing',
		description:
			'Orgs with recent payment failures or delinquent subscriptions.',
		icon: CreditCard,
	},
];

export default async function PlatformAdminIndexPage() {
	const session = await getServerSession(authOptions);
	const userId = session?.user?.id;
	if (!userId) redirect('/login?next=/app/admin/platform');

	const isAdmin = await isPlatformAdmin(userId);
	if (!isAdmin) redirect('/app');

	return (
		<div className="mx-auto max-w-5xl space-y-6 p-6">
			<PageHeader
				title="Platform admin"
				description="Diagnose and recover any customer situation from the browser."
			/>
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{TILES.map((tile) => {
					const Icon = tile.icon;
					return (
						<Link key={tile.href} href={tile.href} className="group block">
							<Card className="flex h-full flex-col gap-2 p-5 transition-colors group-hover:bg-muted/50">
								<Icon className="h-5 w-5 text-primary" />
								<h2 className="text-base font-semibold">{tile.title}</h2>
								<p className="text-sm text-muted-foreground">
									{tile.description}
								</p>
							</Card>
						</Link>
					);
				})}
			</div>
		</div>
	);
}
