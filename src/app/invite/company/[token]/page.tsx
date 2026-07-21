import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth';
import { IMPERSONATION_COOKIE } from '@/server/domain/impersonation';
import { resolveEffectiveUserId } from '@/server/lib/impersonation-context';
import { prisma } from '@/server/repositories/prisma';
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

	// Look up the effective user's own email — under impersonation this must
	// be the target's email, not the real admin's, since the invite check is
	// keyed on the invited email address.
	const effectiveUser = await prisma.user.findUnique({
		where: { id: userId },
		select: { email: true },
	});
	const userEmail = effectiveUser?.email ?? '';

	const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

	try {
		await acceptCompanyInvite({ tokenHash, userId, userEmail, impersonatedBy });
	} catch (err) {
		const message =
			err instanceof Error ? err.message : 'Failed to accept invitation';
		redirect(`/app/browse?error=${encodeURIComponent(message)}`);
	}

	redirect('/app/company');
}
