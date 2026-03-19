# TODOS

Deferred work captured during CEO + engineering plan reviews for Phase 6.
Each item includes enough context for a future engineer to pick it up cold.

---

## Background Check Integration (Phase 6B)

### ~~[P1] FCRA Adverse Action Notices~~ ✅ Complete

**Completed:** v0.2.3 (2026-03-16)

Implemented in-app FCRA adverse action workflow: `FcraStatus` enum
(NONE → PRE_ADVERSE_SENT → ADVERSE_ACTION_SENT / RESOLVED), domain guards,
service methods (`sendPreAdverseNotice`, `finalizeAdverseAction`, `resolveFcra`),
volunteer-facing email templates with FCRA-required content, 5-day waiting period
enforcement, and staff UI buttons on CONSIDER rows.

---

### [P2] CONSIDER State Review UI Action (partially superseded)

**What:** "Review" button on CONSIDER rows in the Background Check Requests table that
pre-fills the existing `IssueCredentialDialog` with the volunteer's userId and
`type=BACKGROUND_CHECK`.

**Why:** Staff currently must navigate to the credential issue dialog separately. A contextual
action on the CONSIDER row removes friction for the most common post-check workflow.

**Context:** The `BackgroundCheckRequestsTable` in `src/app/(app)/app/credentials/page.tsx`
already renders `IssueCredentialDialog` for CONSIDER rows but wrapped as a trigger — the
current implementation opens the dialog inline. This TODO tracks making the UX more prominent
(e.g., a dedicated "Review & Issue" action that pre-populates all fields and focuses the modal).
No new backend code needed — `credentials.issue` tRPC mutation already exists.

**Note:** Partially superseded by the FCRA adverse action buttons added in the token encryption +
FCRA PR. CONSIDER rows now have "Pre-Adverse Notice", "Finalize Adverse Action", and "Issue
Credential" action buttons. A further UX polish pass could still improve the pre-fill experience.

**Effort:** S | **Priority:** P2 | **Depends on:** ✅ Phase 6B UI shipped

---

### [P3] Checkr Candidate ID Storage for Re-Screening

**What:** Store encrypted Checkr candidate ID on `BackgroundCheckRequest` to enable re-screening
without re-collecting SSN/DOB.

**Why:** Annual background check renewal is common for ongoing volunteers. Currently, each renewal
requires staff to re-collect PII. Storing the candidate ID (not PII itself) enables one-click
re-screening.

**Context:** In Phase 6B, `candidateId` is discarded after `initiateCheck()` in
`src/server/lib/adapters/background-check/checkr.ts` (see the NOTE in that file's header).
Storing it requires encrypted storage (AES-256 at application layer, or Postgres pgcrypto).
The `BackgroundCheckRequest` entity gains a `candidateIdEncrypted` field. A new
`recheckVolunteer(requestId)` service function calls `POST /v1/reports` with the stored
candidate ID — no PII re-entry. Also needs a Sterling adapter implementation for that provider.

**Effort:** M | **Priority:** P3 | **Depends on:** ✅ Phase 6B shipped, encryption infrastructure decision

---

### [P2] Encrypt Checkr OAuth Access Tokens at Rest

**What:** Encrypt `Organization.checkrAccessToken` before writing to DB and decrypt on read.

**Why:** OAuth access tokens are secrets with API-level permissions. Storing them in plaintext
means a DB dump or SQL injection exposes all per-org Checkr access. Defense-in-depth best practice
is to encrypt secrets at the application layer.

**Context:** `checkrAccessToken` was added in the `20260316050000_phase_6b_checkr_partner_oauth`
migration. Currently stored as plaintext `String?`. The encryption/decryption logic should live in
a new `src/server/lib/crypto.ts` utility (AES-256-GCM with a `CHECKR_TOKEN_ENCRYPTION_KEY` env var).
The two DB access points are `connectCheckrAccount` (write) and `getOrgCheckrToken` (read) in
`src/server/services/backgroundCheckService.ts` — add encrypt/decrypt calls at those sites only.
Do NOT encrypt `checkrAccountId` — it is a non-secret identifier.

**Pros:** Eliminates plaintext token exposure from DB breach or log leak.
**Cons:** Adds key rotation complexity; losing `CHECKR_TOKEN_ENCRYPTION_KEY` renders all tokens
unreadable (requires re-connect flow for all orgs).

**Effort:** ~~S~~ | **Priority:** ~~P2~~ | ✅ **Completed:** v0.2.3 (2026-03-16)

Token encryption implemented using AES-256-GCM in `src/server/lib/crypto.ts`.
`connectCheckrAccount` encrypts on write; `getOrgCheckrToken` decrypts on read via
`tryDecrypt` (graceful fallback for pre-existing plaintext tokens).

---

### [P3] Encryption Key Rotation for Checkr Tokens

**What:** Build a key rotation mechanism — support two keys simultaneously (old + new),
re-encrypt all tokens with the new key, then retire the old key.

**Why:** If the encryption key is ever compromised, you need to rotate it without downtime.
Currently there's no rotation path — losing the key renders all tokens unreadable (orgs must
re-connect Checkr).

