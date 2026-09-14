import { sendEmail } from '@/server/lib/email';
import { escapeHtml } from '@/server/lib/html';
import {
	_resetAdminEmailsCacheForTests,
	getAdminEmails,
} from './admin-recipients';

export { _resetAdminEmailsCacheForTests };

// ---------------------------------------------------------------------------
// Generic helper
// ---------------------------------------------------------------------------

/**
 * `sendEmail` never throws — it returns `false` on a Resend error or a
 * bounce-suppressed address (see its own docstring). Discarding that boolean
 * is the exact defect class already fixed once in this repo for
 * `sendRosterAddedEmail`/`sendBackgroundCheckEmail`. An admin alert has no
 * caller to report back to, so the loud half has to happen right here — in
 * ONE place, shared by every alert function below, so a new caller inherits
 * it by construction rather than needing its own copy. Split out from
 * `sendAdminAlert` when `sendImpersonationStartAlert`'s own recipient-
 * filtering logic (excluding the acting admin) meant it couldn't just call
 * that function directly, and had — until a red-team review caught it —
 * silently NOT inherited this fix as a result.
 */
async function sendToRecipients(
	recipients: string[],
	subject: string,
	html: string,
	opts?: { isCritical?: boolean },
): Promise<void> {
	const results = await Promise.all(
		recipients.map(async (email) => ({
			email,
			sent: await sendEmail(email, subject, html, opts),
		})),
	);
	for (const { email, sent } of results) {
		if (!sent) {
			console.error(
				`[adminAlerts] Failed to send "${subject}" to ${email} — sendEmail returned false (Resend error or bounce-suppressed).`,
			);
		}
	}
}

/** Resolves every platform admin and sends to all of them via `sendToRecipients`. */
async function sendAdminAlert(
	subject: string,
	html: string,
	opts?: { isCritical?: boolean },
): Promise<void> {
	let recipients: string[];
	try {
		recipients = await getAdminEmails();
	} catch (err) {
		console.error('[adminAlerts] Failed to resolve admin recipients:', err);
		return;
	}

	if (recipients.length === 0) {
		console.warn('[adminAlerts] No recipients configured — alert not sent.');
		return;
	}

	await sendToRecipients(recipients, subject, html, opts);
}

// ---------------------------------------------------------------------------
// Signup alerts
// ---------------------------------------------------------------------------

function sanitizeSubject(value: string): string {
	return value.replace(/[\r\n]+/g, ' ');
}

export async function sendNewUserAlert(user: {
	id: string;
	email: string | null;
	name: string | null;
}): Promise<void> {
	const appUrl = process.env.NEXTAUTH_URL ?? '';
	const subject = `New user signed up: ${sanitizeSubject(user.email ?? user.id)}`;
	const html = `
		<p>A new user just signed up on VolunteerReady.</p>
		<table style="border-collapse: collapse; margin: 16px 0;">
			<tr><td style="padding: 4px 8px;"><strong>Name:</strong></td><td style="padding: 4px 8px;">${escapeHtml(user.name ?? '—')}</td></tr>
			<tr><td style="padding: 4px 8px;"><strong>Email:</strong></td><td style="padding: 4px 8px;">${escapeHtml(user.email ?? '—')}</td></tr>
			<tr><td style="padding: 4px 8px;"><strong>User ID:</strong></td><td style="padding: 4px 8px;">${escapeHtml(user.id)}</td></tr>
		</table>
		${appUrl ? `<p><a href="${appUrl}/app/admin/platform/users/${escapeHtml(user.id)}" style="color: #1B3C2A;">View user &rarr;</a></p>` : ''}
	`;
	await sendAdminAlert(subject, html);
}

export async function sendNewOrgAlert(org: {
	id: string;
	name: string;
	slug: string;
}): Promise<void> {
	const appUrl = process.env.NEXTAUTH_URL ?? '';
	const subject = `New nonprofit registered: ${sanitizeSubject(org.name)}`;
	const html = `
		<p>A new nonprofit organization was created on VolunteerReady.</p>
		<table style="border-collapse: collapse; margin: 16px 0;">
			<tr><td style="padding: 4px 8px;"><strong>Name:</strong></td><td style="padding: 4px 8px;">${escapeHtml(org.name)}</td></tr>
			<tr><td style="padding: 4px 8px;"><strong>Slug:</strong></td><td style="padding: 4px 8px;">${escapeHtml(org.slug)}</td></tr>
			<tr><td style="padding: 4px 8px;"><strong>Org ID:</strong></td><td style="padding: 4px 8px;">${escapeHtml(org.id)}</td></tr>
		</table>
		${appUrl ? `<p><a href="${appUrl}/app/admin/platform/orgs/${escapeHtml(org.id)}" style="color: #1B3C2A;">View organization &rarr;</a></p>` : ''}
	`;
	await sendAdminAlert(subject, html);
}

