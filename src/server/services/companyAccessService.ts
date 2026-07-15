import type { CompanyMemberRole, PlanTier } from '@/prisma/generated/client';
import { assertPlanAtLeast } from '@/server/domain/billing';
import {
	getCompanyMembership,
	getCompanyPlanTier,
} from '@/server/repositories/companyRepo';

const companyRoleRank: Record<CompanyMemberRole, number> = {
	MEMBER: 0,
	ADMIN: 1,
	OWNER: 2,
};

export class CompanyAccessDeniedError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'CompanyAccessDeniedError';
	}
}

/**
 * Verifies `userId` has at least `minRole` in `companyId` (and, if
 * `minPlanTier` is given, that the company's plan meets it).
 *
 * `companyId` must come from the request (URL param / tRPC input), never
 * from session state — the session's active company can differ from the
 * company a multi-company user is currently viewing, and authorizing
 * against the wrong one serves (or mutates) the wrong tenant's data.
 */
export async function requireCompanyAccess({
	userId,
	companyId,
	minRole = 'MEMBER',
	minPlanTier,
}: {
	userId: string;
	companyId: string;
	minRole?: CompanyMemberRole;
	minPlanTier?: PlanTier;
}): Promise<{ role: CompanyMemberRole }> {
	const membership = await getCompanyMembership(userId, companyId);
	if (!membership) {
		throw new CompanyAccessDeniedError('Not a member of this company');
	}

	if (companyRoleRank[membership.role] < companyRoleRank[minRole]) {
		throw new CompanyAccessDeniedError(`Requires ${minRole} role or higher`);
	}

	if (minPlanTier) {
		const planTier = await getCompanyPlanTier(companyId);
		try {
			assertPlanAtLeast(planTier, minPlanTier);
		} catch {
			throw new CompanyAccessDeniedError(
				`Requires ${minPlanTier} plan or higher`,
			);
		}
	}

	return { role: membership.role };
}