**Context:** `src/server/lib/crypto.ts` currently reads a single key from
`CHECKR_TOKEN_ENCRYPTION_KEY`. Rotation requires: (1) a `CHECKR_TOKEN_ENCRYPTION_KEY_OLD` env
var, (2) `tryDecrypt` tries the new key first, falls back to old key, (3) a migration script
re-encrypts all tokens with the new key, (4) remove old key env var.

**Effort:** M | **Priority:** P3 | **Depends on:** ✅ Token encryption shipped

---

### [P3] FCRA Waiting Period Configuration

**What:** Make the 5-day FCRA waiting period configurable per-org or per-state.

**Why:** Some US states require different waiting periods (e.g., California requires 5 business
days, which differs from 5 calendar days). As orgs in different jurisdictions onboard, the
hardcoded 5 calendar days may need adjustment.

**Context:** `FCRA_WAITING_PERIOD_DAYS = 5` is a constant in `src/server/domain/background-check.ts`.
To make it configurable: (1) add a `fcraWaitingPeriodDays` field to `Organization`, (2) pass it
into `isWaitingPeriodElapsed` and `waitingPeriodDaysRemaining`, (3) add an admin setting UI.
Consider also a "business days" mode that excludes weekends.

**Effort:** S | **Priority:** P3 | **Depends on:** ✅ FCRA workflow shipped

---

## Billing & Payments

### ~~[P2] Plan Upgrade Confirmation Email~~ ✅ Complete

**Completed:** v0.9.0 (2026-03-18)

Implemented upgrade, payment failed, and cancellation billing emails in
`src/server/repositories/send-billing-emails.ts`. All three use the branded
`buildEmailHtml` template system. Dispatched via `trySendBillingEmail` helper
in `billingService.ts` (fire-and-forget, never crashes webhook). Supports both
org and company entities. Upgrade email fires only on `subscription.created`
(not `updated`).

---

### ~~[P2] Plan-Gated Feature UI Hints~~ ✅ Complete

**Completed:** v0.11.1 (2026-03-19)

Self-contained `<PlanGate>` component at `src/components/plan-gate.tsx` queries
`billing.getBillingStatus`, compares `TIER_RANK`, and renders children or an upgrade
prompt with lock icon + "Upgrade to {tier}" CTA. Applied to analytics (PRO) and
shift templates (STARTER). Replaces inline upgrade prompts.

---

### [P2] Stripe Webhook Event Reconciliation

**What:** Investigate Stripe's event reconciliation API as a recovery mechanism
for webhooks that fail during a deploy window.

**Why:** The `StripeWebhookEvent` idempotency table handles normal retries, but
if a webhook arrives while the DB is briefly unavailable (e.g., during a migration
deploy), the event could be lost. Stripe retries for 3 days, but a sustained
outage could cause permanent loss.

**Context:** Stripe provides a "list events" API that can be used to poll for
events within a time window. A recovery script or admin tool could replay missed
events by checking the idempotency table for gaps. The `StripeWebhookEvent` table
stores `eventId`, `type`, and `processedAt`.

**Pros:** Prevents revenue/billing state corruption during deploy incidents.
**Cons:** Additional complexity; Stripe dashboard already shows failed webhooks for
manual recovery, which is acceptable at Phase 6 scale.

