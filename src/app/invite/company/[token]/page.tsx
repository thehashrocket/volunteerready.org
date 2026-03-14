import crypto from 'node:crypto';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth';
import { acceptCompanyInvite } from '@/server/services/companyService';

type SessionExt = { user?: { id?: string; email?: string | null } };

export default async function AcceptCompanyInvitePage({
	params,
}: {
	params: Promise<{ token: string }>;
}) {
	const { token } = await params;
	const session = await getServerSession(authOptions);

	if (!session?.user) {
		redirect(`/login?callbackUrl=/invite/company/${token}`);
	}

	const sessionExt = session as typeof session & SessionExt;
	const userId = sessionExt?.user?.id;
	const userEmail = sessionExt?.user?.email ?? '';

	if (!userId) {
		redirect(`/login?callbackUrl=/invite/company/${token}`);
	}

	const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

	try {
		await acceptCompanyInvite({ tokenHash, userId, userEmail });
	} catch (err) {
		const message =
			err instanceof Error ? err.message : 'Failed to accept invitation';
		redirect(`/app/browse?error=${encodeURIComponent(message)}`);
	}

	redirect('/app/company');
}
