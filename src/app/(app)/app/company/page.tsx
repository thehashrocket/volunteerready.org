import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { LinkRowList } from '@/components/link-row-list';
import { PageHeader } from '@/components/page-header';
import { authOptions } from '@/server/auth';
import { IMPERSONATION_COOKIE } from '@/server/domain/impersonation';
import { resolveEffectiveUserId } from '@/server/lib/impersonation-context';
import { listCompaniesForUser } from '@/server/repositories/companyRepo';

type SessionExt = { companyId?: string | null };

const COMPANY_ROLE_LABELS: Record<string, string> = {
	OWNER: 'Owner',
	ADMIN: 'Admin',
	MEMBER: 'Member',
};

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

	if (isImpersonating && effectiveUserId) {
		// No session token for the target user under impersonation — resolve
		// their company memberships directly, same as app/layout.tsx.
		const memberships = await listCompaniesForUser(effectiveUserId);

		if (memberships.length === 0) {
			redirect('/app/browse');
		}

		if (memberships.length === 1) {
			redirect(`/app/company/${memberships[0].company.id}`);
		}

		// 2+ companies: there's no session token for the impersonated target to
		// persist a "current company" choice into, so surface an explicit
		// picker instead of guessing one — mirrors the explicit-URL pattern
		// ESG exports already use instead of trusting session state.
		return (
			<div className="space-y-6">
				<PageHeader
					title="Select a company"
					description="This volunteer belongs to multiple companies. Choose one to view."
				/>
				<LinkRowList
					items={memberships.map((membership) => ({
						href: `/app/company/${membership.company.id}`,
						heading: membership.company.name,
						description:
							COMPANY_ROLE_LABELS[membership.role] ?? membership.role,
					}))}
				/>
			</div>
		);
	}

	const sessionExt = session as (typeof session & SessionExt) | null;
	const companyId = sessionExt?.companyId ?? null;

	if (!companyId) {
		redirect('/app/browse');
	}

	redirect(`/app/company/${companyId}`);
}
