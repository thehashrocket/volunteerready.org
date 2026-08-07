import { BASE_URL } from '@/lib/constants';
import {
	CREDENTIAL_EXPIRY_NOTICE_ORG_CAP,
	CREDENTIAL_EXPIRY_WARNING_DAYS,
	credentialExpiryNoticeBody,
	credentialExpiryNoticeSubject,
	credentialExpiryNoticeTitle,
	daysUntilExpiry,
	type ExpiringCredentialFact,
	groupCredentialsByOrg,
	NOTICE_SEND_DELAY_MS,
	type OrgExpiringCredentials,
	type RecipientNoticeOutcome,
	shouldStampNotifiedAt,
} from '../domain/credential-expiry';
import { CREDENTIAL_LABELS } from '../domain/volunteer-profile';
import { escapeHtml } from '../lib/html';
import { writeAuditLogTx } from '../repositories/auditRepo';
import {
	findExpiryNoticeCredentialsForOrgs,
	findOrgsNeedingExpiryNotice,
	markCredentialsNotifiedTx,
} from '../repositories/credential-expiry-repo';
import { findOrgStaffRecipients } from '../repositories/orgRepo';
import { prisma } from '../repositories/prisma';
import { tryNotify } from './notificationService';

/** Existing staff surface listing the org's credentials. No new page. */
const CREDENTIAL_REVIEW_HREF = '/app/settings/background-checks';

/**
 * Counters for `CronJobRun.resultSummary`, which is what `/app/admin/health`
 * renders.
 *
 * Deliberately more than a single success count, because the question a human
 * asks of that dashboard is "is this job healthy", and one number cannot
 * distinguish "nothing was due tonight" from "everything failed" — both show
 * zero notices sent. `credentialsScanned` separates them, and the failure
 * split says which subsystem to look at without opening the logs.
 */
export type CredentialExpiryNoticeSummary = {
	credentialsScanned: number;
	credentialsNotified: number;
	credentialsUnresolved: number;
	orgsProcessed: number;
	orgsWithNoRecipients: number;
	noticeEmailsSent: number;
	noticeEmailsFailed: number;
	orgCapReached: boolean;
};

/** What one org's pass contributed. Folded by the caller — never mutated in place. */
type OrgNoticeDelta = {
	notified: number;
	unresolved: number;
	emailsSent: number;
	emailsFailed: number;
	hadNoRecipients: boolean;
};

const EMPTY_DELTA: OrgNoticeDelta = {
	notified: 0,
	unresolved: 0,
	emailsSent: 0,
	emailsFailed: 0,
	hadNoRecipients: false,
};

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Warn org staff about volunteer credentials approaching their expiry date.
 *
 * One summary per org per OWNER/ADMIN — an in-app notification and an email,
 * both gated by that recipient's own `CREDENTIAL_EXPIRY` preference. Runs as
 * one branch of the existing `expire-credentials` cron.
 *
 * Idempotency is `VolunteerCredential.notifiedAt`, read through
 * `credentialNoticeCycleStart` rather than as a bare null check, so a RENEWED
 * credential is warned about again on its new expiry date. The first version
 * used `notifiedAt: null` and therefore warned about each credential exactly
 * once in its lifetime — which, since annual re-issue reuses the same row,
 * meant every renewal after the first expired in silence.
 *
 * The run is bounded by ORGS, not credentials, so a bundle is never truncated
 * mid-email, and sends are paced because a 429 is not self-healing here.
 */
