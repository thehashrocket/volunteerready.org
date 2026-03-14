# TODOS

Deferred work captured during CEO + engineering plan reviews for Phase 6.
Each item includes enough context for a future engineer to pick it up cold.

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

### [P1] Volunteer Impact Public Page (`/v/[userId]`)

**What:** SEO-optimized public page per volunteer showing verified credentials,
total hours, and supported orgs (no PII; volunteer controls visibility).

**Why:** Creates organic SEO growth and gives volunteers a portable identity they
can share with new orgs or employers. Each verified credential page is indexable.

**Context:** `VolunteerProfile` has a `visibility` field (`PUBLIC / ORGS_ONLY / PRIVATE`).
The page should only show PUBLIC profiles. Data comes from cross-org credential,
hours, and org participation aggregates — no PII. Volunteer tenure badges
(1yr/3yr/5yr milestones) would also appear here. This is the Phase 7 "network
growth" anchor feature.

**Pros:** Compounding SEO value; strengthens volunteer retention; corporate sponsors
want to see verified volunteer impact.
**Cons:** Requires careful PII review; volunteer opt-in flow needs UX design.

**Effort:** L | **Priority:** P1 | **Depends on:** Phase 6 credential portability shipped

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

### [P3] Volunteer Tenure Badges (1yr / 3yr / 5yr Milestones)

**What:** Automatically issue a `VolunteerCredential` of a special "tenure" type
when a volunteer reaches 1, 3, or 5 years of verified service on the platform.

**Why:** Gamification + retention. Long-tenure volunteers are the platform's most
valuable credential holders. Milestone badges create visible proof of commitment.

**Context:** Tenure is calculated from the volunteer's earliest verified shift or
application approval date across all orgs. A cron or webhook-triggered check at
credential issue time could backfill milestones. A new `CredentialType` enum value
`TENURE_1YR / TENURE_3YR / TENURE_5YR` would be added. The existing credential
lifecycle (PENDING → VERIFIED) still applies, but these are auto-issued by the system.

**Pros:** Creates recurring reasons for volunteers to return; differentiates platform.
**Cons:** Edge cases: what if a volunteer deletes account and re-joins? Milestone reset?

**Effort:** M | **Priority:** P3 | **Depends on:** Phase 5 shift/attendance data sufficient for tenure calculation

### [P3] Auto-Share Credentials on Apply ("Bring My Credentials" Checkbox)

**What:** Checkbox on the volunteer apply form that, when checked, automatically
shares all VERIFIED credentials with the org at application submit time.

**Why:** Reduces friction for repeat volunteers applying to new orgs. The org can
immediately see the volunteer's credential history without waiting for manual sharing.

**Context:** Current credential sharing requires the volunteer to manually generate
tokens and the org staff to manually claim them. The auto-share checkbox would:
(1) at apply submit, create `CredentialShareToken` for each VERIFIED credential;
(2) immediately claim all tokens on behalf of the org (system-level claim, not staff action);
(3) set `issuedById` on the copied credential to the volunteer's userId.
The `publicApplyRepo` and apply page would need to be extended.

**Pros:** "Oh nice, they thought of that" — high volunteer delight, reduces onboarding friction.
**Cons:** Requires careful privacy review; org sees credentials before even reviewing application;
needs explicit volunteer consent copy in the UI.

**Effort:** M | **Priority:** P3 | **Depends on:** 6C credential sharing infrastructure

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

### [P1] ESG Report PDF Export

**What:** One-click PDF download of the ESG aggregate report (hours logged, verified
credentials, supported nonprofits).

**Why:** Corporate finance and sustainability teams often require PDF reports for
board materials and audit submissions. CSV is useful for analysis; PDF is required
for distribution.

**Context:** Phase 6 ships CSV-only export (no PDF dependency). PDF generation
options: `@react-pdf/renderer` (React-based, works server-side, ~200KB bundle),
Puppeteer headless (flexible but needs Vercel workarounds), or a dedicated report
rendering service. The `EmployerReportService` aggregate data is already available;
PDF is a presentation layer on top. Evaluate `@react-pdf/renderer` first.

**Pros:** Required by enterprise corporate buyers; high perceived value.
**Cons:** New dependency, layout work is non-trivial.

**Effort:** M | **Priority:** P1 | **Depends on:** 6D ESG dashboard + CSV export shipped

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
