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

### ~~[P3] Encryption Key Rotation for Checkr Tokens~~ ✅ Complete

**Completed:** v0.15.0 (2026-03-20)

Dual-key decryption in `src/server/lib/crypto.ts` with `CHECKR_TOKEN_ENCRYPTION_KEY_NEW`
env var. `decrypt()` tries primary key first, falls back to rotation key. `reEncrypt()`
with roundtrip verification. Batch migration script at `scripts/reencrypt-tokens.ts`.
7 new tests covering dual-key fallback, primary preference, and reEncrypt roundtrip.

**Effort:** ~~M~~ | **Priority:** ~~P3~~

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

### ~~[P2] Stripe Webhook Event Reconciliation~~ ✅ Complete

**Completed:** v0.15.0 (2026-03-20)

Admin `stripeReconcile` mutation in `src/server/trpc/routers/admin.ts` replays
missed Stripe webhook events within a configurable time window (1–720 hours).
Uses `reconcileStripeEvents()` from `billingService.ts`. Accessible via the
platform admin health dashboard at `/app/admin/health`.

**Effort:** ~~M~~ | **Priority:** ~~P2~~

---

## Credentialing

### ~~[P2] CredentialShareToken Expiry Notification Email~~ ✅ Complete

**Completed:** v0.12.0 (2026-03-19)

Implemented in `share-token-expiry-service.ts`. Queries ACTIVE tokens expiring within
7 days where `notifiedAt IS NULL`, sends branded email with days-left count, sets
`notifiedAt` for idempotency. Runs as part of the daily `/api/cron/expire-credentials`
cron job (03:00 UTC). Per-record try/catch with P2025 race handling.

### ~~[P2] Sterling Background Check Provider Integration~~ ✅ Complete

**Completed:** v0.16.0 (2026-03-21)

Full `SterlingAdapter` implementing `BackgroundCheckAdapter` interface. 7 named error
classes, HMAC-SHA256 webhook signature verification, API key auth (not OAuth). Prisma
schema: `sterlingApiKey` + `sterlingAccountId` on Organization. Adapter registry at
`src/server/lib/adapters/background-check/registry.ts`. Service functions:
`connectSterlingAccount`, `disconnectSterlingAccount`, `getSterlingConnectionStatus`,
`initiateSterlingCheck`, `handleSterlingWebhookEvent`. Webhook route at
`/api/sterling/webhook`. 22 adapter tests covering all error classes + happy path.

**Effort:** ~~M~~ | **Priority:** ~~P2~~

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

### ~~[P2] Context-Switch UI (Org ↔ Company Dashboard)~~ ✅ Complete

**Completed:** v0.15.0 (2026-03-20)

`CompanySwitcher` component at `src/components/company/CompanySwitcher.tsx` mirrors
`OrgSwitcher` pattern. `company.switchCompany` tRPC mutation sets `Session.currentCompanyId`.
Integrated into `app-shell.tsx` navbar. Users with both org and company memberships
can switch contexts without logout.

**Effort:** ~~M~~ | **Priority:** ~~P2~~

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

### ~~[P2] QR Code Volunteer Check-In (Mobile PWA)~~ ✅ Complete

**Completed:** v0.13.0 (2026-03-20)

Implemented as Phase 6E with HMAC-SHA256 stateless tokens, staff scanner page
(`/app/scan`) with camera + search-by-name fallback, volunteer QR display on
my-shifts, PWA manifest + service worker, geo-fenced auto check-in, real-time
dashboard, thank-you notifications, check-in analytics, and QR color customization.
28 new tests covering all check-in paths.

---

## Corporate ESG Reporting (Phase 6D)

### ~~[P2] ESG Report Integration Tests (Raw SQL)~~ ✅ Complete

**Completed:** v0.15.0 (2026-03-20)

13 integration tests in `src/server/services/employerReportService.integration.test.ts`
covering `getESGShiftAggregates`, `getESGCredentialCounts`, and
`getESGDistinctEmployeeCount`. Tests cover: multi-org companies, date range filtering
(from-only, to-only, both, neither), credential-only orgs, empty results, and
bigint→number conversion. Uses real DB with `vitest.integration.config.mts` and
dotenv config for forked workers.

**Effort:** ~~M~~ | **Priority:** ~~P2~~

---

## Phase 9 — Production-Ready + Activation

### ~~[P2] Timezone-Aware Notification Delivery~~ ✅ Complete

**Completed:** v0.14.0 (2026-03-20)

Added `Organization.timezone` (nullable IANA string, NULL = UTC). Shift reminders
fire at local 6am, digests at local 8am. Cron schedules changed to hourly.
`getTimezonesMatchingHour()` utility in `src/server/lib/timezone.ts`. Timezone
picker on `/app/settings/team`. `updateTimezone` tRPC mutation (staff-only).

---

### ~~[P1] Digest Cron Pagination with Cursor Tracking~~ ✅ Complete

