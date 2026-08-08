/**
 * credential-expiry.ts — the credential expiry warning window.
 *
 * Pure functions, constants and types only. No Prisma, no framework imports,
 * so both the cron service and the client components that quote the number can
 * import it.
 */

/**
 * Days before `VolunteerCredential.expiresAt` that a warning fires.
 *
 * Every surface that states this window derives it from here. Two do it by
 * importing the constant — `getVolunteerDashboard()`'s query and
 * `volunteer-dashboard.tsx`'s empty state — two more by importing
 * `credentialExpiryWindowEnd()` and the notice copy builders below, and the
 * prose that cannot import anything (`/screening`, `release-notes.ts`) is held
 * by `credential-expiry.copy.test.ts`. Count them off that test, not off this
 * comment: an earlier version of this docstring said "FOUR surfaces" and was an
 * undercount on the day it was written.
 *
 * The pre-existing copies were unbound literals — two numeric, one prose —
 * before the staff notifier needed the same window and made the drift concrete.
 * A coordinator who reads "30 days" on the marketing page and gets warned at 14
 * has been told something false, and nothing would have failed.
 *
 * NOT the same thing as `SHARE_TOKEN_EXPIRY_DAYS` in `credential-sharing.ts`,
 * which is a share token's own lifetime rather than a lead time on someone
 * else's expiry. They are equal today by coincidence. Do not merge them.
 */
export const CREDENTIAL_EXPIRY_WARNING_DAYS = 30;

/**
 * How many ORGS one run will notify.
 *
 * The cap is on orgs rather than credentials, and that is a correctness
 * requirement rather than a tuning choice. A credential-keyed cap truncates
 * whichever org happens to straddle the limit, and the email that org receives
 * says "These volunteer credentials expire within the next 30 days" — a
 * complete-sounding list that silently omits the rest. On the FIRST production
 * run every credential in the window is due at once, so that is the normal
 * case, not an edge case. Capping by org means a bundle is served whole or not
 * at all.
 *
 * The number is set by the SEND budget, not the scan: sends are paced at
 * `NOTICE_SEND_DELAY_MS` and the cron has `maxDuration = 300`. At 3 recipients
 * per org that is 50 x 3 x 600ms = 90s of pacing, leaving room for the DB
 * round trips and the three sibling services sharing the invocation.
 */
export const CREDENTIAL_EXPIRY_NOTICE_ORG_CAP = 50;

/**
 * Pacing between sends, matching `DEFAULT_NOTIFY_DELAY_MS` in the concierge
 * importer — Resend allows 2 req/s.
 *
 * This exists because the original "unpaced is safe, a 429 just retries
 * tomorrow" reasoning was WRONG, and wrong in the direction that loses mail.
 * The retry it relied on never fired: a recipient's in-app notification always
 * succeeds, so the batch was stamped and the failed email was never re-sent.
 * The threshold is fixed too (see `shouldStampNotifiedAt`), but pacing is what
 * stops the 429 happening in the first place — and without it a rate-limited
 * batch would be retried at exactly the same shape every night.
 */
export const NOTICE_SEND_DELAY_MS = 600;

/** One credential inside a per-org staff warning. */
export type ExpiringCredentialFact = {
	credentialId: string;
	orgId: string;
	orgName: string;
	/** Already defaulted by the caller — never the raw nullable `User.name`. */
	volunteerName: string;
	/** Human label, already resolved through `CREDENTIAL_LABELS`. */
	typeLabel: string;
	expiresAt: Date;
};

/** Every credential at one org that is entering the window together. */
export type OrgExpiringCredentials = {
	orgId: string;
	orgName: string;
	items: ExpiringCredentialFact[];
};