**Effort:** M | **Priority:** P2 | **Depends on:** ✅ 6A Stripe integration shipped

---

## Credentialing

### ~~[P2] CredentialShareToken Expiry Notification Email~~ ✅ Complete

**Completed:** v0.12.0 (2026-03-19)

Implemented in `share-token-expiry-service.ts`. Queries ACTIVE tokens expiring within
7 days where `notifiedAt IS NULL`, sends branded email with days-left count, sets
`notifiedAt` for idempotency. Runs as part of the daily `/api/cron/expire-credentials`
cron job (03:00 UTC). Per-record try/catch with P2025 race handling.

### [P2] Sterling Background Check Provider Integration

**What:** Implement `SterlingAdapter` implementing the `BackgroundCheckAdapter` interface.

**Why:** Some enterprise nonprofit clients prefer Sterling (especially large healthcare/
social service orgs). The Phase 6 `BackgroundCheckAdapter` interface is already
defined to support multi-provider; Sterling just needs a concrete implementation.

**Context:** `BackgroundCheckProvider` enum is `CHECKR | STERLING`. The adapter
interface lives in `src/server/lib/adapters/background-check/types.ts`. Sterling's
API is similar to Checkr's (REST + webhooks). Requires a Sterling account and API
credentials. Start by replicating the `CheckrAdapter` and mapping Sterling's response
schema to the shared `BackgroundCheckResult` type.

**Pros:** Unlocks a second enterprise segment; no architecture changes needed.
**Cons:** Sterling API quirks may require adapter interface extension; needs a test account.

**Effort:** M | **Priority:** P2 | **Depends on:** 6B Checkr integration shipped, Sterling API access

---

## Volunteer Identity

### ~~[P1] Volunteer Impact Public Page (`/v/[userId]`)~~ ✅ Complete

**Completed:** Phase 7 PR1+PR2 (2026-03-17)

Implemented `/v/[userId]` public identity page (PUBLIC visibility only), OG share card at
`/api/share-card/[userId]` with Fraunces font, `volunteerIdentityService` with
`getPublicProfile` (PUBLIC) and `getOrgVisibleProfile` (PUBLIC + ORGS_ONLY for screeners),
`computeTenure` + `computeReliabilityScore` domain functions, tenure badge display,
`VolunteerIdentityPanel` on application screener page. No PII exposed.

### [P3] LinkedIn "Add to Profile" Deep Link for Verified Credentials

**What:** "Add to LinkedIn" button on volunteer credential badges that deep-links
to LinkedIn's "Add certification" flow with pre-filled credential data.

**Why:** Volunteers are motivated to earn credentials they can display publicly.
LinkedIn integration makes VolunteerReady credentials feel real and valuable.

**Context:** LinkedIn provides a URL scheme for adding certifications:
`https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=...&organizationId=...`
This requires a LinkedIn Partner Organization ID. The credential data maps to:
certification name, issuing org, issue date, expiry date, credential URL.

**Pros:** High viral/network value; low implementation effort once LinkedIn Partner ID is obtained.
**Cons:** Requires LinkedIn Partner application; credential URL needs a stable public page first.

**Effort:** S | **Priority:** P3 | **Depends on:** /v/[userId] public page, LinkedIn Partner status

### ~~[P3] Volunteer Tenure Badge Auto-Issuance Service~~ ✅ Complete

**What:** Service that automatically issues a `VolunteerCredential` of type
`TENURE_1YR/3YR/5YR` when a volunteer crosses a milestone.

**Why:** The enum values and `computeTenure()` domain function are done (Phase 7 PR1).
The public profile page already displays tenure badges from existing credentials.
The missing piece is the service that actually mints and issues those credentials.

**Context:** `TENURE_1YR/3YR/5YR` enum values are in `CredentialType`. `computeTenure()`
in `src/server/domain/volunteer-profile.ts` computes the current level. The platform org
(`slug: platform`) is seeded and will be the issuer. The service (`tenureBadgeService.ts`)
should: (1) call `computeTenure()` for the user's activity records, (2) check which
milestones they've crossed, (3) upsert VERIFIED credentials for earned levels (idempotent),
(4) be triggered from `shiftSignupService` on ATTENDED status and from
`volunteerApplicationService` on approval. Edge case: milestone reset on account
re-join is out of scope — tenure is additive from earliest activity.