export async function notifyStaffOfExpiringCredentials(
	now: Date = new Date(),
): Promise<CredentialExpiryNoticeSummary> {
	const orgIds = await findOrgsNeedingExpiryNotice(now);
	const due = await findExpiryNoticeCredentialsForOrgs(now, orgIds);

	const summary: CredentialExpiryNoticeSummary = {
		credentialsScanned: due.length,
		credentialsNotified: 0,
		credentialsUnresolved: 0,
		orgsProcessed: 0,
		orgsWithNoRecipients: 0,
		noticeEmailsSent: 0,
		noticeEmailsFailed: 0,
		orgCapReached: orgIds.length >= CREDENTIAL_EXPIRY_NOTICE_ORG_CAP,
	};

	if (due.length === 0) return summary;

	const facts: ExpiringCredentialFact[] = due.map((row) => ({
		credentialId: row.id,
		orgId: row.orgId,
		orgName: row.organization.name,
		volunteerName: row.user.name ?? 'A volunteer',
		typeLabel: CREDENTIAL_LABELS[row.type],
		// Non-null by construction: the query filters on an `expiresAt` range.
		expiresAt: row.expiresAt as Date,
	}));

	// Paced across the WHOLE run, not per org — Resend's limit is per account.
	const pace = { sends: 0 };

	for (const bundle of groupCredentialsByOrg(facts)) {
		summary.orgsProcessed++;
		let delta: OrgNoticeDelta;
		try {
			delta = await notifyOneOrg(bundle, now, pace);
		} catch (err) {
			// Per-org isolation: one org's failure must not cost every later org
			// its notice. Unstamped, so the batch is retried tomorrow.
			delta = { ...EMPTY_DELTA, unresolved: bundle.items.length };
			console.error(
				`[cron] Failed to notify org ${bundle.orgId} of ${bundle.items.length} expiring credential(s)`,
				err,
			);
		}
		summary.credentialsNotified += delta.notified;
		summary.credentialsUnresolved += delta.unresolved;
		summary.noticeEmailsSent += delta.emailsSent;
		summary.noticeEmailsFailed += delta.emailsFailed;
		if (delta.hadNoRecipients) summary.orgsWithNoRecipients++;
	}

	return summary;
}

/**
 * Notify one org's staff and, if nobody's notice failed, stamp its batch.
 *
 * Returns a delta rather than mutating a shared summary. The invariant the
 * health dashboard depends on — `notified + unresolved === scanned` — is then a
 * single fold in the caller instead of an audit of every early return in here.
 */
