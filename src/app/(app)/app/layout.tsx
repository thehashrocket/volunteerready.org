import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { AppShell } from '@/components/app/app-shell';
import { FeedbackWidget } from '@/components/app/feedback-widget';
import { ImpersonationBanner } from '@/components/app/impersonation-banner';
import { AuthFeedback } from '@/components/auth-feedback';
import { authOptions } from '@/server/auth';
import { getImpersonationContext } from '@/server/lib/impersonation-context';
import { prisma } from '@/server/repositories/prisma';

// Routes that are exempt from the no-org redirect guard.
// These pages must be reachable by logged-in users who have no org yet.
const NO_ORG_EXEMPT_PREFIXES = [
	'/app/welcome',
	'/app/onboarding',
	'/app/browse',
	'/app/my-applications',
	'/app/my-shifts',
	'/app/my-skills',
	'/app/my-feedback',
	'/app/profile',
	'/app/admin',
];

export default async function AppLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const headersList = await headers();
	const pathname = headersList.get('x-pathname') ?? '';
	const isExempt = NO_ORG_EXEMPT_PREFIXES.some((prefix) =>
		pathname.startsWith(prefix),
	);

	const session = await getServerSession(authOptions);
	const impersonation = await getImpersonationContext();

	// When impersonating, derive hasOrg/hasCompany from the TARGET user so
	// navigation mirrors their view.
	const effectiveUserId = impersonation.isImpersonating
		? impersonation.effectiveUserId
		: (session?.user?.id ?? null);

	const memberCount = effectiveUserId
		? await prisma.organizationMember.count({
				where: { userId: effectiveUserId },
			})
		: 0;
	const hasOrg = memberCount > 0;

	// hasCompany: when impersonating, query the target's memberships.
	let hasCompany = false;
	let companyId: string | null = null;
	if (impersonation.isImpersonating && effectiveUserId) {
		const firstCompany = await prisma.companyMember.findFirst({
			where: { userId: effectiveUserId },
			select: { companyId: true },
			orderBy: { createdAt: 'asc' },
		});
		hasCompany = firstCompany !== null;
		companyId = firstCompany?.companyId ?? null;
	} else {
		const sessionExt = session as
			| (typeof session & { companyId?: string | null })
			| null;
		hasCompany = !!sessionExt?.companyId;
		companyId = sessionExt?.companyId ?? null;
	}

	// /app itself is exempt — the volunteer dashboard renders for non-org users
	if (!isExempt && pathname !== '/app' && !hasOrg) {
		redirect('/app/welcome');
	}

	return (
		<>
			{impersonation.isImpersonating && impersonation.expiresAt ? (
				<ImpersonationBanner
					targetEmail={impersonation.targetUser?.email ?? null}
					targetName={impersonation.targetUser?.name ?? null}
					expiresAt={impersonation.expiresAt.toISOString()}
				/>
			) : null}
			<AppShell hasOrg={hasOrg} hasCompany={hasCompany} companyId={companyId}>
				<AuthFeedback />
				{children}
				<FeedbackWidget />
			</AppShell>
		</>
	);
}
