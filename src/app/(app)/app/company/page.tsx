import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth';

type SessionExt = { companyId?: string | null };

/** Resolves current company from session and redirects to the dynamic route. */
export default async function CompanyIndexPage() {
	const session = await getServerSession(authOptions);
	const sessionExt = session as (typeof session & SessionExt) | null;
	const companyId = sessionExt?.companyId;

	if (!companyId) {
		redirect('/app/browse');
	}

	redirect(`/app/company/${companyId}`);
}
