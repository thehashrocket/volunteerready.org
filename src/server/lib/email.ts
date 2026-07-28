import { normalizeEmail } from '@/server/domain/org-volunteer';
import { buildEmailHtml } from '@/server/lib/email-template';
import { isEnabled } from '@/server/lib/env-flags';
import { getFromEmail, getResend } from '@/server/lib/resend';
import { prisma } from '@/server/repositories/prisma';

const MAX_REENABLE_CAP = 3;

/** Kill switch for the unclaimed guard. See `lib/env-flags.ts` for semantics. */
const UNCLAIMED_GUARD_FLAG = 'UNCLAIMED_EMAIL_GUARD_ENABLED';

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
 * set by exactly the four senders that push unrequested bulk mail, so a sender
 * added later by someone who never read this fails safe (it sends). Blocking
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
		const checkBounce = !opts?.isCritical;
		const checkUnclaimed =
			!opts?.isCritical &&
			opts?.suppressUnclaimed === true &&
			isEnabled(UNCLAIMED_GUARD_FLAG);

		// Two independent reads. Running them sequentially would double the
		// latency of every cron send for no benefit, since neither informs the
		// other — both are pure "should I skip this address?" lookups.
		const [bounceStatus, recipient] = await Promise.all([
			checkBounce
				? prisma.emailBounceStatus.findUnique({
						where: { email: to.toLowerCase() },
						select: { suppressedAt: true, bounceCount: true },
					})
				: null,
			checkUnclaimed
				? prisma.user.findUnique({
						// normalizeEmail(), NOT to.toLowerCase(): User.email is stored
						// as lower(btrim(...)) by the T1 database trigger, so an address
						// with stray whitespace would miss the row here and the guard
						// would fail OPEN — mailing the exact person it exists to
						// protect. The bounce lookup above keeps .toLowerCase() because
						// EmailBounceStatus.email is deliberately NOT canonicalized
						// (see the T1 migration header; tracked as its own P3).
						where: { email: normalizeEmail(to) },
						select: { accountState: true },
					})
				: null,
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

		// A missing User row sends. Unreachable for the four opted-in senders —
		// all four reach the address through a required, non-nullable User FK —
		// so this only decides the behaviour of a future caller, and "send" is
		// the correct default for the same reason the guard is opt-in.
		if (recipient?.accountState === 'UNCLAIMED') {
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
					to: to.toLowerCase(),
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
