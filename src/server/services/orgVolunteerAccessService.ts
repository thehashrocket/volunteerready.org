/**
 * Org ↔ volunteer access guard.
 *
 * `staffProcedure` answers "is the caller staff somewhere?" and `ctx.orgId`
 * answers "where?" — but neither says anything about a `userId` arriving in the
 * procedure's *input*. Several staff procedures took that id and acted on it
 * with no check that the person had ever heard of the caller's org, which let
 * any staff user at any org operate on any user in the system by id. User ids
 * are not secret: `/v/[userId]` is a public route.
 *
 * This module is the missing half of that authorization. It mirrors
 * `requireCompanyAccess` in companyAccessService.ts in *shape* — though not in
 * error type, and deliberately: `requireCompanyAccess` throws a domain error
 * because `companyScopedProcedure` catches and translates it centrally in
 * trpc/init.ts. There is no equivalent procedure factory here (this guard is
 * called from inside service bodies), so a domain class would buy nothing but
 * hand-written try/catch at every callsite. TRPCError is also the house style:
 * ~16 service files throw it, companyAccessService is the lone exception.
 *
 * There is one further structural inversion worth naming. In
 * `requireCompanyAccess`, `companyId` is the untrusted value (it comes from the
 * URL) and the user is trusted. Here it is the other way round — `orgId` comes
 * from `ctx`, resolved server-side, and the `userId` from input is untrusted.
 *
 * @see findOrgVolunteerRelationship for which relations count and, more
 *      importantly, why several plausible-looking ones deliberately do not.
 */
import { TRPCError } from '@trpc/server';
import {
	findOrgVolunteerRelationship,
	type OrgRelationshipKind,
} from '@/server/repositories/orgVolunteerRepo';

/**
 * Non-throwing form, for callers that render "nothing here" as a normal empty
 * state rather than an error.
 *
 * Yes, this currently just forwards to the repository, and a service calling a
 * repository directly would be perfectly conventional here. It exists so that
 * every "may this org act on this user" decision enters through ONE module: the
 * accepted-relationship set is a security policy, and the open question of
 * whether high-stakes paths (a paid background check) should require a stricter
 * set than a profile read is exactly the kind of change that must land in one
 * place rather than at each callsite. Do not inline it away.
 */
export async function getOrgVolunteerRelationship(
	orgId: string,
	userId: string,
): Promise<OrgRelationshipKind | null> {
	return findOrgVolunteerRelationship(orgId, userId);
}

/**
 * Assert that `userId` is someone this org may act on, or throw.
 *
 * Throws NOT_FOUND rather than FORBIDDEN, deliberately and in line with the
 * IDOR guards already in backgroundCheckService.ts: the user genuinely exists,
 * just not in this tenant, and FORBIDDEN would confirm that to a caller probing
 * ids. "Not yours" and "not real" must be indistinguishable.
 */
export async function requireOrgVolunteerRelationship(
	orgId: string,
	userId: string,
	opts?: { acceptExistingCredential?: boolean },
): Promise<OrgRelationshipKind> {
	const relationship = await findOrgVolunteerRelationship(orgId, userId, opts);

	if (!relationship) {
		throw new TRPCError({
			code: 'NOT_FOUND',
			message: 'Volunteer not found in this organization.',
		});
	}

	return relationship;
}