**Pros:** Completes the tenure gamification loop; credentials appear on public profile immediately.
**Cons:** Need trigger points in 3 services; platform org must always exist (seeded).

**Effort:** M | **Priority:** ~~P3~~ | **Depends on:** ✅ Phase 7 PR1 (enum + computeTenure + platform org seeded) | **Completed:** v0.7.0 (2026-03-17)

### ~~[P3] Auto-Share Credentials on Apply ("Bring My Credentials" Checkbox)~~ ✅ Complete

**Completed:** v0.3.0 (2026-03-17) — Phase 6C

Implemented as part of Phase 6C credential sharing. Checkbox on apply form triggers
`shareAllOnApply(userId, orgId)` in `credentialShareService.ts`. Creates share tokens +
immediately claims them in a single transaction for audit trail. Skips credentials
already in the target org.

### ~~[P2] Platform-Wide Rate Limiting~~ ✅ Complete

**Completed:** v0.8.0 (2026-03-18)

Implemented Upstash Redis-based rate limiting via `@upstash/ratelimit` with sliding window.
Three tRPC middleware factories (`rateLimitByOrg`, `rateLimitByUser`, `rateLimitByIp`) in
`src/server/trpc/rate-limit-middleware.ts`. Applied to: `credentialSharing.generate` (5/min
per user), `credentialSharing.claim` (10/min per org), `screener.submit` (3/min per IP),
`credentialSharing.getTokenInfo` (30/min per IP). Fails open when Redis is unavailable.

### ~~[P3] Share Token Cleanup Cron~~ ✅ Complete

**Completed:** v0.9.0 (2026-03-18)

Combined with credential expiry below into a single daily Vercel Cron job at
`/api/cron/expire-credentials` (runs 03:00 UTC). Marks ACTIVE tokens with
`expiresAt` in the past as EXPIRED. Per-record transactions with P2025 handling.
Audit log entries with `actorId: null` for each transition.

### ~~[P2] Credential Expiry Auto-Transition Cron~~ ✅ Complete

**Completed:** v0.9.0 (2026-03-18)

Implemented in `credential-expiry-service.ts` as part of the daily cron job.
Transitions VERIFIED credentials with `expiresAt` in the past to EXPIRED.
Per-record transactions with audit logging (`CREDENTIAL_AUTO_EXPIRED`).
Limit of 500 per run prevents unbounded processing.

---

## Corporate CSR

### [P2] Context-Switch UI (Org ↔ Company Dashboard)

**What:** UI for users who are both an `OrganizationMember` (nonprofit staff) and
a `CompanyMember` (corporate CSR admin) to switch between contexts without logging
out and back in.

**Why:** With the shared `User` table and `currentCompanyId` on `Session`, the
technical plumbing already supports dual membership. The missing piece is the UX:
a navbar dropdown or modal that lets the user select which context they're operating in.

**Context:** The `Session` model has `currentOrgId` (org context) and `currentCompanyId`
(company context, added in 6A). A "Switch Account" menu item could show both contexts.
Switching org: existing `org.switchOrg` tRPC mutation. Switching company: new
`company.switchCompany` mutation that sets `Session.currentCompanyId`. The
`companyProcedure` in tRPC reads `ctx.companyId` from session, so switching session
is sufficient.

**Pros:** Unlocks power users who manage both nonprofit and corporate accounts.
**Cons:** UI complexity; most users will only ever have one context.

**Effort:** M | **Priority:** P2 | **Depends on:** ✅ 6A CompanyAccount shipped

### ~~[P1] ESG Report PDF Export~~ ✅ Complete

**Completed:** 2026-03-17

Implemented using `@react-pdf/renderer` 4.3.2 with branded PDF layout matching
DESIGN.md (forest green header, sand stat boxes, warm neutral table). API route
at `/api/esg-report/pdf` mirrors CSV route auth pattern. Dynamic import keeps
`@react-pdf/renderer` out of the main bundle. Fonts (Fraunces Bold, Geist
Regular/SemiBold/Bold) bundled as TTF in `public/fonts/`.

---

### [P3] Shared ESG Export Auth Helper

