import crypto from 'node:crypto';
import { TRPCError } from '@trpc/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth';
import { isClientSafeErrorCode } from '@/server/domain/error-disclosure';
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
		// This message goes into the ADDRESS BAR, so it outlives the render and
		// lands in history and in the referrer of whatever the user clicks next —
		// `err instanceof Error` was letting an unhandled Prisma throw straight
		// into it. `acceptCompanyInvite` throws TRPCError, so the same allowlist
		// the wire uses applies here; anything else is logged and generalised.
		const code = err instanceof TRPCError ? err.code : undefined;
		if (!isClientSafeErrorCode(code)) {
			console.error('[invite/company] unexpected error', err);
		}
		const message = isClientSafeErrorCode(code)
			? (err as TRPCError).message
			: 'Failed to accept invitation';
		redirect(`/app/browse?error=${encodeURIComponent(message)}`);
	}

	redirect('/app/company');
}
