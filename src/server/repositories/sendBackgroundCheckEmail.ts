import { BASE_URL } from '@/lib/constants';
import { sendEmail } from '@/server/lib/email';
import { escapeHtml } from '@/server/lib/html';

/** Where a volunteer who did not authorize a check should write. */
const PRIVACY_CONTACT = 'privacy@volunteerready.org';

/**
 * Tells a volunteer that an organization has just started a background check on
 * them.
 *
 * THIS EMAIL IS THE CONTROL, not a courtesy. `backgroundChecks.initiate`
 * accepts any user the org holds an `ORG_VOLUNTEER` row for, and staff mint
 * those from an email address alone. Before this existed the subject of a check
 * was the ONLY party never told it happened: the sole background-check email
 * went to org staff on a CONSIDER result, and the volunteer heard from the
 * platform only on the FCRA pre-adverse path — i.e. only if the report came
 * back bad AND the coordinator chose to act on it. A clean check run on someone
 * who never agreed to one was invisible to them forever.
 *
 * The subject is also the only party who CAN detect an unauthorized check. That
 * is why the fix is disclosure rather than a stricter relationship requirement:
 * the coordinator must already hold the SSN and DOB to submit the form, so an
 * in-app consent edge adds nothing they do not already have, while blocking the
 * concierge case entirely.
 *
 * NOT `suppressUnclaimed`, and that matters more here than anywhere else.
 * `sendEmail`'s unclaimed guard is opt-in, so the default is already correct —
 * but the default being correct is load-bearing rather than incidental: a
 * volunteer typed into a roster from a spreadsheet, who has never logged in, is
 * precisely the person with the weakest consent and the strongest claim to be
 * told. Suppressing this one would remove the witness from the population that
 * needs it most. Do not add the flag.
 *
 * Two recipients, one email. An account holder can act — the link goes to the
 * Organisations section on /app/profile, where leaving writes an
 * `OrgVolunteerBlock` that refuses the NEXT check. A volunteer with no account
 * cannot reach that control at all (P3 in docs/TODOS.md), so the mail also
 * names a human path. That asymmetry is why the contact line is unconditional
 * rather than shown only to shadow users: we do not want to explain to someone
 * why their notice was the shorter one.
 *
 * EVERY interpolated value is escaped. `orgName` is org-controlled input a
 * coordinator types and this lands in someone else's inbox as HTML — the same
 * rule `sendRosterAddedEmail` follows.
 *
 * Deliberately does NOT name the package, the result, or a timeline. It says
 * what happened, who did it, what was sent where, and what to do about it. A
 * status page for the subject is a bigger question than this notice.
 */
export async function sendBackgroundCheckInitiatedEmail(input: {
	to: string;
	orgName: string;
	/** 'Checkr' | 'Sterling' — the consumer reporting agency that received the PII. */
	providerName: string;
}): Promise<boolean> {
	const orgName = escapeHtml(input.orgName);
	const providerName = escapeHtml(input.providerName);
	const profileUrl = `${BASE_URL}/app/profile`;

	// RETURNS the result rather than discarding it. `sendEmail` does NOT throw on
	// failure — it returns `false` for a Resend error and for a bounce-suppressed
	// address. A caller that ignores the boolean and relies on `.catch` treats
	// both as success, which for THIS email means the witness is gone and the
	// logs say everything worked.
	return await sendEmail(
		input.to,
		`${input.orgName} started a background check on you`,
		`
        <p><strong>${orgName}</strong> has started a background check on you
           through <strong>${providerName}</strong>, a consumer reporting agency.</p>
        <p>Your Social Security number and date of birth were sent directly to
           ${providerName} to run it. VolunteerReady does not store either one.
           ${providerName} will return the result to ${orgName}.</p>
        <p>You have the right to dispute the accuracy of the result directly
           with ${providerName}.</p>
        <p><strong>If you did not agree to this check</strong>, reply to
           ${orgName} first — organizations are required to obtain your signed
           authorization before running one. You can also write to us at
           <a href="mailto:${PRIVACY_CONTACT}" style="color: #1B3C2A;">${PRIVACY_CONTACT}</a>
           and we will look into it.</p>
        <p>If you have a VolunteerReady account, you can also review which
           organizations have access to you — and remove one — from
           <a href="${profileUrl}" style="color: #1B3C2A;">your profile</a>.
           Removing an organization stops future checks; it cannot stop one
           already underway.</p>
    `,
	);
}

/**
 * Sends a notification email to org staff when a background check result
 * is CONSIDER — i.e., it requires manual review before a decision is made.
 */
export async function sendBackgroundCheckConsiderEmail(input: {
	to: string;
	volunteerName: string;
	orgName: string;
	requestId: string;
}): Promise<void> {
	const appUrl =
		process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.volunteerready.com';
	const reviewUrl = `${appUrl}/app/settings/background-checks`;

	await sendEmail(
		input.to,
		`Background check requires review — ${input.volunteerName}`,
		`
        <p>The background check for <strong>${input.volunteerName}</strong> at <strong>${input.orgName}</strong> has returned a <strong>Consider</strong> result.</p>
        <p>A "Consider" result means the check found something that requires your review before a decision can be made. Please log in to VolunteerReady to review the details and determine next steps.</p>
        <p><a href="${reviewUrl}" style="display: inline-block; background: #1B3C2A; color: #FAFAF8; padding: 8px 16px; border-radius: 8px; text-decoration: none;">Review Background Check</a></p>
        <p style="color: #787571; font-size: 0.875rem;">Request ID: ${input.requestId}</p>
        <p style="color: #787571; font-size: 0.875rem;">If you have questions, please contact your legal or HR team before taking action.</p>
    `,
	);
}