**What:** Extract repeated auth/validation logic from CSV and PDF API routes into
a shared helper function.

**Why:** Both `/api/esg-report/csv/route.ts` and `/api/esg-report/pdf/route.ts`
duplicate the same auth flow: session check → param validation → membership check →
role check → plan tier check. If a third export format is added, the duplication
becomes a maintenance burden.

**Context:** Currently acceptable at 2 call sites. Extract when a third format
(e.g., XLSX, branded HTML) is added. The helper would live in
`src/server/lib/esg-auth.ts` and return either the validated params + userId or
a NextResponse error.

**Effort:** S | **Priority:** P3 | **Depends on:** A third ESG export format being added

### [P2] QR Code Volunteer Check-In (Mobile PWA)

**What:** QR code displayed on `/app/my-shifts` that staff can scan to instantly
mark a volunteer as ATTENDED, replacing the manual attendance UI.

**Why:** At in-person events with 50+ volunteers, staff can't efficiently use the
web UI to mark attendance one by one. QR scanning is the standard venue solution.

**Context:** Phase 6E adds the PWA manifest (installable on iOS/Android). QR
check-in is the natural companion. The QR code encodes a per-shift-per-volunteer
token (signed URL or short-lived token). Staff scans with their phone camera →
opens a URL that calls `shifts.markAttended` tRPC mutation. The volunteer's phone
shows the QR; the staff's phone scans it.

**Pros:** Massive operational efficiency at events; differentiates from competitors
who all use manual check-in.
**Cons:** Token generation + validation adds complexity; must handle expired QR codes gracefully.

**Effort:** M | **Priority:** P2 | **Depends on:** Phase 6E PWA shipped, Phase 5 attendance tracking in place

---

## Corporate ESG Reporting (Phase 6D)

### [P2] ESG Report Integration Tests (Raw SQL)

**What:** Integration tests for `getESGShiftAggregates`, `getESGCredentialCounts`,
and `getESGDistinctEmployeeCount` with a seeded test database.

**Why:** These repository functions use raw SQL via `Prisma.$queryRaw` with
`Prisma.sql` tagged templates. Unlike Prisma's typed queries, raw SQL is not
checked against the schema at compile time. If columns are renamed or table
relationships change, the queries will fail silently at runtime. Integration
tests with real data catch drift before it reaches production.

**Context:** The three functions join 5 tables (CompanyNonprofitLink, Organization,
Shift, ShiftSignup, CompanyMember) and use conditional WHERE clauses for date
filtering. Test cases should cover: company with multiple linked orgs and
overlapping employees, date range filtering (from-only, to-only, both, neither),
credential-only orgs (no shifts), and empty results.

**Pros:** Catches schema drift early; validates join logic with real FK constraints;
tests bigint → number conversion from raw SQL.
**Cons:** Requires test DB seeding infrastructure; slower than unit tests.

**Effort:** M | **Priority:** P2 | **Depends on:** Phase 6D shipped, test DB seeding infra

---

## Phase 9 — Production-Ready + Activation

### [P2] Timezone-Aware Notification Delivery

**What:** Deliver shift reminders and digest emails based on the volunteer's
local timezone rather than a fixed UTC offset.

**Why:** A shift reminder sent at 06:00 UTC arrives at 10pm PST the night
before — not useful. As the platform onboards orgs in multiple timezones,
fixed-UTC cron delivery will cause poor UX for west-coast and international users.

**Context:** Phase 9 ships reminders and digests at fixed UTC times (06:00 and
08:00). The fix requires: (1) a `timezone` field on User or Organization
(IANA timezone string, e.g., `America/Los_Angeles`), (2) cron jobs that query
users grouped by timezone and send at their local 8am equivalent, or (3) a
queue-based approach where each notification is scheduled for delivery at the
user's local time. Option (2) is simpler but means the cron runs more
frequently; option (3) is more precise but requires job queue infrastructure.

**Pros:** Notifications arrive at sensible local times; critical for multi-timezone orgs.
**Cons:** Adds complexity to cron scheduling; requires timezone data on users.

**Effort:** M | **Priority:** P2 | **Depends on:** Phase 9 cron jobs shipped

---

### [P1] Digest Cron Pagination with Cursor Tracking

