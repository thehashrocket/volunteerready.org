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

### [P2] Plan Upgrade Confirmation Email

**What:** Send a transactional email to the org owner when `customer.subscription.created` fires.

**Why:** Expected SaaS behavior — users expect a "Welcome to Starter" confirmation email
after upgrading. Builds trust in the billing flow and confirms the charge was intentional.

**Context:** `handleStripeWebhookEvent` in `src/server/services/billingService.ts` already
processes `customer.subscription.created`. Add a Resend email call after `updateOrgPlanTx`
commits. Email infrastructure (Resend client) already exists in the project. Requires a
new email template (`buildUpgradeEmail`) in `src/lib/email/`. The sender is the org's
primary email from `Organization.contactEmail` (or a fallback). Email failures should NOT
cause the webhook to return 5xx — wrap in a try/catch and log the failure separately.

**Pros:** High perceived professionalism; no new infrastructure needed (Resend already wired up).
**Cons:** Adds email complexity to the webhook handler; template needs design.

**Effort:** S | **Priority:** P2 | **Depends on:** ✅ 6A Stripe billing shipped

---

### [P2] Plan-Gated Feature UI Hints

**What:** Replace silent FORBIDDEN errors with lock icon + tooltip "Upgrade to [Tier] to unlock."

**Why:** Users who hit a plan gate currently see a generic error modal. Showing *what they need*
to unlock the feature turns a frustration into a conversion opportunity.

**Context:** `planTierProcedure` in `src/server/trpc/init.ts` returns FORBIDDEN for under-tiered
orgs. The missing piece is the UI: (1) A `<PlanGate tier="STARTER">` wrapper component that
queries `trpc.billing.getBillingStatus` and checks the current tier against the required tier
using `getPlanLimits` from `src/server/domain/billing.ts`. (2) Lock overlays on disabled UI
elements. (3) An "Upgrade" CTA linking to `/app/billing`. The `getBillingStatus` tRPC call
already ships in Phase 6A. The domain function `getPlanLimits` is already pure and importable
on the client side (no DB calls).

**Pros:** Converts blocked users to upgrade candidates; makes the plan tier system visible.
**Cons:** Requires UI audit of all gated features; `PlanGate` adds a tRPC call to those pages.

**Effort:** M | **Priority:** P2 | **Depends on:** ✅ 6A planTierProcedure + billing UI shipped

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

### [P2] CredentialShareToken Expiry Notification Email

**What:** Email volunteers 7 days before a `CredentialShareToken` expires.

**Why:** Volunteers may generate share tokens and forget about them. An expiry
reminder lets them regenerate before a claiming org tries to use a stale link.

**Context:** `VolunteerCredential` already has a `notifiedAt` field (per ROADMAP 6C)
for tracking expiry email state. The token itself has `expiresAt`. A scheduled
job would query `WHERE expiresAt BETWEEN now() AND now() + 7 days AND notifiedAt IS NULL`,
send a Resend email, and set `notifiedAt`. Requires a job queue or Vercel Cron.
Currently there is no job queue in the stack (deferred to Phase 7 per eng review).

**Pros:** Better volunteer UX; reduces "my token expired and I can't share credentials" support.
**Cons:** Requires job queue infrastructure not yet present.

**Effort:** S (once job queue exists) | **Priority:** P2 | **Depends on:** Job queue infrastructure (Phase 7)

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

### [P2] Platform-Wide Rate Limiting

**What:** Add rate limiting to public and authenticated tRPC procedures (token generation,
claim, application submit).

**Why:** Without rate limits, attackers can brute-force token hashes or spam credential
generation. Public endpoints are especially exposed.

**Context:** Consider `@upstash/ratelimit` with Redis or Vercel KV for serverless-compatible
rate limiting. Apply to: `credentialSharing.generate` (5/min per user),
`credentialSharing.claim` (10/min per org), `screener.submit` (3/min per IP),
`credentialSharing.getTokenInfo` (30/min per IP). Should be a middleware on tRPC procedures.

**Effort:** M | **Priority:** P2 | **Depends on:** Redis/KV infrastructure decision

### [P3] Share Token Cleanup Cron

**What:** Scheduled job to mark expired `CredentialShareToken` records as `EXPIRED` and
clean up stale tokens.

**Why:** Tokens with `expiresAt` in the past remain `ACTIVE` in the DB. While the domain
guards reject them at claim time, marking them `EXPIRED` keeps data clean and enables
accurate reporting.

**Context:** A Vercel Cron or similar job running daily would execute
`UPDATE CredentialShareToken SET status = 'EXPIRED' WHERE status = 'ACTIVE' AND expiresAt < now()`.
Can be combined with the credential expiry notification email TODO above.

**Effort:** S | **Priority:** P3 | **Depends on:** Job queue or Vercel Cron infrastructure

### [P2] Credential Expiry Auto-Transition Cron

**What:** Scheduled job to automatically transition `VERIFIED` credentials to `EXPIRED`
when `expiresAt` passes.

**Why:** Credentials with `expiresAt` in the past remain `VERIFIED` in the DB. The domain
guard in `canShareCredential` rejects sharing, but the credential status itself is stale.
This creates confusion in the admin UI where credentials appear "Verified" but can't be shared.

