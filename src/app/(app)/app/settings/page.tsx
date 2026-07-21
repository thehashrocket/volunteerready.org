import { ChevronRight, ClipboardList, ShieldCheck, Users } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { OrgProfileForm } from '@/components/app/org-profile-form';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { Role } from '@/prisma/generated/client';
import { authOptions } from '@/server/auth';
import { getImpersonationContext } from '@/server/lib/impersonation-context';
import {
	getFirstOrgForUser,
	getOrgProfile,
} from '@/server/repositories/orgRepo';

export const metadata: Metadata = {
	title: 'Organization settings',
};

const SETTINGS_LINKS = [
	{
		href: '/app/settings/team',
		icon: Users,
		title: 'Team',
		description: 'Members, roles, timezone',
	},
	{
		href: '/app/settings/onboarding',
		icon: ClipboardList,
		title: 'Onboarding',
		description: 'Baseline metrics',
	},
	{
		href: '/app/settings/background-checks',
		icon: ShieldCheck,
		title: 'Background checks',
		description: 'Checkr/Sterling provider credentials',
	},
];

type SessionExt = { orgId?: string | null; role?: Role | null };

export default async function OrganizationSettingsPage() {
	const session = await getServerSession(authOptions);
	const ext = session as (typeof session & SessionExt) | null;

	// The session ext carries the REAL user's org/role — during platform-admin
	// impersonation the tRPC mutation resolves the TARGET user's org, so this
	// page must do the same or the form would render the admin's own org while
	// saves hit the target's (see trpc/init.ts impersonation resolution).
	const impersonation = await getImpersonationContext();

	// Fail closed: a cookie was present but resolution errored. Never fall
	// back to the admin's own session org here — this page is read-then-write
	// (the form renders org data, then a separate mutation saves it), so
	// rendering the wrong org's data could seed a save that overwrites a
	// DIFFERENT org than what's shown once resolution recovers.
	if (impersonation.resolutionFailed) {
		redirect('/app');
	}

	let orgId: string | null;
	let role: Role | null;
	if (impersonation.isImpersonating && impersonation.effectiveUserId) {
		const membership = await getFirstOrgForUser(impersonation.effectiveUserId);
		orgId = membership?.organizationId ?? null;
		role = membership?.role ?? null;
	} else {
		orgId = ext?.orgId ?? null;
		role = ext?.role ?? null;
	}

	// Volunteers / no-org users have no organization to configure. The app
	// layout usually bounces them to /app/welcome first; this covers the rest.
	if (!orgId) {
		redirect('/app');
	}

	const org = await getOrgProfile(orgId);
	if (!org) {
		redirect('/app');
	}

	const canEdit = role === 'OWNER' || role === 'ADMIN';

	return (
		<div className="space-y-6">
			<PageHeader
				title="Organization settings"
				description="Manage your public apply link, team access, and onboarding defaults."
			/>

			<Card>
				<CardHeader>
					<h2 className="text-base font-semibold">Organization profile</h2>
					<p className="text-sm text-muted-foreground">
						Your organization’s public name and apply link.
					</p>
				</CardHeader>
				<CardContent>
					{/* key: remount on org switch — otherwise the client form keeps
					    org A's state while saves write to org B (Codex P1) */}
					<OrgProfileForm
						key={org.id}
						initialName={org.name}
						initialSlug={org.slug}
						canEdit={canEdit}
					/>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<h2 className="text-base font-semibold">Access &amp; setup</h2>
					<p className="text-sm text-muted-foreground">
						Configure additional aspects of your organization.
					</p>
				</CardHeader>
				<CardContent className="p-0">
					<ul className="divide-y">
						{SETTINGS_LINKS.map(({ href, icon: Icon, title, description }) => (
							<li key={href}>
								<Link
									href={href}
									className="flex min-h-[44px] items-center gap-3 px-4 py-3 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-6"
								>
									<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
										<Icon className="h-4 w-4 text-muted-foreground" />
									</span>
									<span className="min-w-0">
										<span className="block text-sm font-medium">{title}</span>
										<span className="block truncate text-sm text-muted-foreground">
											{description}
										</span>
									</span>
									<ChevronRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
								</Link>
							</li>
						))}
					</ul>
				</CardContent>
			</Card>
		</div>
	);
}
