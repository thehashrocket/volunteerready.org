import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth';
import { prisma } from '@/server/repositories/prisma';
import { AppShell } from '@/components/app/app-shell';
import { AuthFeedback } from '@/components/auth-feedback';

// Routes that are exempt from the no-org redirect guard.
// These pages must be reachable by logged-in users who have no org yet.
const NO_ORG_EXEMPT_PREFIXES = ['/app/welcome', '/app/onboarding'];

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

	if (!isExempt) {
		const session = await getServerSession(authOptions);
		const userId = session?.user?.id;

		if (userId) {
			const memberCount = await prisma.organizationMember.count({
				where: { userId },
			});

			if (memberCount === 0) {
				redirect('/app/welcome');
			}
		}
	}

	return (
		<AppShell>
			<AuthFeedback />
			{children}
		</AppShell>
	);
}