**Context:** Daily cron:
`UPDATE VolunteerCredential SET status = 'EXPIRED' WHERE status = 'VERIFIED' AND expiresAt < now()`.
Should fire an audit log entry for each transition.

**Effort:** S | **Priority:** P2 | **Depends on:** Job queue or Vercel Cron infrastructure

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

## Public Site

### [P2] Product Screenshots for Marketing Pages

**What:** Add real product screenshots to the public-facing landing pages (homepage,
for-volunteers, for-nonprofits, for-employers) to show the actual UI.

**Why:** The public pages currently sell with words only. Showing the actual product
UI — screener dashboard, shift calendar, credential badges, ESG report — builds
immediate credibility. Competitors (Galaxy Digital, Rosterfy) all show product shots.

**Context:** Screenshots should be taken from a demo org with realistic seed data.
Key shots: (1) screener application list with pass/fail indicators, (2) shift calendar
with sign-ups, (3) credential badge display, (4) ESG dashboard with charts,
(5) volunteer profile page. Images go in `public/marketing/` as WebP, with
`loading="lazy"` and explicit width/height dimensions. Consider using `next/image`
for responsive srcset. Each landing page has a natural placement for 1-2 product shots.

**Pros:** Massive conversion lift; shows product maturity; differentiates from competitors
who hide their UI behind demo requests.
**Cons:** Screenshots need updating when UI changes; requires realistic demo data.

**Effort:** M | **Priority:** P2 | **Depends on:** ✅ Public site rewrite shipped

---

## Volunteer Discovery

### [P1] HTTP Rate Limiting for volunteer search endpoint

**What:** Add request-level rate limiting to `discovery.searchVolunteers` (e.g., 60 req/min per org).

**Why:** The `VOLUNTEER_DISCOVERY_ENABLED` env var gate must stay enabled until rate limiting lands.
Without request-level limits, an org could call `searchVolunteers` thousands of times per minute
once the gate is removed, scraping all PUBLIC volunteer data in bulk.

**Context:** The invite-to-apply DB throttle (10/day per org) only limits invitations, not search
queries. Request-level rate limiting requires @upstash/ratelimit + Redis/Vercel KV infrastructure
not yet in the stack. This should be implemented as a tRPC middleware on `staffProcedure` or as a
separate `rateLimitedStaffProcedure`. When this ships, remove the `VOLUNTEER_DISCOVERY_ENABLED`
env var gate from `src/app/(app)/app/discover/page.tsx`.

**Pros:** Enables safe removal of the env var gate; prevents bulk scraping of volunteer data.
**Cons:** New infrastructure dependency (Redis/Vercel KV); adds per-request latency.

**Effort:** M | **Priority:** P1 | **Depends on:** Redis/Vercel KV infrastructure decision

---

### [P3] Analytics — Make "Top Volunteers" respect the selected date range

**What:** Pass `fromDate` to `getTopVolunteers` so the table filters by the selected period
rather than showing all-time top contributors regardless of the date range selector.

**Why:** The dashboard shows a "Top Volunteers — All Time" heading to communicate the
discrepancy, but filtering by period would be more intuitive and consistent with the
other three dashboard sections (funnel, retention, fill rate — all date-range scoped).

**Context:** `getTopVolunteers(orgId, limit)` in `src/server/repositories/orgAnalyticsRepo.ts`
currently has no `fromDate` parameter. Adding it requires:
1. Adding `fromDate: Date` parameter to `getTopVolunteers`
2. Adding `AND ss."createdAt" >= ${fromDate}` to the ATTENDED signups WHERE clause
3. Passing `fromDate` from `orgAnalyticsService.getOrgAnalyticsDashboard()`
4. Updating the section heading in `analytics-client.tsx` back to "Top Volunteers" (remove "— All Time")

For all-time queries (`days = null`), pass `new Date(0)` as `fromDate` (same pattern as other queries).

**Pros:** Consistent behavior across all dashboard sections; removes the "— All Time" caveat.
**Cons:** Minor query change; top volunteers in short periods may show only 1-2 people if activity is sparse.

**Effort:** XS | **Priority:** P3 | **Depends on:** ✅ Phase 7 PR4 analytics dashboard shipped

---

### [P3] Consolidate CREDENTIAL_TYPE_LABELS into shared domain constant

**What:** Remove the local `CREDENTIAL_TYPE_LABELS` map in `src/app/(app)/app/discover/_components/discover-client.tsx:51` and import `CREDENTIAL_LABELS` from `src/server/domain/volunteer-profile.ts` instead.

**Why:** Two maps with the same keys but slightly different labels ("1-Year Tenure" vs "1 Year Volunteer") will diverge as new credential types are added. If a new `CredentialType` is added to the enum, the discover UI won't display it correctly unless the local copy is also updated — the TypeScript types won't catch this since the local map uses `Record<string, string>`.

**Context:** `CREDENTIAL_LABELS` in `volunteer-profile.ts` is a pure constant with no framework dependencies. It can be safely imported in client components. The tenure label wording differs slightly between the two maps — align them during this cleanup.

**Pros:** Single source of truth for credential display names; new credential types automatically appear in discover UI.
**Cons:** Slight label wording change in discover UI (cosmetic only).

**Effort:** XS | **Priority:** P3 | **Depends on:** nothing