**What:** Implement batch processing (100 users per run) with cursor persistence in
`CronJobRun.resultSummary` for the email digest cron job.

**Why:** Vercel Cron has a 300s timeout (Pro plan). Processing 1000+ digest users
sequentially would exceed this. Cursor tracking ensures all users eventually get
their digest across multiple cron invocations without double-sending.

**Context:** The digest cron (08:00 UTC) queries users with digest preferences enabled
and `lastDigestSentAt` older than their configured frequency (daily/weekly). Process
100 users per invocation. Store the cursor (last processed userId) in `CronJobRun.resultSummary`
JSON. On next invocation, resume from cursor. When cursor reaches end, reset.
`lastDigestSentAt` on `NotificationPreference` prevents double-sends on restart.

**Pros:** Works within Vercel timeout constraints; scales to 10K+ users; idempotent.
**Cons:** Users at the end of the cursor may receive digests hours after the cron trigger.

**Effort:** S | **Priority:** P1 | **Depends on:** Digest cron + CronJobRun table implementation

---

### ~~[P1] Cron Failure Alerting — 3 Consecutive Failures Trigger Admin Email~~ ✅ Complete

**Completed:** v0.12.0 (2026-03-19)

Implemented as part of the cron health dashboard in `admin.ts`. The `cronHealth`
query counts consecutive failures per job from `CronJobRun` records (newest-first).
Jobs with 3+ consecutive failures surface in the `alerts` array. Visible on the
admin health dashboard at `/app/admin/health`. Email alerting deferred — dashboard
visibility is the initial mechanism.

---

### [P2] AuditLog Index — Use CONCURRENT Creation for Large Tables

**What:** When creating the `@@index([entityType, entityId])` index on AuditLog, use
`CREATE INDEX CONCURRENTLY` to avoid table locks during migration.

**Why:** Standard `CREATE INDEX` acquires a SHARE lock on the table, blocking writes for
the duration of index creation. If AuditLog has 100K+ rows at deploy time, this could
cause a brief outage for any audit-logged operation.

**Context:** Prisma doesn't natively support `CONCURRENTLY` in its migration generator.
Options: (1) use a raw SQL migration file (`prisma migrate dev --create-only` then edit
the SQL), or (2) check AuditLog row count at deploy time — if <50K rows, standard index
is fine (~1s lock). The AuditLog table grows by ~100 rows/day at current usage, so this
is only a concern if Phase 9 deploys after significant production usage.

**Pros:** Zero-downtime index creation; prevents write stalls during deploy.
**Cons:** Requires manual SQL migration edit; CONCURRENTLY can't run inside a transaction
(Prisma may need `-- AlterTable` pragma adjustment).

**Effort:** S | **Priority:** P2 | **Depends on:** Phase 9 migration (AuditLog index)

---

## Public Site

### ~~[P2] Product Screenshots for Marketing Pages~~ ✅ Complete

**Completed:** v0.12.0 (2026-03-19)

Added 6 PNG screenshots in `public/marketing/`: dashboard, screener, shifts,
credentials, ESG report, and profile. Captured from demo org with realistic
seed data. Ready for integration into public landing pages.

---

## Volunteer Discovery

### ~~[P1] HTTP Rate Limiting for volunteer search endpoint~~ ✅ Complete

**Completed:** v0.8.0 (2026-03-18)

Implemented `rateLimitByOrg` middleware (60 req/min per org) on `discovery.searchVolunteers`
using `@upstash/ratelimit` with Upstash Redis. Sliding window algorithm prevents burst abuse.
Removed the `VOLUNTEER_DISCOVERY_ENABLED` env var gate from `src/app/(app)/app/discover/page.tsx`
— volunteer discovery is now available to all staff users with rate limiting enforced.

---

### ~~[P3] Analytics — Make "Top Volunteers" respect the selected date range~~ ✅ Complete

**Completed:** v0.11.1 (2026-03-19)

Added `fromDate: Date` parameter to `getTopVolunteers` in `orgAnalyticsRepo.ts`,
passed through from `orgAnalyticsService.ts`. Updated heading from "Top Volunteers
— All Time" to "Top Volunteers". All 7 integration test call sites updated.

---

### ~~[P3] Consolidate CREDENTIAL_TYPE_LABELS into shared domain constant~~ ✅ Complete

