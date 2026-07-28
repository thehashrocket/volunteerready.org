import { normalizeEmail } from '@/server/domain/org-volunteer';
import { buildEmailHtml } from '@/server/lib/email-template';
import { isEnabled } from '@/server/lib/env-flags';
import { getFromEmail, getResend } from '@/server/lib/resend';
import { prisma } from '@/server/repositories/prisma';
import { findAccountStateByEmail } from '@/server/repositories/userAccountStateRepo';

const MAX_REENABLE_CAP = 3;

/**
 * Send a branded email via Resend.
 *
 * Wraps `htmlContent` in the VolunteerReady branded template (forest green
 * header, sand footer). Catches and logs errors — callers decide whether
 * to await or fire-and-forget.
 *
 * Bounce suppression: if the recipient has bounced >= MAX_REENABLE_CAP (3)
 * times and is currently suppressed, the email is silently skipped unless
 * `isCritical` is true (e.g., FCRA adverse action notices).
 *
 * Unclaimed suppression (`opts.suppressUnclaimed`): skips addresses belonging
 * to an UNCLAIMED User — a row org staff created by typing someone's email,
 * which nobody has ever authenticated as. OPT-IN, and deliberately so: it is
 * set only by senders of unrequested bulk mail, so a sender added later by
 * someone who never read this fails safe (it sends). Blocking
 * by default with an exemption list was drafted and rejected — the draft
 * exemption list was already missing six transactional senders people had
 * explicitly asked for, which would have gone silently dead.
 * See docs/designs/staff-created-volunteers.md §3.
 *
 * Logs a SENT EmailEvent on success (best-effort, never blocks) and a
 * SUPPRESSED_UNCLAIMED EmailEvent when the unclaimed guard fires.
 */
export async function sendEmail(
	to: string,
	subject: string,
	htmlContent: string,
	opts?: { isCritical?: boolean; suppressUnclaimed?: boolean },
): Promise<boolean> {
	try {
		// Critical mail (FCRA adverse-action notices) bypasses BOTH guards.
		const isCritical = opts?.isCritical === true;
		const checkBounce = !isCritical;
		const checkUnclaimed =
			!isCritical &&
			opts?.suppressUnclaimed === true &&
			isEnabled('UNCLAIMED_EMAIL_GUARD_ENABLED');

		// Concurrent, not sequential: neither lookup informs the other, and this
		// runs per recipient on every cron send.
		const [bounceStatus, accountState] = await Promise.all([
			checkBounce ? lookupBounce(to) : null,
			checkUnclaimed ? lookupAccountState(to) : null,
		]);

		if (
			bounceStatus?.suppressedAt &&
			bounceStatus.bounceCount >= MAX_REENABLE_CAP
		) {
			console.warn('[sendEmail] Skipping suppressed address:', {
				to,
				bounceCount: bounceStatus.bounceCount,
			});
			return false;
		}

		// An unknown recipient sends. Only reachable when a caller opts in for an
		// address with no `User` row, and "send" is the right default there for
		// the same reason the guard is opt-in at all.
		if (accountState === 'UNCLAIMED') {
			await recordUnclaimedSuppression(to, subject);
			return false;
		}

		const from = getFromEmail();
		const result = await getResend().emails.send({
			from,
			to,
			subject,
			html: buildEmailHtml(htmlContent),
		});

		// Log SENT event (best-effort)
		const resendId = result?.data?.id ?? null;
		prisma.emailEvent
			.create({
				data: {
					resendId,
					// SENT and SUPPRESSED_UNCLAIMED are read together to answer one
					// question, so they must key identically.
					to: normalizeEmail(to),
					subject,
					eventType: 'SENT',
				},
			})
			.catch((err) => {
				console.error('[sendEmail] Failed to log SENT event:', err);
			});

		return true;
	} catch (err) {
		console.error('[sendEmail] Failed to send email:', { to, subject, err });
		return false;
	}
}

/** Bounce suppression state for an address, or null if the check is skipped. */
function lookupBounce(to: string) {
	return prisma.emailBounceStatus.findUnique({
		where: { email: to.toLowerCase() },
		select: { suppressedAt: true, bounceCount: true },
	});
}

/**
 * Recipient account state, or null if unknown.
 *
 * Errors are caught HERE rather than by `sendEmail`'s outer catch. Inside the
 * `Promise.all` an unhandled rejection takes the whole send down — it would
 * return false and log "Failed to send email", so one transient database blip
 * would silently drop mail for ACTIVE recipients and blame Resend for it. An
 * inconclusive lookup is not evidence that someone is UNCLAIMED, so the guard
 * fails OPEN.
 */
function lookupAccountState(to: string) {
	return findAccountStateByEmail(to).catch((err) => {
		console.error('[sendEmail] Unclaimed lookup failed, sending anyway:', err);
		return null;
	});
}

/**
 * Record that the unclaimed guard dropped a send.
 *
 * AWAITED, unlike the fire-and-forget SENT log above. The asymmetry is
 * deliberate: if the SENT log is lost the mail still went out and Resend holds
 * its own record, but if this row is lost there is no record anywhere that a
 * person did not get their shift reminder — which is the entire reason the
 * event type exists. One insert on a cron path is not worth trading that for.
 *
 * A failure to log still suppresses. Sending mail we decided to withhold
 * because the audit write failed would be the wrong recovery.
 */
async function recordUnclaimedSuppression(to: string, subject: string) {
	console.warn('[sendEmail] Skipping unclaimed recipient:', { to, subject });
	try {
		await prisma.emailEvent.create({
			data: {
				resendId: null,
				to: normalizeEmail(to),
				subject,
				eventType: 'SUPPRESSED_UNCLAIMED',
			},
		});
	} catch (err) {
		console.error('[sendEmail] Failed to log SUPPRESSED_UNCLAIMED event:', err);
	}
}
