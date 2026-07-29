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
import type { PrismaClient } from '@/prisma/generated/client';
import { writeAuditLogTx } from '@/server/repositories/auditRepo';
import {
	deleteOrgVolunteerBlock,
	findOrgVolunteerRelationship,
	type OrgRelationshipKind,
} from '@/server/repositories/orgVolunteerRepo';

/** Works with both `prisma` and `prisma.$transaction(tx => …)`. */
type TxClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

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
 *
 * SCOPE NOTE (v0.37.0.0): "one module" covers deciding whether an org may ACT
 * on a user. It does NOT cover roster MEMBERSHIP, where THREE services import
 * `findOrgVolunteerBlock` from the repository directly, across five call sites
 * (four refusals plus `leaveOrgRoster`'s own already-left check). That is
 * deliberate — the four refusals answer in three different shapes (FORBIDDEN, a
 * `false` return, and NOT_FOUND) chosen to match each caller's surface, so
 * routing them through one
 * throwing helper would make the refusals uniform and wrong. What stays
 * centralized is which relationships authorize; what is callsite-local is how
 * to say no.
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

/**
 * Clear a volunteer's block on an org because they re-engaged with it
 * themselves, and record that they did.
 *
 * This is the ONLY way a block is lifted. That is the whole point: every other
 * edge in the relationship set is one staff can mint from an email address, so
 * if the org could clear this one too, leaving a roster would revoke nothing
 * durable. Re-entry is volunteer-initiated by construction.
 *
 * Called from the three places a volunteer acts toward an org of their own
 * accord — submitting an application, claiming one, and signing up for a shift.
 * A staff assignment is deliberately NOT one of them: `assignVolunteerToShift`
 * needs a live `OrgVolunteer` row, and all three creators of that row
 * (`addVolunteer`, `ensureAppliedRosterRow`, `restoreVolunteer`) refuse while a
 * block stands, so staff cannot reach a signup for a blocked person at all.
 * That assign path also re-checks the block itself, because this argument is a
 * chain of four callsites rather than a structural guarantee.
 *
 * Takes a `tx` and no-ops silently when nothing was blocked, because every
 * caller invokes it unconditionally inside a transaction that is really about
 * something else. It must never be the reason an application submission or a
 * shift signup rolls back.
 */
export async function liftOrgVolunteerBlock(
	tx: TxClient,
	orgId: string,
	userId: string,
): Promise<boolean> {
	const removed = await deleteOrgVolunteerBlock(tx, orgId, userId);
	if (removed === 0) return false;

	await writeAuditLogTx(tx, {
		orgId,
		// The volunteer is the actor: nobody else can cause this.
		actorId: userId,
		action: 'ORG_ACCESS_RESTORED',
		// The block row is already gone, so the subject of the entry is the user
		// whose access decision changed rather than the deleted row's own id.
		entityType: 'OrgVolunteerBlock',
		entityId: userId,
		metadata: {},
	});

	return true;
}
