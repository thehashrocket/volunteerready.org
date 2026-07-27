import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { AppShell } from '@/components/app/app-shell';
import { FeedbackWidget } from '@/components/app/feedback-widget';
import { ImpersonationBanner } from '@/components/app/impersonation-banner';
import { AuthFeedback } from '@/components/auth-feedback';
import { authOptions } from '@/server/auth';
import { resolveActiveOrgId } from '@/server/domain/active-org';
import { STAFF_CREATED_VOLUNTEERS_FLAG } from '@/server/domain/feature-flags';
import { getImpersonationContext } from '@/server/lib/impersonation-context';
import { listCompaniesForUser } from '@/server/repositories/companyRepo';
import { listMembershipOrgIds } from '@/server/repositories/membershipRepo';
import { isFeatureEnabled } from '@/server/services/featureFlagService';

// Routes that are exempt from the no-org redirect guard.
// These pages must be reachable by logged-in users who have no org yet.
const NO_ORG_EXEMPT_PREFIXES = [
	'/app/welcome',
	'/app/onboarding',
	'/app/browse',
	'/app/my-applications',
	'/app/my-shifts',
	'/app/my-skills',
	'/app/my-feedback',
	'/app/profile',
	'/app/admin',
	// Company admins are often not nonprofit-org members; company pages have
	// their own membership guard in company/[companyId]/layout.tsx.
	'/app/company',
];

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

	const session = await getServerSession(authOptions);
	const impersonation = await getImpersonationContext();

	// When impersonating, derive hasOrg/hasCompany from the TARGET user so
	// navigation mirrors their view.
	const effectiveUserId = impersonation.isImpersonating
		? impersonation.effectiveUserId
		: (session?.user?.id ?? null);

	// Was a bare count(). It now returns the ids too, because the feature-flag
	// gate below needs an actual orgId and this layout never had one — same
	// number of queries, strictly more information.
	const membershipOrgIds = effectiveUserId
		? await listMembershipOrgIds(effectiveUserId)
		: [];
	const hasOrg = membershipOrgIds.length > 0;

	// hasCompany: when impersonating, query the target's memberships.
	let hasCompany = false;
	let companyId: string | null = null;
	if (impersonation.isImpersonating && effectiveUserId) {
		const memberships = await listCompaniesForUser(effectiveUserId);
		hasCompany = memberships.length > 0;
		// A single membership resolves directly, same as before. 2+ leaves
		// companyId null so AppSidebar's getCompanyNav() falls back to the
		// bare /app/company picker instead of guessing one — there's no
		// session token for an impersonated target to persist a "current
		// company" choice into.
		companyId = memberships.length === 1 ? memberships[0].company.id : null;
	} else {
		const sessionExt = session as
			| (typeof session & { companyId?: string | null })
			| null;
		hasCompany = !!sessionExt?.companyId;
		companyId = sessionExt?.companyId ?? null;
	}

	// /app itself is exempt — the volunteer dashboard renders for non-org users.
	// A user who already has a company (but no org) is sent to their company
	// page instead of onboarding — they've already onboarded, just not as a
	// nonprofit org, so /app/welcome would feel like starting over.
	if (!isExempt && pathname !== '/app' && !hasOrg) {
		redirect(hasCompany ? '/app/company' : '/app/welcome');
	}

	// Resolve the roster flag server-side so the nav item never flashes in and
	// then disappears. Following the hasOrg/hasCompany idiom rather than adding a
	// client query. Note this only hides NAV — the route itself is closed
	// independently in volunteers/layout.tsx, because hiding a link is cosmetic.
	// `orgId` is declared on Session in src/types/next-auth.d.ts — no cast needed.
	const sessionOrgId = session?.orgId ?? null;
	const activeOrgId = resolveActiveOrgId({
		membershipOrgIds,
		sessionOrgId,
		isImpersonating: impersonation.isImpersonating,
	});
	const hasVolunteerRoster = activeOrgId
		? await isFeatureEnabled(activeOrgId, STAFF_CREATED_VOLUNTEERS_FLAG)
		: false;

	return (
		<>
			{impersonation.isImpersonating && impersonation.expiresAt ? (
				<ImpersonationBanner
					targetEmail={impersonation.targetUser?.email ?? null}
					targetName={impersonation.targetUser?.name ?? null}
					expiresAt={impersonation.expiresAt.toISOString()}
				/>
			) : null}
			<AppShell
				hasOrg={hasOrg}
				hasCompany={hasCompany}
				companyId={companyId}
				hasVolunteerRoster={hasVolunteerRoster}
			>
				<AuthFeedback />
				{children}
				<FeedbackWidget />
			</AppShell>
		</>
	);
}
