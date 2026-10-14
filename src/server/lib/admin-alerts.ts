import {
	SCAN_MAX_AGE_HOURS,
	type ScanFailure,
	type ScanProblem,
} from '@/server/domain/advisory-scan-result';
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
 * The `advisory-scan-heartbeat` cron itself failed: its token is missing, or
 * a GitHub API call (state check, enable, reading the last scan, dispatch)
 * failed or returned something unreadable. `details` names which. This is
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
	const subject = '[Security] advisory-scan-heartbeat failed';
	const html = `
		<p>The daily Vercel cron that keeps the <code>security-advisories-scheduled.yml</code>
		workflow running (in case GitHub's own <code>schedule:</code> trigger
		auto-disables from repo inactivity) and checks its results could not
		finish: its token is missing, or a GitHub API call failed or returned
		something it could not read. The details below name which.</p>
		<table style="border-collapse: collapse; margin: 16px 0;">
			<tr><td style="padding: 4px 8px;"><strong>Details:</strong></td><td style="padding: 4px 8px;">${escapeHtml(details)}</td></tr>
		</table>
		<p style="color: #666; font-size: 12px; margin-top: 16px;">See docs/branch-protection.md and .github/workflows/security-advisories-scheduled.yml for context. Check whether GITHUB_ADVISORY_DISPATCH_TOKEN is set in Vercel and has not expired.</p>
	`;
	await sendAdminAlert(subject, html, { isCritical: true });
}

/**
 * One subject and lead sentence per problem: a skim or an inbox rule has to
 * tell "found an advisory" from "stopped scanning" from "switched off".
 */
const SCAN_PROBLEM_COPY: Record<
	ScanProblem,
	{ subject: string; lead: string; action: string }
> = {
	failed: {
		subject: '[Security] Scheduled advisory scan failed',
		lead: 'Its latest run on <code>main</code> did not pass, so a fixable high or critical advisory may be open.',
		action:
			'Run <code>pnpm tsx scripts/check-advisories.ts</code> locally to see which advisories are open, then upgrade or override the affected packages.',
	},
	inconclusive: {
		subject: '[Security] Scheduled advisory scan did not finish',
		lead: 'Its latest run on <code>main</code> ended without a verdict (cancelled, timed out, skipped or failed to start), so the dependencies were not checked.',
		action:
			'Open the run from the GitHub Actions tab. A cancelled or timed-out run can be re-run there. A <code>startup_failure</code> conclusion (see Details) means GitHub rejected the workflow file or an action it uses, so a re-run fails the same way: fix the workflow on <code>main</code> instead.',
	},
	missing: {
		subject: '[Security] Scheduled advisory scan has never completed',
		lead: 'It has no completed run on <code>main</code>, so the production dependencies have not been scanned.',
		action:
			'Open the workflow in the GitHub Actions tab and check that it exists on <code>main</code> and that its runs start.',
	},
	stale: {
		subject: '[Security] Scheduled advisory scan has stopped running',
		lead: `Its latest run passed, but that run is more than ${SCAN_MAX_AGE_HOURS} hours old, so new advisories are not being checked.`,
		action:
			'Open the workflow in the GitHub Actions tab and check why its daily runs stopped (queued, cancelled or never started).',
	},
	disabled: {
		subject: '[Security] Scheduled advisory scan is disabled',
		lead: 'Someone disabled the workflow in GitHub, so no scans run until it is re-enabled. The heartbeat does not override that.',
		action:
			'If the pause is over, re-enable the workflow in the GitHub Actions tab. The next heartbeat dispatches a scan.',
	},
};

/**
 * The heartbeat found a problem with the scheduled advisory scan: the last
 * run failed, ended without a verdict, is missing or is stale
 * (`assessLastScan()`), or a human has
 * disabled the workflow (`disabled`, set by the heartbeat). Without this, a scan that found a fixable
 * advisory reported only through GitHub's own workflow-failure email, which
 * went unread for the 2026-10-12 run. Sent on every heartbeat while the scan
 * stays red: an unfixed high-severity advisory is worth a daily reminder.
 * Critical, so bounce suppression cannot swallow it.
 */
export async function sendAdvisoryScanResultAlert(
	input: Omit<ScanFailure, 'ok'>,
): Promise<void> {
	const runLink = input.runUrl
		? `<tr><td style="padding: 4px 8px;"><strong>Run:</strong></td><td style="padding: 4px 8px;"><a href="${escapeHtml(input.runUrl)}">${escapeHtml(input.runUrl)}</a></td></tr>`
		: '';
	const { subject, lead, action } = SCAN_PROBLEM_COPY[input.problem];
	const html = `
		<p>The <code>security-advisories-scheduled.yml</code> workflow runs
		<code>pnpm audit</code> against the production dependencies every day.
		${lead}</p>
		<table style="border-collapse: collapse; margin: 16px 0;">
			<tr><td style="padding: 4px 8px;"><strong>Details:</strong></td><td style="padding: 4px 8px;">${escapeHtml(input.details)}</td></tr>
			${runLink}
		</table>
		<p>${action}</p>
		<p style="color: #666; font-size: 12px; margin-top: 16px;">This repeats on every daily heartbeat until it is resolved. See docs/branch-protection.md.</p>
	`;
	await sendAdminAlert(subject, html, { isCritical: true });
}

/**
 * A Stripe webhook names a price that `PRICE_MAP` in billingService.ts does not
 * know, usually a `STRIPE_PRICE_ID_*` env var that is missing or points at a
 * different price. The webhook keeps answering 500, so Stripe retries the
 * event for up to three days and the plan catches up on its own once the
 * mapping is fixed. Nothing else would tell anyone it needs fixing. Critical,
 * like the other operational alerts, so bounce suppression cannot swallow it.
 */
export async function sendUnknownStripePriceAlert(input: {
	priceId: string;
	eventId: string;
	eventType: string;
	customerId: string | null;
	/** The env vars that map prices to tiers, from billingService's PRICE_MAP. */
	priceEnvVars: string[];
}): Promise<void> {
	const subject = '[Billing] Stripe price not recognised by the app';
	const html = `
		<p>A Stripe webhook refers to a price the app cannot map to a plan, so the
		organization's or company's plan was not updated. Stripe will keep
		retrying the event for up to three days.</p>
		<table style="border-collapse: collapse; margin: 16px 0;">
			<tr><td style="padding: 4px 8px;"><strong>Price:</strong></td><td style="padding: 4px 8px;">${escapeHtml(input.priceId)}</td></tr>
			<tr><td style="padding: 4px 8px;"><strong>Event:</strong></td><td style="padding: 4px 8px;">${escapeHtml(input.eventId)} (${escapeHtml(input.eventType)})</td></tr>
			<tr><td style="padding: 4px 8px;"><strong>Stripe customer:</strong></td><td style="padding: 4px 8px;">${escapeHtml(input.customerId ?? 'unknown')}</td></tr>
		</table>
		<p>If many customers are affected, check that ${input.priceEnvVars.map((v) => `<code>${escapeHtml(v)}</code>`).join(' and ')}
		are set in this environment and match the prices in the Stripe dashboard.
		If it is one customer, their subscription may be on an older price. Once
		the price maps to a plan, the next retry applies it. After three days,
		replay the event from the Stripe reconcile on /app/admin/health.</p>
	`;
	await sendAdminAlert(subject, html, { isCritical: true });
}
