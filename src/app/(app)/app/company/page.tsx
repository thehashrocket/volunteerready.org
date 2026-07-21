import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth';
import { IMPERSONATION_COOKIE } from '@/server/domain/impersonation';
import { resolveEffectiveUserId } from '@/server/lib/impersonation-context';
import { prisma } from '@/server/repositories/prisma';

type SessionExt = { companyId?: string | null };

/** Resolves current company from session and redirects to the dynamic route. */
export default async function CompanyIndexPage() {
	const session = await getServerSession(authOptions);
	const realUserId = session?.user?.id ?? null;
	const cookieStore = await cookies();
	const cookieValue = cookieStore.get(IMPERSONATION_COOKIE)?.value ?? null;
	const { effectiveUserId, isImpersonating, resolutionFailed } =
		await resolveEffectiveUserId(realUserId, cookieValue);

	// Fail closed: a cookie was present but resolution errored. Do NOT fall
	// back to the real admin's own session.companyId here — that would land
	// them on their own company while they believe they're still
	// impersonating the target.
	if (resolutionFailed) {
		redirect('/app/browse');
	}

	let companyId: string | null;
	if (isImpersonating && effectiveUserId) {
		// No session token for the target user under impersonation — resolve
		// their first company membership directly, same as app/layout.tsx.
		const firstCompany = await prisma.companyMember.findFirst({
			where: { userId: effectiveUserId },
			select: { companyId: true },
			orderBy: { createdAt: 'asc' },
		});
		companyId = firstCompany?.companyId ?? null;
	} else {
		const sessionExt = session as (typeof session & SessionExt) | null;
		companyId = sessionExt?.companyId ?? null;
	}

	if (!companyId) {
		redirect('/app/browse');
	}

	redirect(`/app/company/${companyId}`);
}
