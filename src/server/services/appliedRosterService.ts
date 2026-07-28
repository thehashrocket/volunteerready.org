import type { PrismaClient } from '@/prisma/generated/client';
import { writeAuditLogTx } from '@/server/repositories/auditRepo';
import {
	createOrgVolunteerIfAbsent,
	findLiveOrgVolunteer,
} from '@/server/repositories/orgVolunteerRepo';
import { findUserIdentity } from '@/server/repositories/userAccountStateRepo';

/** Works with both `prisma` and `prisma.$transaction(tx => …)`. */
type TxClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

/**
 * Materialize the roster edge implied by an approved application (E1a, "one
 * list of volunteers").
 *
 * Before this existed, `/app/volunteers` listed only volunteers a coordinator
 * had typed in by hand: every volunteer who actually applied and was approved
 * was missing, so the roster could not be described as the org's volunteer list.
 * Two entry points reach here, and both must, or the roster diverges:
 *
 *   1. Approving an application whose `submittedByUserId` is already set.
 *   2. CLAIMING an application that was approved BEFORE the applicant ever
 *      signed in — `submittedByUserId` arrives at claim time, so without this
 *      the row is never created and never reconciled.
 *
 * NOT called for anonymous applications (`submittedByUserId: null`). Minting a
 * shadow `User` from `submittedByEmail` on every public approval is deferred to
 * v1b; until then an org with anonymous applicants carries a partial roster.
 *
 * MUST be called inside the same transaction as the status change (or the claim
 * and its audit row) so a partial commit cannot leave an approved, linked
 * application with no roster row.
 *
 * @returns true when a roster row was created, false when one already existed.
 */
export async function ensureAppliedRosterRow(
	tx: TxClient,
	input: {
		orgId: string;
		userId: string;
		applicationId: string;
		/** Who to attribute the audit row to. Staff on approval, the volunteer on claim. */
		actorId: string | null;
		/**
		 * Roster attribution. The approving staff member, or null on the claim
		 * path — nobody "added" a volunteer who added themselves.
		 */
		addedByUserId: string | null;
		/**
		 * Last-resort roster label. `User.name` AND `User.email` are both nullable
		 * in the schema, but `displayName` is not, so the caller supplies an address
		 * it already holds — the application's `submittedByEmail`, or the address
		 * the claim path already resolved.
		 */
		fallbackDisplayName: string;
		/** Real admin user id when the actor is being impersonated. */
		impersonatedBy?: string | null;
	},
): Promise<boolean> {
	const identity = await findUserIdentity(tx, input.userId);

	if (!identity) {
		// The application points at a user id that no longer exists. Nothing to
		// put on a roster, and throwing here would roll back an approval over a
		// dangling reference.
		return false;
	}

	// `User.name` is null for anyone who signed up by magic link without ever
	// filling in a profile, so the email is the fallback — it is the identity the
	// coordinator recognises, and the roster row renders an UNCLAIMED badge
	// beside it anyway.
	const displayName =
		identity.name?.trim() || identity.email || input.fallbackDisplayName;

	const created = await createOrgVolunteerIfAbsent(tx, {
		orgId: input.orgId,
		userId: input.userId,
		displayName,
		source: 'APPLIED',
		addedByUserId: input.addedByUserId,
	});

	if (!created) {
		// Already on the live roster, or a concurrent transaction won the insert.
		// Either way the desired end state holds and the winner wrote the audit
		// row, so writing a second one here would double-count the same edge.
		return false;
	}

	const volunteer = await findLiveOrgVolunteer(input.orgId, input.userId, tx);

	await writeAuditLogTx(tx, {
		orgId: input.orgId,
		actorId: input.actorId,
		// Same action as a hand-typed add so one query returns the whole roster
		// history; `metadata.source` distinguishes how the edge came to exist.
		action: 'VOLUNTEER_ADDED',
		entityType: 'OrgVolunteer',
		entityId: volunteer?.id ?? null,
		metadata: {
			email: identity.email ?? input.fallbackDisplayName,
			source: 'APPLIED',
			applicationId: input.applicationId,
			...(input.impersonatedBy ? { impersonatedBy: input.impersonatedBy } : {}),
		},
	});

	return true;
}