async function notifyOneOrg(
	bundle: OrgExpiringCredentials,
	now: Date,
	pace: { sends: number },
): Promise<OrgNoticeDelta> {
	const recipients = await findOrgStaffRecipients(bundle.orgId);

	if (recipients.length === 0) {
		// Should be unreachable: the query requires at least one OWNER/ADMIN.
		// Reachable only if the last one left between the two queries.
		console.warn(
			`[cron] Org ${bundle.orgId} lost its last OWNER/ADMIN mid-run — ${bundle.items.length} credential(s) left unstamped`,
		);
		return {
			...EMPTY_DELTA,
			unresolved: bundle.items.length,
			hadNoRecipients: true,
		};
	}

	const subject = credentialExpiryNoticeSubject(
		bundle.items.length,
		bundle.orgName,
	);
	const html = buildNoticeHtml(bundle, now);

	const outcomes: RecipientNoticeOutcome[] = [];
	let emailsSent = 0;
	let emailsFailed = 0;

	for (const recipient of recipients) {
		// Paced BEFORE the send and only for recipients who get mail, so an
		// org of in-app-only recipients costs nothing.
		if (recipient.user.email) {
			if (pace.sends > 0) await sleep(NOTICE_SEND_DELAY_MS);
			pace.sends++;
		}

		const result = await tryNotify({
			userId: recipient.userId,
			orgId: bundle.orgId,
			type: 'CREDENTIAL_EXPIRY',
			title: credentialExpiryNoticeTitle(bundle.items.length),
			body: credentialExpiryNoticeBody(bundle.items.length, bundle.orgName),
			href: CREDENTIAL_REVIEW_HREF,
			// A recipient with no address still gets the in-app half rather than
			// being skipped outright — unlike the re-engagement cron, which is
			// email-only by definition.
			...(recipient.user.email
				? {
						emailTo: recipient.user.email,
						emailSubject: subject,
						emailHtml: html,
					}
				: {}),
		});

		if (result.emailSent === true) emailsSent++;
		if (result.emailSent === false) {
			emailsFailed++;
			console.error(
				`[cron] Credential expiry notice not delivered to ${recipient.userId} at org ${bundle.orgId}`,
			);
		}

		outcomes.push({ emailFailed: result.emailSent === false });
	}

	if (!shouldStampNotifiedAt(outcomes)) {
		console.error(
			`[cron] Delivery failed for org ${bundle.orgId} — ${bundle.items.length} credential(s) left unstamped for retry`,
		);
		return {
			...EMPTY_DELTA,
			unresolved: bundle.items.length,
			emailsSent,
			emailsFailed,
		};
	}

	const credentialIds = bundle.items.map((item) => item.credentialId);

	// The stamp and its audit row go in ONE transaction. `notifiedAt` is
	// otherwise the sole record that a warning was issued — a bare timestamp
	// with no actor, no run and no outcome — so a bad night could not be
	// identified afterwards, let alone repaired. `actorId: null` is this repo's
	// convention for a cron actor (see `CREDENTIAL_AUTO_EXPIRED`), and
	// `pnpm credentials:reset-notice` is the matching undo.
	const { count } = await prisma.$transaction(async (tx) => {
		const result = await markCredentialsNotifiedTx(tx, credentialIds, now);
		await writeAuditLogTx(tx, {
			orgId: bundle.orgId,
			actorId: null,
			action: 'CREDENTIAL_EXPIRY_NOTICE_SENT',
			entityType: 'Organization',
			entityId: bundle.orgId,
			metadata: {
				credentialIds,
				stamped: result.count,
				recipients: recipients.length,
				emailsSent,
				emailsFailed,
			},
		});
		return result;
	});

	// Count what the stamp actually WROTE. `count` is short when a concurrent
	// run got there first; reporting the batch size would tell the health
	// dashboard we warned about more credentials than any run of this job did.
	return {
		notified: count,
		unresolved: bundle.items.length - count,
		emailsSent,
		emailsFailed,
		hadNoRecipients: false,
	};
}

/**
 * The summary email body.
 *
 * `volunteerName` and `orgName` are user-controlled strings landing in someone
 * else's inbox as HTML, so both are escaped. `typeLabel` comes from the closed
 * `CREDENTIAL_LABELS` map and is not.
 */
function buildNoticeHtml(bundle: OrgExpiringCredentials, now: Date): string {
	const rows = bundle.items
		.map((item) => {
			// Clamped at 1: the query selects `expiresAt > now`, but the two
			// queries in this cron can straddle midnight-ish boundaries and
			// "expires in 0 days" reads as a bug to the coordinator.
			const days = Math.max(1, daysUntilExpiry(item.expiresAt, now));
			return `<li style="margin-bottom: 6px;"><strong>${escapeHtml(item.volunteerName)}</strong> — ${item.typeLabel}, expires in ${days} day${days === 1 ? '' : 's'}</li>`;
		})
		.join('');

	return `
		<h2>${credentialExpiryNoticeTitle(bundle.items.length)}</h2>
		<p>These volunteer credentials at <strong>${escapeHtml(bundle.orgName)}</strong> expire within the next ${CREDENTIAL_EXPIRY_WARNING_DAYS} days:</p>
		<ul style="margin: 0; padding-left: 20px;">${rows}</ul>
		<p>Renew or re-issue them before they lapse so these volunteers can keep taking shifts.</p>
		<p style="margin-top: 24px;">
			<a href="${process.env.NEXTAUTH_URL || BASE_URL}${CREDENTIAL_REVIEW_HREF}"
			   style="background-color: #1B3C2A; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
				Review credentials
			</a>
		</p>
		<p style="color: #787571; font-size: 0.875rem;">Make sure <strong>${escapeHtml(bundle.orgName)}</strong> is your selected organization when you open that page.</p>
	`;
}
