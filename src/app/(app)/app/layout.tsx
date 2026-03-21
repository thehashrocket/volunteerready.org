import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { AppShell } from '@/components/app/app-shell';
import { AuthFeedback } from '@/components/auth-feedback';
import { authOptions } from '@/server/auth';
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
	'/app/profile',
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
	const userId = session?.user?.id;

	const memberCount = userId
		? await prisma.organizationMember.count({ where: { userId } })
		: 0;
	const hasOrg = memberCount > 0;

	// hasCompany derived from session — no extra DB query
	const sessionExt = session as
		| (typeof session & { companyId?: string | null })
		| null;
	const hasCompany = !!sessionExt?.companyId;

	// /app itself is exempt — the volunteer dashboard renders for non-org users
	if (!isExempt && pathname !== '/app' && !hasOrg) {
		redirect('/app/welcome');
	}

	return (
		<AppShell
			hasOrg={hasOrg}
			hasCompany={hasCompany}
			companyId={sessionExt?.companyId ?? null}
		>
			<AuthFeedback />
			{children}
		</AppShell>
	);
}
