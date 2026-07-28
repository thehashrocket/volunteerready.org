import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth';
import { IMPERSONATION_COOKIE } from '@/server/domain/impersonation';
import { resolveEffectiveUserId } from '@/server/lib/impersonation-context';
import { acceptCompanyInvite } from '@/server/services/companyService';

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

	const realUserId = session.user.id ?? null;
	const cookieStore = await cookies();
	const cookieValue = cookieStore.get(IMPERSONATION_COOKIE)?.value ?? null;
	const { effectiveUserId: userId, impersonatedBy } =
		await resolveEffectiveUserId(realUserId, cookieValue);

	if (!userId) {
		redirect(`/login?callbackUrl=/invite/company/${token}`);
	}

	const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

	try {
		// `acceptCompanyInvite` resolves the effective user's own address from this
		// id. This page used to look it up here — correctly, unlike the tRPC
		// `company.acceptInvite` procedure — but that made it the one caller doing
		// the right thing by hand, and put a Prisma call in `app/**`.
		await acceptCompanyInvite({ tokenHash, userId, impersonatedBy });
	} catch (err) {
		const message =
			err instanceof Error ? err.message : 'Failed to accept invitation';
		redirect(`/app/browse?error=${encodeURIComponent(message)}`);
	}

	redirect('/app/company');
}
