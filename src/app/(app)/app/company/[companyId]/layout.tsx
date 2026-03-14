import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth';
import { getCompanyMembership } from '@/server/repositories/companyRepo';

type SessionExt = { companyId?: string | null; user?: { id?: string } };

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
	const sessionExt = session as (typeof session & SessionExt) | null;
	const userId = sessionExt?.user?.id;

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
