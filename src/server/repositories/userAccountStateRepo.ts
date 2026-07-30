import type { AccountState, PrismaClient } from '@/prisma/generated/client';
import { normalizeEmail } from '@/server/domain/org-volunteer';
import { prisma } from './prisma';

/** Works with both `prisma` and `prisma.$transaction(tx => …)`. */
type TxClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

/**
 * Look up a recipient's account state by email address.
 *
 * Keyed with `normalizeEmail()` — `lower(btrim(...))` — and NOT the bare
 * `.toLowerCase()` used for the bounce lookup next to the caller. `User.email`
 * is stored canonicalized by the T1 database trigger, so an address carrying
 * stray whitespace would miss the row and the guard would fail OPEN, mailing
 * the exact person it exists to protect. `EmailBounceStatus.email` is
 * deliberately NOT canonicalized (see the T1 migration header), which is why
 * the two lookups legitimately differ.
 *
 * @returns null when no user has this address — the caller must treat that as
 *          "unknown", never as "unclaimed".
 */
export async function findAccountStateByEmail(
	email: string,
): Promise<AccountState | null> {
	const row = await prisma.user.findUnique({
		where: { email: normalizeEmail(email) },
		select: { accountState: true },
	});
	return row?.accountState ?? null;
}

/**
 * The user id for a canonical email address, if one exists.
 *
 * Exists for the concierge import's `--dry-run`, which has to answer "is this
 * person already on the roster?" without writing anything — and the roster is
 * keyed on `userId` while the spreadsheet is keyed on an address.
 *
 * Same `normalizeEmail()` reasoning as `findAccountStateByEmail` above: storage
 * is canonicalized by the T1 trigger, so a raw address misses the row. Here a
 * miss is reported as "would create a new person", which for a dry run whose
 * whole job is to preview the write would be a confidently wrong answer.
 */
export async function findUserIdByEmail(email: string): Promise<string | null> {
	const row = await prisma.user.findUnique({
		where: { email: normalizeEmail(email) },
		select: { id: true },
	});
	return row?.id ?? null;
}

/**
 * The canonical email address stored for a user id.
 *
 * SECURITY: exists so identity-binding code can source the address from the
 * SAME id it is acting on. `createTRPCContext` builds the session as
 * `{ ...realSession.user, id: effectiveUserId }` — under impersonation only
 * `id` is swapped, so `ctx.session.user.email` remains the real admin's
 * address. Any code that pairs `session.user.id` with `session.user.email` is
 * therefore mixing two identities. Read the email from here instead.
 */
export async function findEmailByUserId(
	userId: string,
): Promise<string | null> {
	const row = await prisma.user.findUnique({
		where: { id: userId },
		select: { email: true },
	});
	return row?.email ?? null;
}

/**
 * The name and canonical email for a user id, read through a caller-supplied
 * transaction client.
 *
 * Exists for the roster convergence path (E1a), which needs a `displayName`
 * inside the approval/claim transaction. `VolunteerApplication` carries no name
 * field, so the roster label is sourced from the `User` row.
 *
 * Deliberately keyed on the user ID rather than the application's
 * `submittedByEmail`: the two are not guaranteed to agree (an application can be
 * submitted under one address while linked to a user with another), and the
 * roster must name the identity it actually grants the org access to.
 */
export async function findUserIdentity(
	tx: TxClient,
	userId: string,
): Promise<{ name: string | null; email: string | null } | null> {
	return tx.user.findUnique({
		where: { id: userId },
		select: { name: true, email: true },
	});
}

/**
 * Flip an UNCLAIMED user to ACTIVE and stamp `claimedAt`.
 *
 * `updateMany` scoped on the CURRENT state, not `update` by id, for three
 * reasons that all point the same way:
 *
 *   1. Idempotence by construction. This runs on every sign-in, and the second
 *      one must not re-stamp `claimedAt` to a later date — that field is the
 *      answer to "when did this person first show up?", and an `update` by id
 *      would silently overwrite it on every subsequent login.
 *   2. It is a compare-and-set, so two concurrent sign-ins (a magic link
 *      clicked twice, a retried OAuth callback) cannot both report success.
 *      The returned count tells the caller which one actually claimed.
 *   3. It needs no prior read, so the decision cannot depend on whether
 *      NextAuth happens to hand us `accountState` on any given version.
 *
 * @returns true when this call performed the flip, false when the user was
 *          already ACTIVE (or does not exist).
 */
export async function claimUnclaimedUser(
	userId: string,
	claimedAt: Date,
): Promise<boolean> {
	const { count } = await prisma.user.updateMany({
		where: { id: userId, accountState: 'UNCLAIMED' },
		data: { accountState: 'ACTIVE', claimedAt },
	});
	return count > 0;
}

/**
 * Was this `User` row actually created just now?
 *
 * Exists because next-auth's `events.createUser` fires for rows that were
 * merely LINKED, not created, once account linking is on — see the
 * `events.createUser` comment in `server/auth.ts` for the control flow and
 * why the event alone is not trustworthy.
 *
 * Age, not `accountState`, is the test: it also covers the ordinary user who
 * signed up by magic link months ago and links Google today, whose
 * `accountState` is a perfectly normal ACTIVE.
 *
 * BOTH SIDES OF THE COMPARISON ARE THE APPLICATION CLOCK, which is what makes
 * this comparison sound. `@default(now())` is NOT resolved by Postgres here:
 * Prisma's query engine generates the value and sends it as a bound parameter
 * (verified with `log_statement=all` — the INSERT reads
 * `..."createdAt","updatedAt") VALUES ($1,$2,$3,...,$5,$6)`, not
 * `CURRENT_TIMESTAMP`). So `createdAt` is written by an app instance, and
 * comparing it against `Date.now()` is apples to apples.
 *
 * An earlier version of this used raw SQL with `NOW()` on the right-hand side,
 * on the belief that `createdAt` was database-generated. That was backwards —
 * it introduced the app-vs-database skew it claimed to remove, and bought
 * nothing for the extra complexity. The residual risk is skew *between app
 * instances*, which the deliberately generous window absorbs.
 *
 * Erring long means a volunteer who claims within minutes of being added also
 * triggers an alert, which is the harmless direction to fail.
 */
export async function wasUserCreatedWithin(
	userId: string,
	withinMs: number,
): Promise<boolean> {
	const count = await prisma.user.count({
		where: { id: userId, createdAt: { gte: new Date(Date.now() - withinMs) } },
	});
	return count > 0;
}
