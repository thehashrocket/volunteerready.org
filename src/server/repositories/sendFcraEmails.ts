/**
 * FCRA adverse action email senders (volunteer-facing).
 *
 * These emails are CRITICAL for legal compliance — failures must propagate
 * to the caller (not swallowed). The caller should only update DB state
 * after the email sends successfully.
 *
 * Content follows FCRA requirements:
 *   - Pre-adverse: notice of potential adverse action, instruction to
 *     contact Checkr for report copy, link to FTC FCRA rights summary
 *   - Adverse action: final notice that adverse action has been taken
 */

import { buildEmailHtml } from '@/server/lib/email-template';
import { getFromEmail, getResend } from '@/server/lib/resend';

const FTC_FCRA_RIGHTS_URL =
	'https://www.consumer.ftc.gov/articles/pdf-0096-fair-credit-reporting-act.pdf';

/**
 * Sends a pre-adverse action notice to a volunteer per FCRA requirements.
 * This email informs the volunteer that the organization is considering
 * adverse action based on their background check results.
 *
 * @throws on email send failure — caller must NOT update DB on failure
 */
export async function sendPreAdverseActionEmail(input: {
	to: string;
	volunteerName: string;
	orgName: string;
}): Promise<void> {
	const from = getFromEmail();

	await getResend().emails.send({
		from,
		to: input.to,
		subject: `Important notice about your background check — ${input.orgName}`,
		html: buildEmailHtml(`
        <p>Dear ${input.volunteerName},</p>

        <p><strong>${input.orgName}</strong> is considering taking adverse action regarding your volunteer
        application based on information contained in a consumer report (background check).</p>

        <p>Under the Fair Credit Reporting Act (FCRA), you have the right to:</p>
        <ul>
          <li>Obtain a free copy of your consumer report from the background check provider</li>
          <li>Dispute the accuracy or completeness of any information in the report</li>
          <li>Provide a statement relating to any disputed information</li>
        </ul>

        <p>To obtain a copy of your background check report, please contact Checkr directly
        at <a href="https://candidate.checkr.com" style="color: #1B3C2A;">candidate.checkr.com</a> or call
        <strong>(844) 824-3257</strong>.</p>

        <p>You have <strong>5 business days</strong> from receipt of this notice to dispute
        any information before a final decision is made.</p>

        <p>For more information about your rights under the FCRA, please review the
        <a href="${FTC_FCRA_RIGHTS_URL}" style="color: #1B3C2A;">Summary of Your Rights Under the Fair Credit Reporting Act</a>.</p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #6b7280; font-size: 0.875rem;">
          This notice is sent on behalf of ${input.orgName} via VolunteerReady.
          If you have questions, please contact ${input.orgName} directly.
        </p>
    `),
	});
}

/**
 * Sends a final adverse action notice to a volunteer per FCRA requirements.
 * This email informs the volunteer that the organization has finalized
 * its adverse action decision.
 *
 * @throws on email send failure — caller must NOT update DB on failure
 */
export async function sendAdverseActionEmail(input: {
	to: string;
	volunteerName: string;
	orgName: string;
}): Promise<void> {
	const from = getFromEmail();

	await getResend().emails.send({
		from,
		to: input.to,
		subject: `Adverse action notice — ${input.orgName}`,
		html: buildEmailHtml(`
        <p>Dear ${input.volunteerName},</p>

        <p><strong>${input.orgName}</strong> has made a final decision to take adverse action
        regarding your volunteer application based on information contained in a consumer report
        (background check).</p>

        <p>Under the Fair Credit Reporting Act (FCRA), you have the right to:</p>
        <ul>
          <li>Obtain a free copy of your consumer report from the background check provider
          within 60 days of this notice</li>
          <li>Dispute the accuracy or completeness of any information in the report directly
          with the reporting agency</li>
        </ul>

        <p>The background check was provided by:</p>
        <p style="margin-left: 16px;">
          <strong>Checkr, Inc.</strong><br />
          Website: <a href="https://candidate.checkr.com" style="color: #1B3C2A;">candidate.checkr.com</a><br />
          Phone: (844) 824-3257
        </p>

        <p>Please note that ${input.orgName} did not make this decision based on information
        provided by Checkr, and Checkr is unable to provide you with specific reasons for
        this action.</p>

        <p>For more information about your rights under the FCRA, please review the
        <a href="${FTC_FCRA_RIGHTS_URL}" style="color: #1B3C2A;">Summary of Your Rights Under the Fair Credit Reporting Act</a>.</p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #6b7280; font-size: 0.875rem;">
          This notice is sent on behalf of ${input.orgName} via VolunteerReady.
        </p>
    `),
	});
}