**Completed:** v0.9.0 (2026-03-18)

Deleted local `CREDENTIAL_TYPE_LABELS` from `discover-client.tsx` — now imports
`CREDENTIAL_LABELS` from `@/server/domain/volunteer-profile`. Also consolidated
`CREDENTIAL_META` (labels + icons) into `src/lib/credential-meta.ts`, replacing
duplicate maps in `profile/page.tsx` and `ClaimClient.tsx`. All 8 credential types
(including TENURE) now have a single source of truth.

---

## Phase 8 — Volunteer Operations Platform

### ~~[P3] Migrate Existing Email Send Files to `sendEmail()` Helper~~ ✅ Complete

**Completed:** v0.11.1 (2026-03-19)

Migrated 7 of 8 email files to `sendEmail()` helper: `sendInviteEmail.ts`,
`sendStatusLinkEmail.ts`, `sendCredentialRequestEmail.ts`, `sendCredentialClaimedEmail.ts`,
`sendBackgroundCheckEmail.ts`, `sendInviteToApplyEmail.ts`, `send-billing-emails.ts`.
`sendFcraEmails.ts` intentionally excluded — FCRA legal compliance requires throw on failure.

---

### ~~[P3] Notification Cleanup Cron — Purge Old Dismissed Notifications~~ ✅ Complete

**Completed:** v0.11.1 (2026-03-19)

`purgeOldDismissedNotifications()` in `credential-expiry-service.ts` hard-deletes
notifications with `deletedAt < 90 days ago`. Runs in parallel alongside credential
expiry in the existing `/api/cron/expire-credentials` daily cron (03:00 UTC).

---

### ~~[P2] Accessibility Audit — Phase 8 Pages and Components~~ ✅ Complete

**Completed:** v0.11.1 (2026-03-19)

Added `aria-label` to icon-only buttons (shifts page: complete, cancel, delete;
shift templates: delete), `aria-hidden="true"` on decorative icons (notification bell,
shift action icons), `aria-pressed` on analytics date range toggle buttons, converted
analytics date range from `div[role=group]` to semantic `<fieldset>`.

---

### [P2] Bulk Import Durability — Replace Fire-and-Forget with Queue

**What:** Replace `void processImportJob()` fire-and-forget pattern with a durable
execution mechanism (Inngest, Vercel background function, or `waitUntil()`).

**Why:** On Vercel serverless, the function terminates after the HTTP response is sent.
`void processImportJob()` fires async processing that will be killed mid-flight for
large imports. Small imports may complete within the response window; large ones won't.

**Context:** `src/server/services/bulk-import-service.ts:97` uses `void processImportJob()`
with a comment noting "can move to queue later." The import page already polls job status
via `BulkImportJob.status`, so the UI handles async correctly — the backend just needs
durable execution. Options: (1) `waitUntil()` from Next.js (quick fix, still limited by
Vercel function timeout), (2) Inngest or similar job queue (proper fix, new dependency),
(3) process synchronously before returning (simplest, but blocks the response).

**Pros:** Large imports complete reliably; eliminates silent mid-flight failures.
**Cons:** Requires either a new dependency (Inngest) or architecture change.

**Effort:** M | **Priority:** P2 | **Depends on:** Phase 9 shipped

---

### [P3] Digest Service — Honor Per-Type Email Preferences

**What:** Filter notifications in the digest by the user's per-type `NotificationPreference.email`
setting before including them in the digest email.

**Why:** If a user opts out of email for a specific notification type (e.g., APPLICATION_UPDATE)
but has digests enabled, those notifications still appear in their digest. The digest
should respect per-type email preferences.

**Context:** `src/server/services/digest-service.ts:63-69` queries all undelivered notifications
for a user without checking `NotificationPreference.email` per type. Fix: join against
`NotificationPreference` and exclude types where `email: false`, or filter in application code
after fetching. The `NotificationPreference` table has `(userId, orgId, type)` composite key
with an `email: Boolean` field.

**Pros:** Consistent preference behavior across real-time and digest delivery.
**Cons:** Adds a join or post-filter; minor query complexity increase.

**Effort:** S | **Priority:** P3 | **Depends on:** Phase 9 digest service shipped
