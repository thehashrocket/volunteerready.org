import { BASE_URL } from '@/lib/constants';
import { rosterAddedEmailSubject } from '@/server/domain/org-volunteer';
import { sendEmail } from '@/server/lib/email';
import { escapeHtml } from '@/server/lib/html';

/**
 * Tells an existing ACTIVE user that an org added them to its volunteer roster.
 *
 * Sent for exactly ONE of the three add branches. The other two — a freshly
 * minted shadow user, and an UNCLAIMED user another org already created — send
 * nothing, because in those cases nobody has asked to hear from us and the
 * address may be a typo. See `AddVolunteerOutcome` in domain/org-volunteer.ts.
 *
 * NOT suppressed by the unclaimed guard: this is transactional mail to a real
 * account holder about something that just happened to their account, not the
 * unrequested bulk mail the guard exists to stop. The guard is opt-in, so the
 * default (no `suppressUnclaimed`) is already correct here — the recipient is
 * ACTIVE by definition anyway.
 *
 * EVERY interpolated value is escaped. `orgName` is org-controlled input a
 * coordinator types, `addedByName` likewise, and this lands in someone else's
 * inbox as HTML. The sibling `sendInviteEmail` does not escape and should be
 * fixed separately (Code Quality Q3).
 *
 * Security §2 claims this recipient "can remove the roster link", so the email
 * has to actually say where. That surface is the Organisations section on
 * /app/profile (T32) — if this email ships before T32, the link is a promise
 * the product does not keep.
 *
 * The capability list is accurate but NOT exhaustive: it omits background
 * checks, which the org can also request. This is a cold "you've been added"
 * notice, and leading with the most alarming capability would misrepresent a
 * feature most orgs never touch. The full list lives on the confirm at
 * /app/profile, where someone who followed this link is actually deliberating.
 *
 * RETURNS whether the send happened, rather than discarding it. `sendEmail` does
 * NOT throw on failure — it returns `false` for a Resend error and for a
 * bounce-suppressed address. This function used to `await` it and drop the
 * result, so every caller's `try/catch` was dead on the likeliest failure path
 * and the importer reported "notifications sent: 60" when zero landed. Same fix
 * `sendBackgroundCheckEmail` already carries for the same reason.
 */
export async function sendRosterAddedEmail(input: {
	to: string;
	orgName: string;
	/** Display name of the coordinator who added them, when known. */
	addedByName?: string | null;
}): Promise<boolean> {
	const orgName = escapeHtml(input.orgName);
	const profileUrl = `${BASE_URL}/app/profile`;

	// "who did it" per the design spec — but only when we actually know, rather
	// than inventing a vague actor.
	const attribution = input.addedByName
		? `${escapeHtml(input.addedByName)} at <strong>${orgName}</strong>`
		: `<strong>${orgName}</strong>`;

	return sendEmail(
		input.to,
		rosterAddedEmailSubject(input.orgName),
		`
        <p>${attribution} added you to their volunteer roster on VolunteerReady.</p>
        <p>This means they can schedule you for shifts, see your volunteer
           profile, and record the hours you volunteer with them. You don't need
           to do anything.</p>
        <p>If this wasn't expected, you can leave their roster and remove that
           access from <a href="${profileUrl}" style="color: #1B3C2A;">your profile</a>.</p>
    `,
	);
}
