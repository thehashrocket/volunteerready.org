import { isEnabled } from '@/server/lib/env-flags';
import { writeAuditLog } from '@/server/repositories/auditRepo';
import { claimUnclaimedUser } from '@/server/repositories/userAccountStateRepo';

/** Kill switch for the claim flip. See `lib/env-flags.ts` for semantics. */
const ACCOUNT_STATE_FLIP_FLAG = 'ACCOUNT_STATE_FLIP_ENABLED';

/**
 * Claim a staff-created (UNCLAIMED) account the first time its owner signs in.
 *
 * Called from NextAuth `events.signIn` — see the SECURITY note there for why
 * that hook and not `events.updateUser`.
 *
 * This is the ONLY exit from `UNCLAIMED`. Without it, a volunteer whose email
 * an org typed stays UNCLAIMED forever, and every `suppressUnclaimed` sender
 * keeps skipping them after they have signed in and demonstrably do want to
 * hear from us. The failure is invisible from both sides: staff see a badge
 * that says the volunteer never signed up, the volunteer just never gets mail.
 *
 * Audited. The flip changes what mail a person receives, so "who was this
 * account and when did it become real?" needs an answer that does not depend
 * on inferring it from `claimedAt` alone. The actor IS the subject — this is
 * the one audited action a user performs on themselves.
 *
 * @returns true when this call performed the flip.
 */
export async function claimAccountOnSignIn(userId: string): Promise<boolean> {
	if (!isEnabled(ACCOUNT_STATE_FLIP_FLAG)) return false;

	const claimedAt = new Date();
	const claimed = await claimUnclaimedUser(userId, claimedAt);
	if (!claimed) return false;

	// Not inside a transaction with the flip, deliberately. A lost audit row is
	// recoverable from `User.claimedAt`; a flip rolled back because the audit
	// write failed would leave a signed-in person permanently email-suppressed.
	// The flip is the thing that must survive.
	await writeAuditLog({
		actorId: userId,
		action: 'ACCOUNT_CLAIMED',
		entityType: 'User',
		entityId: userId,
		metadata: { claimedAt: claimedAt.toISOString() },
	});

	return true;
}
