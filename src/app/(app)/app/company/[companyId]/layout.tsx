import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth';
import { IMPERSONATION_COOKIE } from '@/server/domain/impersonation';
import { resolveEffectiveUserId } from '@/server/lib/impersonation-context';
import { getCompanyMembership } from '@/server/repositories/companyRepo';

/** Guard: only allow access if user is a member of this company. */
export default async function CompanyLayout({
	children,
	params,
}: {
	children: React.ReactNode;
	params: Promise<{ companyId: string }>;
}) {
	const { companyId } = await params;
	const session = await getServerSession(authOptions);
	const realUserId = session?.user?.id ?? null;
	const cookieStore = await cookies();
	const cookieValue = cookieStore.get(IMPERSONATION_COOKIE)?.value ?? null;
	const { effectiveUserId: userId } = await resolveEffectiveUserId(
		realUserId,
		cookieValue,
	);

	if (!userId) {
		redirect('/login');
	}

	const membership = await getCompanyMembership(userId, companyId);
	if (!membership) {
		// Not a member of this company — redirect to the session's active company
		redirect('/app/company');
	}

	return <>{children}</>;
}