**Completed:** v0.14.0 (2026-03-20)

Cursor-based pagination (100 per batch) with `CronJobRun.resultSummary.nextCursor`.
`lastDigestSentAt` idempotency prevents double-sends on cursor reset. Per-type
email preference filter also added (excludes types where `NotificationPreference.email=false`).

---

### ~~[P1] Cron Failure Alerting — 3 Consecutive Failures Trigger Admin Email~~ ✅ Complete

**Completed:** v0.12.0 (2026-03-19)

Implemented as part of the cron health dashboard in `admin.ts`. The `cronHealth`
query counts consecutive failures per job from `CronJobRun` records (newest-first).
Jobs with 3+ consecutive failures surface in the `alerts` array. Visible on the
admin health dashboard at `/app/admin/health`. Email alerting deferred — dashboard
visibility is the initial mechanism.

---

### ~~[P2] AuditLog Index — Use CONCURRENT Creation for Large Tables~~ ✅ Complete

**Completed:** v0.13.4 (2026-03-20)

Both `AuditLog(orgId, createdAt)` and `Shift(status, endTime)` indexes created with
`CREATE INDEX CONCURRENTLY IF NOT EXISTS` in a `-- DropTransaction` migration. Zero
table locks during deploy.

**Effort:** S | **Priority:** ~~P2~~

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

### ~~[P2] Bulk Import Durability — Replace Fire-and-Forget with Queue~~ ✅ Complete

**Completed:** v0.13.4 (2026-03-20)

Replaced `void processImportJob()` with `waitUntil(processImportJob(...))` from
`@vercel/functions`. Keeps the serverless function alive until import processing
completes. Full queue-based solution (Inngest) tracked separately in Phase 10 TODOs.

**Effort:** ~~M~~ S | **Priority:** ~~P2~~

---

### ~~[P3] Digest Service — Honor Per-Type Email Preferences~~ ✅ Complete

**Completed:** v0.14.0 (2026-03-20)

Bundled with digest cursor pagination. `getOptedOutTypes(userId, orgId)` queries
`NotificationPreference` where `email=false` and adds `type: { notIn: [...] }` to
the notification query.

---

## Phase 11 — Volunteer Marketplace & API Platform (Deferred Items)

### [P3] Algolia Migration Monitoring for Marketplace Search

**What:** Monitor PostgreSQL tsvector full-text search performance and establish
a trigger point for migrating to Algolia.

**Why:** Phase 11 launches with PostgreSQL tsvector + GIN index for marketplace
search. This is sufficient for the initial launch, but as the opportunity catalog
grows past ~10K published opportunities or p95 search latency exceeds 200ms,
dedicated search infrastructure (Algolia) becomes necessary.

**Context:** Marketplace search uses `$queryRaw` with `to_tsvector('english', ...)` and
`ts_rank()` for relevance scoring. A generated tsvector column with GIN index handles
the indexing. Monitor via: (1) Vercel function duration logs for the search endpoint,
(2) `pg_stat_user_indexes` for GIN index size, (3) periodic `EXPLAIN ANALYZE` on the
search query with representative data. Trigger migration when: >10K published opps OR
>200ms p95 search latency OR faceted search requirements emerge.

**Pros:** Prevents reactive scramble when search gets slow; Algolia migration is well-understood.
**Cons:** Monitoring overhead; Algolia adds monthly cost ($1/1K records + search ops).

**Effort:** S (monitoring) → M (migration) | **Priority:** P3 | **Depends on:** Phase 11 PR3 (marketplace search) shipped

---

### [P3] Full Marketplace Moderation Suite

**What:** Comprehensive moderation system beyond the basic report/flag mechanism
shipped in Phase 11 PR2.

**Why:** Phase 11 PR2 ships a minimal report button + admin flag review. As the marketplace
grows, more sophisticated moderation is needed: auto-detection of inappropriate content,
tiered response (warning → temporary hide → permanent removal), org reputation scoring,
appeal workflow, and cross-org pattern detection.

**Context:** The initial moderation mechanism is an `OpportunityReport` entity with
`status: OPEN | REVIEWED | DISMISSED | ACTIONED` and a staff review UI on the admin dashboard.
The full suite would add: (1) keyword/pattern scanning on opportunity creation (pre-publish),
(2) report volume thresholds for auto-hide (e.g., 3 reports in 24h → auto-hide pending review),
(3) org reputation score based on report history, (4) appeal workflow for flagged orgs,
(5) cross-org report aggregation for platform-level trends.

**Pros:** Essential for marketplace trust and safety at scale; prevents bad actors.
**Cons:** Significant complexity; premature before marketplace reaches critical mass.

**Effort:** L | **Priority:** P3 | **Depends on:** Phase 11 PR2 (basic moderation) shipped, marketplace reaching ~50 active orgs

---

## Phase 10 — Scale & Enterprise Readiness (Deferred Items)

