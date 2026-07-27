import type { PrismaClient } from '@/prisma/generated/client';

/** Works with both `prisma` and `prisma.$transaction(tx => …)`. */
type TxClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

/**
 * Namespace half of the advisory lock key.
 *
 * `pg_advisory_xact_lock` takes two int4s that share ONE global keyspace with
 * every other advisory lock in the database. Without a namespace, a future
 * caller locking on a bare `hashtext(someOtherId)` could collide with this one
 * and serialize two unrelated features against each other. Any int would do;
 * this is `hashtext('volunteer_invitation_rate_limit')`, frozen as a literal so
 * the value is greppable rather than recomputed inside every query.
 *
 * Reproduce with:
 *   SELECT hashtext('volunteer_invitation_rate_limit');  -- -586077446
 *
 * `hashtext` is not guaranteed stable across major Postgres versions. That is
 * fine for a namespace — the only requirement is that every caller in a given
 * database agrees, and they all read this constant. It would NOT be fine if the
 * value were persisted anywhere; it is not.
 */
const INVITE_RATE_LIMIT_LOCK_NAMESPACE = -586_077_446;

/**
 * Serialize the invitation rate-limit check-then-act for one org.
 *
 * WHY THIS EXISTS
 * ---------------
 * `inviteToApply` counts today's invitations and then creates one. A comment
 * there used to claim the surrounding `prisma.$transaction` made that pair
 * atomic. It does not: Postgres defaults to READ COMMITTED, under which two
 * concurrent transactions can both COUNT 9, both pass a `>= 10` check, and both
 * COMMIT — 11 invitations from a 10/day limit. A transaction gives atomicity
 * (all-or-nothing) and isolation from *uncommitted* rows; it does not stop two
 * readers from making the same decision on the same committed snapshot.
 *
 * Taking this lock first turns the two statements into one critical section:
 * a second concurrent call for the same org blocks here until the first
 * transaction commits or rolls back, then runs its own COUNT and sees the
 * outcome.
 *
 * WHY A LOCK AND NOT THE OTHER TWO OPTIONS
 * ----------------------------------------
 * SERIALIZABLE would also close it, but nothing in this repo retries on a 40001
 * serialization failure, so every caller would need new retry machinery — and
 * SSI can abort invitations that are not over quota at all, purely on predicate
 * overlap.
 *
 * A counter table would close it too, and would make "7 of 10 used" cheap to
 * display. It is the wrong shape here: the limit is a ROLLING 24 hours over
 * real `sentAt` values, and a counter row is inherently a fixed window, so
 * adopting one silently converts the rule to a calendar day — gameable with 10
 * invitations at 23:59 and 10 more at 00:01. Revisit it only if the product
 * actually wants a calendar-day quota.
 *
 * This form preserves the existing semantics exactly, adds no table, no
 * migration, and no retry loop.
 *
 * CONSTRAINTS
 * -----------
 * - MUST be called with the same `tx` handle as the count and create that
 *   follow, and MUST run before the count. Both are the point.
 * - Transaction-scoped: Postgres releases it on COMMIT or ROLLBACK, so there is
 *   no unlock call and no leak if the transaction throws (rate limit hit,
 *   duplicate application, P2002).
 * - `hashtext` narrows the org id to 32 bits, so two orgs can in principle share
 *   a key and queue behind each other. Harmless — a brief wait, never a wrong
 *   count — at any realistic org count.
 * - Only serializes writers that come through here. `VolunteerInvitation.create`
 *   has exactly one callsite today (`inviteToApply`); a future bulk import or
 *   admin script must take this lock too or it will not be covered.
 *
 * One static template with a single bound parameter — NOT composed from
 * `Prisma.sql` fragments, per the raw-SQL rule in CLAUDE.md.
 */
export function lockOrgForInviteRateLimit(tx: TxClient, orgId: string) {
	return tx.$executeRaw`SELECT pg_advisory_xact_lock(${INVITE_RATE_LIMIT_LOCK_NAMESPACE}, hashtext(${orgId}))`;
}