export async function sendNewCompanyAlert(company: {
	id: string;
	name: string;
	slug: string;
}): Promise<void> {
	const appUrl = process.env.NEXTAUTH_URL ?? '';
	const subject = `New company registered: ${sanitizeSubject(company.name)}`;
	const html = `
		<p>A new corporate partner account was created on VolunteerReady.</p>
		<table style="border-collapse: collapse; margin: 16px 0;">
			<tr><td style="padding: 4px 8px;"><strong>Name:</strong></td><td style="padding: 4px 8px;">${escapeHtml(company.name)}</td></tr>
			<tr><td style="padding: 4px 8px;"><strong>Slug:</strong></td><td style="padding: 4px 8px;">${escapeHtml(company.slug)}</td></tr>
			<tr><td style="padding: 4px 8px;"><strong>Company ID:</strong></td><td style="padding: 4px 8px;">${escapeHtml(company.id)}</td></tr>
		</table>
		${appUrl ? `<p><a href="${appUrl}/app/admin/platform" style="color: #1B3C2A;">View platform admin &rarr;</a></p>` : ''}
	`;
	await sendAdminAlert(subject, html);
}

// ---------------------------------------------------------------------------
// Security alerts
// ---------------------------------------------------------------------------

export type ImpersonationAlertInput = {
	adminEmail: string | null;
	adminUserId: string;
	targetEmail: string | null;
	targetUserId: string;
	reason: string;
	expiresAt: Date;
	sessionId: string;
};

export async function sendImpersonationStartAlert(
	input: ImpersonationAlertInput,
): Promise<void> {
	let recipients: string[];
	try {
		recipients = await getAdminEmails();
	} catch (err) {
		console.error('[adminAlerts] Failed to resolve admin recipients:', err);
		return;
	}

	const filtered = input.adminEmail
		? recipients.filter(
				(r) => r.toLowerCase() !== input.adminEmail?.toLowerCase(),
			)
		: recipients;

	if (filtered.length === 0) {
		console.warn(
			'[adminAlerts] No recipients for impersonation alert (admin acting on themselves or no other admins).',
		);
		return;
	}

	const appUrl = process.env.NEXTAUTH_URL ?? '';
	const subject = `[Security] Impersonation started by ${sanitizeSubject(input.adminEmail ?? input.adminUserId)}`;
	const html = `
		<p>A platform admin started an impersonation session.</p>
		<table style="border-collapse: collapse; margin: 16px 0;">
			<tr><td style="padding: 4px 8px;"><strong>Admin:</strong></td><td style="padding: 4px 8px;">${escapeHtml(input.adminEmail ?? input.adminUserId)}</td></tr>
			<tr><td style="padding: 4px 8px;"><strong>Target:</strong></td><td style="padding: 4px 8px;">${escapeHtml(input.targetEmail ?? input.targetUserId)}</td></tr>
			<tr><td style="padding: 4px 8px;"><strong>Reason:</strong></td><td style="padding: 4px 8px;">${escapeHtml(input.reason)}</td></tr>
			<tr><td style="padding: 4px 8px;"><strong>Expires:</strong></td><td style="padding: 4px 8px;">${input.expiresAt.toISOString()}</td></tr>
			<tr><td style="padding: 4px 8px;"><strong>Session:</strong></td><td style="padding: 4px 8px;">${escapeHtml(input.sessionId)}</td></tr>
		</table>
		${appUrl ? `<p><a href="${appUrl}/app/admin/platform/audit?impersonatedOnly=true" style="color: #1B3C2A;">Review impersonation activity &rarr;</a></p>` : ''}
		<p style="color: #666; font-size: 12px; margin-top: 16px;">If this was not authorized, revoke the admin's sessions immediately at <code>/app/admin/platform/users/${escapeHtml(input.adminUserId)}</code>.</p>
	`;

	await sendToRecipients(filtered, subject, html, { isCritical: true });
}

/**
 * The `advisory-scan-heartbeat` cron's own dispatch to GitHub failed — this is
 * NOT a business-logic email, it's "the thing that keeps the security-
 * advisories scan running while `main` is idle just broke." `isCritical:
 * true` for the same reason `sendImpersonationStartAlert` uses it: this is a
 * security-relevant notice, not a candidate for bounce-suppression.
 *
 * `withCronAuth` already writes a `CronJobRun` row with `status: 'FAILURE'`
 * on the thrown error this pairs with, but nobody proactively watches that
 * table — this is the loud half, matching the repo's own rule (see
 * docs/TODOS.md's `sendEmail`-returns-false entries) that a fire-and-forget
 * failure must not just log somewhere nobody is looking.
 */
export async function sendAdvisoryDispatchFailureAlert(
	details: string,
): Promise<void> {
	const subject = '[Security] advisory-scan-heartbeat failed to dispatch';
	const html = `
		<p>The weekly Vercel cron that keeps the <code>security-advisories-scheduled.yml</code>
		workflow running (in case GitHub's own <code>schedule:</code> trigger
		auto-disables from repo inactivity) failed to dispatch it via GitHub's API.</p>
		<table style="border-collapse: collapse; margin: 16px 0;">
			<tr><td style="padding: 4px 8px;"><strong>Details:</strong></td><td style="padding: 4px 8px;">${escapeHtml(details)}</td></tr>
		</table>
		<p style="color: #666; font-size: 12px; margin-top: 16px;">See docs/branch-protection.md and .github/workflows/security-advisories-scheduled.yml for context. Check whether GITHUB_ADVISORY_DISPATCH_TOKEN has expired.</p>
	`;
	await sendAdminAlert(subject, html, { isCritical: true });
}