### ~~[P3] Volunteer Re-Engagement Emails~~ ✅ Complete

**Completed:** v0.14.0 (2026-03-20)

Three-segment (30d/60d/90d) re-engagement emails scoped to `OrganizationMember`.
`lastActivityAt` tracked on shift signup + application submission. `lastReengagementSegment`
prevents perpetual spam (each segment fires once, resets on activity). 60d template
includes org-scoped published opportunities. Cursor-based pagination for scale.
Cron at `/api/cron/volunteer-reengagement` (daily 3pm UTC). Respects `REENGAGEMENT`
email opt-out via `NotificationPreference`. Backfill script: `pnpm backfill:activity`.

---

### [P3] Bulk Credential Issuance

**What:** Admin UI to issue the same credential type to multiple volunteers at once
(e.g., after a group training session).

**Why:** Orgs that run group trainings currently issue credentials one at a time.
Bulk issuance is operational polish that reduces admin friction for high-volume orgs.

**Context:** Would need a multi-select UI on the credentials page, a batch
`credentials.bulkIssue` tRPC mutation, and progress tracking similar to bulk
import. Reuse the `BulkImportJob` pattern for async processing. Should audit-log
each credential individually.

**Pros:** Significant time savings for orgs with group trainings.
**Cons:** Operational polish, not a blocking gap; single-issue works today.

**Effort:** M | **Priority:** P3 | **Depends on:** Phase 10 shipped

---

### [P3] Inngest/Real Queue for Bulk Import

**What:** Replace the `waitUntil()` stopgap in bulk import with a proper job queue
(Inngest or similar) for truly durable execution.

**Why:** `waitUntil()` extends function lifetime but is still limited by Vercel's
function timeout. For imports >500 rows with email sending, a real queue with
retry semantics is the proper solution. Phase 10 uses `waitUntil()` as a quick
fix; this TODO tracks the full solution.

**Context:** `src/server/services/bulk-import-service.ts` currently uses
`void processImportJob()` (fire-and-forget). Phase 10 upgrades to `waitUntil()`.
Inngest provides step functions, retries, and observability. Alternative: Vercel
background functions or a self-hosted worker.

**Pros:** True durability; retry semantics; observability dashboard.
**Cons:** New dependency (Inngest); monthly cost; architecture change.

**Effort:** L | **Priority:** P3 | **Depends on:** Phase 10 bulk import waitUntil() shipped

---

### [P3] Cron Concurrency Guard — Claim-Based Processing

**What:** Add optimistic locking or claim-based processing to digest and re-engagement
cron services to prevent duplicate emails from concurrent runs.

**Why:** Current flow is read→send→update with no claim/lock. While Vercel cron runs
are serialized by schedule, manual curl triggers during an active run could cause
duplicate email sends.

**Context:** The `lastDigestSentAt` and `lastReengagementSegment` fields provide
after-the-fact idempotency, but a concurrent run could read the same batch before
updates are written. Fix options: (1) SELECT FOR UPDATE SKIP LOCKED on the batch
query, (2) a "processing" flag on CronJobRun that blocks concurrent starts,
(3) accept the risk since Vercel serializes cron triggers.

**Pros:** Eliminates theoretical duplicate emails under concurrent manual triggers.
**Cons:** Low probability scenario; adds query complexity; Vercel already serializes.

**Effort:** S | **Priority:** P3 | **Depends on:** Digest + re-engagement crons shipped

---

### [P3] User-Level Timezone Override

**What:** Allow individual users to set their own timezone, overriding the
organization-level default.

**Why:** Phase 10 adds organization-level timezone (IANA string on Organization
model, NULL = UTC). This handles 95% of cases, but volunteers in different
timezones than their org will receive notifications at suboptimal times.

**Context:** Would add a `timezone String?` field to `User` or `VolunteerProfile`.
Notification delivery logic would check user timezone first, fall back to org
timezone, then UTC. The org settings timezone dropdown pattern can be reused
on the profile page.

**Pros:** Precise notification delivery for distributed volunteer bases.
**Cons:** Additional complexity in cron grouping logic; edge case for now.

**Effort:** S | **Priority:** P3 | **Depends on:** Phase 10 org-level timezone shipped

---

### ~~[P3] Email Delivery Tracking Dashboard~~ ✅ Complete

**Completed:** v0.15.0 (2026-03-20)

Full email delivery tracking system: `EmailEvent` + `EmailBounceStatus` Prisma models,
Resend webhook handler at `/api/resend/webhook` (HMAC-SHA256 signature verification),
bounce suppression in `sendEmail()` with 3-bounce cap, unified webhook health dashboard
on `/app/admin/health` (Stripe + Checkr + Resend event counts), email bounce management
UI with per-address re-enable + platform admin "Reset All" override. 14 new tests
(6 email + 8 webhook).

**Effort:** ~~M~~ | **Priority:** ~~P3~~