/** Whole days until `expiresAt`, rounded up. */
export function daysUntilExpiry(expiresAt: Date, now: Date): number {
	return Math.ceil(
		(expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
	);
}

/**
 * The far edge of the warning window.
 *
 * Exists because sharing the NUMBER is not enough — the two queries that use it
 * computed the date two different ways. The notifier used
 * `windowEnd.setDate(getDate() + 30)`, which counts local CALENDAR days, and
 * the volunteer dashboard used `now + 30 * 86_400_000`, a fixed span of
 * milliseconds. Those disagree by an hour across a DST boundary in any
 * non-UTC timezone, so one surface would warn an hour before the other about
 * the same credential while both claimed to implement "30 days".
 *
 * Fixed-span arithmetic is the one to standardise on: this is a lead time on a
 * deadline, not a calendar appointment, and it keeps the boundary independent
 * of the server's timezone.
 */
export function credentialExpiryWindowEnd(now: Date): Date {
	return new Date(
		now.getTime() + CREDENTIAL_EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000,
	);
}

/**
 * The instant before which a `notifiedAt` stamp belongs to an EARLIER expiry
 * cycle and must not suppress a fresh warning.
 *
 * This is what makes renewals work, and its absence was the worst defect in
 * the first version of this feature. `VolunteerCredential` is unique on
 * `(userId, orgId, type)`, so re-issuing a background check UPDATES the
 * existing row with a new `expiresAt` — and `upsertCredential`'s `update: data`
 * never touched `notifiedAt`. With a bare `notifiedAt: null` filter that row
 * was excluded forever, so every annual renewal after the first expired with no
 * warning at all. Silently, which is the exact failure this feature exists to
 * prevent.
 *
 * Why `now - WARNING_DAYS` is the right cutoff, and why it needs no column
 * comparison (Prisma cannot compare two columns in a `where` without raw SQL,
 * and raw SQL here would hit the Turbopack `Prisma.sql` hazard): the window is
 * only `WARNING_DAYS` long, so a warning about the credential's CURRENT expiry
 * can only have been issued within the last `WARNING_DAYS`. A stamp older than
 * that necessarily describes an expiry date the row no longer has. It also
 * self-heals an EXPIRED -> VERIFIED round trip for free.
 */
export function credentialNoticeCycleStart(now: Date): Date {
	return new Date(
		now.getTime() - CREDENTIAL_EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000,
	);
}

/**
 * Group a flat scan by org, preserving first-seen order.
 *
 * This is what makes "one summary per org" possible: the scan is global and
 * ordered by urgency, so one org's credentials arrive interleaved with
 * another's.
 */
export function groupCredentialsByOrg(
	facts: readonly ExpiringCredentialFact[],
): OrgExpiringCredentials[] {
	const byOrg = new Map<string, OrgExpiringCredentials>();
	for (const fact of facts) {
		const bundle = byOrg.get(fact.orgId);
		if (bundle) {
			bundle.items.push(fact);
		} else {
			byOrg.set(fact.orgId, {
				orgId: fact.orgId,
				orgName: fact.orgName,
				items: [fact],
			});
		}
	}
	return Array.from(byOrg.values());
}

/** How one recipient's notice went, as the stamp decision needs to see it. */
export type RecipientNoticeOutcome = {
	/** `sendEmail` returned false — a Resend rejection, a 429, a bounce block. */
	emailFailed: boolean;
};

/**
 * Should this org's batch be stamped, given how every recipient's notice went?
 *
 * The rule is "nobody we tried to reach FAILED", and the first version of this
 * function got it wrong in the direction that loses mail. It was
 * `deliveries.some(Boolean)` over `inAppSent || emailSent === true` — but
 * `inAppSent` is true whenever the recipient has in-app notices on, which is
 * the default. So a Resend 429 storm stamped every batch anyway and those
 * emails were gone for good, while the docstring next to it claimed they would
 * be retried tomorrow. The retry path was unreachable code.
 *
 * Three cases this has to keep apart:
 *
 *   - reached           -> no failure -> stamp.
 *   - opted out of BOTH channels -> no failure -> stamp. They chose not to be
 *     told; that is a respected preference, not a lost notice. Treating it as
 *     failure would make the org retry nightly forever and hold a slot under
 *     the org cap — the head-of-line problem this cap exists to bound.
 *   - email bounced or 429'd -> failure -> do NOT stamp. Costs a duplicate
 *     in-app row tomorrow, which is much the cheaper mistake.
 *
 * An empty list is `false`: an org with nobody to tell was not told. Those orgs
 * are excluded before they get here (`findOrgsNeedingExpiryNotice` requires at
 * least one OWNER/ADMIN) precisely so they cannot spin against the cap.
 */
export function shouldStampNotifiedAt(
	outcomes: readonly RecipientNoticeOutcome[],
): boolean {
	if (outcomes.length === 0) return false;
	return !outcomes.some((o) => o.emailFailed);
}

/** Email subject. Names the org — it lands in an inbox with no other context. */
export function credentialExpiryNoticeSubject(
	count: number,
	orgName: string,
): string {
	return `${count} volunteer credential${count === 1 ? '' : 's'} expiring soon at ${orgName}`;
}

/**
 * In-app notification title. Deliberately omits the org name: the bell is
 * already scoped to one org, and `Notification.title` is capped at 200 chars,
 * which a long org name plus this prefix could exceed.
 */
export function credentialExpiryNoticeTitle(count: number): string {
	return `${count} volunteer credential${count === 1 ? '' : 's'} expiring soon`;
}

/** In-app notification body. The itemised list lives in the email. */
export function credentialExpiryNoticeBody(
	count: number,
	orgName: string,
): string {
	return `${count} volunteer credential${count === 1 ? '' : 's'} at ${orgName} will expire within ${CREDENTIAL_EXPIRY_WARNING_DAYS} days. Review them before they lapse.`;
}
