import type { Role } from '@/prisma/generated/client';
import { roleRank } from '@/server/domain/permissions';
import {
	getOrgSuspension,
	userIsMemberOfOrg,
} from '@/server/repositories/orgRepo';

export class OrgAccessDeniedError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'OrgAccessDeniedError';
	}
}

/**
 * The raw-Route-Handler counterpart to `staffProcedure`.
 *
 * tRPC's `orgProcedure`/`staffProcedure` read `ctx.orgId`, which is derived from
 * the session's ACTIVE org. A Route Handler under `/api/org/[orgId]/…` cannot
 * do that: the org named in the URL and the org the session currently considers
 * active are two different things for anyone who belongs to more than one, and
 * authorizing against the session while serving the URL's org is exactly the
 * cross-tenant bug fixed in v0.29.2.0 for companies. So `orgId` is a parameter
 * here, never a lookup.
 *
 * Enforces the same three things `staffProcedure` does, in the same order:
 * membership, role rank, and org suspension. Feature flags are deliberately NOT
 * checked here — they are per-feature, and folding one in would make this guard
 * silently roster-specific.
 */
export async function requireOrgAccess({
	userId,
	orgId,
	minRole = 'STAFF',
}: {
	userId: string;
	orgId: string;
	minRole?: Role;
}): Promise<{ role: Role }> {
	const membership = await userIsMemberOfOrg(userId, orgId);
	if (!membership) {
		throw new OrgAccessDeniedError('Not a member of this organization');
	}

	if (roleRank[membership.role] < roleRank[minRole]) {
		throw new OrgAccessDeniedError(`Requires ${minRole} role or higher`);
	}

	// Matches `orgProcedure`'s Tier 3 check. A suspended org must not be able to
	// bulk-export its roster through a route that skipped tRPC.
	const suspension = await getOrgSuspension(orgId);
	if (suspension?.suspendedAt) {
		throw new OrgAccessDeniedError(
			'This organization is suspended. Contact support@volunteerready.org.',
		);
	}

	return { role: membership.role };
}
