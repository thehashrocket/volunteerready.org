# ROADMAP

This document outlines the planned evolution of the VolunteerReady platform.

VolunteerReady is being built as a long-term nonprofit infrastructure platform.
The roadmap is organized into phases that gradually expand platform capabilities.

These phases are directional rather than strictly sequential. Some capabilities
may develop in parallel.

---

# Phase 1 — Volunteer Screening ✅ Complete

Goal: Build the core infrastructure for organizations to accept and evaluate volunteer applications.

Core capabilities:

- ✅ Organization creation and management
- ✅ Organization member roles and permissions
- ✅ Volunteer application submission (public apply form at `/apply/[orgSlug]`)
- ✅ Configurable screener questions (admin UI at `/app/screener`)
- ✅ Volunteer answers storage
- ✅ Audit logging
- ✅ Feature flag support

Admin capabilities built during this phase:

- ✅ Screener question management — create, edit, toggle active/inactive, reorder, delete
- ✅ Applications review — paginated list with status filter, enriched detail view, status update (Submitted → Review → Approved → Rejected)
- ✅ Volunteer "my applications" view — status tracking and answer history for applicants

Key entities:

- Organization
- OrganizationMember
- ScreenerQuestion
- VolunteerApplication
- VolunteerAnswer
- FeatureFlag
- AuditLog

This phase establishes the **multi-tenant architecture** and core data model.

---

# Phase 2 — Volunteer Opportunities ✅ Complete

Goal: Allow organizations to publish volunteer opportunities and allow volunteers to discover them.

Completed capabilities:

- ✅ Opportunity creation and management (org admin UI at `/app/opportunities`)
- ✅ Opportunity tags (free-text, per-opportunity, up to 10)
- ✅ Status workflow: DRAFT → PUBLISHED → CLOSED
- ✅ `staffProcedure` — STAFF+ role enforcement (OWNER/ADMIN/STAFF can manage; READONLY cannot)
- ✅ Public opportunity listings (volunteer-facing at `/opportunities/[orgSlug]`)
- ✅ Search, remote/in-person filter, and sort on public listings
- ✅ Application-to-opportunity linking
- ✅ Organization opportunity dashboards

Key entities added:

- VolunteerOpportunity
- OpportunityTag

This phase enables the **first public-facing discovery layer**.

---

# Phase 3 — Volunteer Matching Engine ✅ Complete

Goal: Match volunteers with opportunities using structured profile and preference data.

Completed capabilities:

- ✅ Opportunity skill requirements with REQUIRED/PREFERRED levels (demand side)
- ✅ Requirements displayed on public opportunity listing cards
- ✅ Volunteer skill profiles (supply side) — self-service skill management at `/app/my-skills`
- ✅ Pure matching/scoring domain logic — exact skill ID matching (Set membership on CUIDs), 0–100 scoring
- ✅ Match scoring algorithm: REQUIRED skills gate (missing → 0), PREFERRED skills add bonus (50 base + 50 × preferred ratio)
- ✅ Match types: PERFECT (100), PARTIAL (50–99), NONE (0)
- ✅ Personalized opportunity recommendations via tRPC `matching.getRecommendations`
- ✅ Match badges on public opportunity listings (green/amber/gray) for authenticated volunteers
- ✅ "Best match" sort option on public listings when logged in
- ✅ Comprehensive domain tests for scoring and ranking

Key entities added:

- OpportunityRequirement
- RequirementLevel (enum: REQUIRED / PREFERRED)
- VolunteerSkill

This phase introduces **intelligent discovery and matching**.

---

# Phase 4 — Volunteer Profiles ✅ Complete

Goal: Create reusable volunteer identities across organizations.

Completed capabilities:

- ✅ Volunteer profile creation and management (`/app/profile`)
- ✅ Profile completeness scoring (0–100 with MINIMAL/BASIC/STRONG/COMPLETE levels)
- ✅ Bio, phone, location (city/state/country), availability preferences
- ✅ Interest tags (free-text, up to 20)
- ✅ Profile visibility controls (PUBLIC / ORGS_ONLY / PRIVATE)
- ✅ Volunteer credential system — org-scoped verification badges
- ✅ Credential types: Background Check, Training Complete, ID Verified, Reference Check, Orientation Complete
- ✅ Credential lifecycle: PENDING → VERIFIED → EXPIRED / REVOKED
- ✅ Staff credential management UI (`/app/settings/background-checks`, originally `/app/credentials`) — issue, revoke, remove
- ✅ Volunteer credential read-only view on profile page
- ✅ Cross-org profile stats (applications, orgs, skills, verified credentials)

Key entities added:

- VolunteerProfile (1:1 with User, cross-org)
- VolunteerCredential (org-scoped, unique per user + org + type)
- AvailabilityType, ProfileVisibility, CredentialType, CredentialStatus (enums)

This phase establishes **reusable volunteer identity** across organizations.

---

# Phase 5 — Scheduling & Shifts ✅ Complete

Goal: Allow organizations to manage volunteer time and scheduling.

Completed capabilities:

- ✅ Shift creation and management (staff UI at `/app/shifts`)
- ✅ Shift status lifecycle: OPEN → FULL → COMPLETED / CANCELLED
- ✅ Auto-status: shift auto-marks FULL at capacity, re-opens on cancellation
- ✅ Volunteer shift signup with capacity enforcement and conflict detection
- ✅ Duplicate signup prevention (one active signup per shift per volunteer)
- ✅ Time overlap detection across confirmed shifts
- ✅ Attendance tracking: CONFIRMED → ATTENDED / NO_SHOW / CANCELLED
- ✅ Staff attendance management with per-volunteer controls
- ✅ Volunteer "my shifts" page (`/app/my-shifts`) — upcoming signups with cancel
- ✅ Shift detail dialog with signup roster and attendance actions
- ✅ Shift capacity computation and fill rate tracking
- ✅ Attendance summary statistics (rate excludes cancelled)
- ✅ Optional opportunity linking (shifts can belong to an opportunity)
- ✅ Cross-org upcoming shift count on volunteer profile stats
- ✅ Pure domain logic with 20 unit tests
- ✅ Shift time validation (end after start, max 24h duration)

Key entities added:

- Shift (org-scoped, optional opportunity link)
- ShiftSignup (unique per shift + user)
- ShiftStatus (enum: OPEN / FULL / CANCELLED / COMPLETED)
- SignupStatus (enum: CONFIRMED / CANCELLED / NO_SHOW / ATTENDED)

This phase supports **operational volunteer coordination**.

---

# Phase 6 — Corporate CSR & Network Effects

Goal: Unlock the corporate CSR revenue surface, cement the quality niche with background check
integrations, and make volunteer credentials portable across the network.

The product is already differentiated on screening and credentialing. This phase fixes the growth
problem — pricing clarity, a new corporate buyer segment, and the network effects that come from
portable volunteer identity.

## 6A — Employer Accounts & Billing ✅ Complete

Completed capabilities:

- ✅ `CompanyAccount` — corporate account type with `slug`, separate from nonprofit orgs
- ✅ `CompanyMember` roles: OWNER / ADMIN / MEMBER; originally gated by session-scoped `companyProcedure` / `companyAdminProcedure` tRPC middleware, replaced in v0.29.2.0 by the input-scoped `companyScopedProcedure` factory (see `docs/ARCHITECTURE.md` "Authorization")
- ✅ `CompanyNonprofitLink` — companies sponsor nonprofit orgs (ACTIVE / PAUSED status)
- ✅ Company creation flow (`/app/company/new`) with slug generation and P2002 guard
- ✅ `CompanySwitcher` UI component — mirrors `OrgSwitcher`; renders in app shell
- ✅ Company dashboard (`/app/company/[companyId]`) — linked nonprofits list, team member management
- ✅ Company invite flow — email-based invitations with SHA-256 token hashing, 48-hour expiry, concurrent-accept safety
- ✅ Company invite acceptance (`/invite/company/[token]`) — public route, P2002 → `{ alreadyMember: true }`
- ✅ `Session.currentCompanyId` — mirrors existing `currentOrgId` pattern; single DB query in auth callback
- ✅ `PlanTier` (FREE / STARTER / PRO) on `Organization`; `planTierProcedure` factory gates tRPC procedures
- ✅ Pure domain functions: `getPlanLimits`, `assertPlanAtLeast`, `isWithinTrial`
- ✅ Stripe billing — `createCheckoutSession`, `createBillingPortalSession` (throws `TRPCError BAD_REQUEST` if no customer)
- ✅ Stripe webhook handler (`/api/stripe/webhook`) — 3-way error routing: 400 bad sig / 200 duplicate / 500 retry
- ✅ `StripeWebhookEvent` idempotency table — `stripeId UNIQUE` prevents double-processing
- ✅ Public `/pricing` page — nonprofit tier cards with feature limits from domain layer
- ✅ `/app/billing` — nonprofit billing management: plan badge, trial countdown, Stripe Portal link
- ✅ `companyId` on `AuditLog` — queryable company audit history
- ✅ NextAuth v4 session callback fix — `cookies()` fallback + DB-query fallback for `orgId`/`companyId` on all request types

Key entities added:

- CompanyAccount
- CompanyMember (role: OWNER / ADMIN / MEMBER)
- CompanyInvitation (tokenHash, expiresAt, usedAt)
- CompanyNonprofitLink (status: ACTIVE / PAUSED)
- StripeWebhookEvent (stripeId unique, idempotency log)
- Organization gains: `planTier` (FREE / STARTER / PRO), `stripeCustomerId`, `stripeSubscriptionId`, `trialEndsAt`
- Session gains: `currentCompanyId`
- AuditLog gains: `companyId`

## 6B — Background Check Integration ✅ Complete

Completed capabilities:

- ✅ Checkr Partner API integration for initiating background checks from within the platform
- ✅ `BackgroundCheckRequest` entity tracks lifecycle: PENDING → COMPLETE / CONSIDER / FAILED / CANCELLED
- ✅ Async webhook handler — provider posts result; credential is auto-created on COMPLETE
- ✅ PII guardrail — SSN/DOB passed through to provider only, never stored in the database
- ✅ Staff-initiated check UI at `/app/settings/background-checks` (originally `/app/credentials`) — existing page extended
- ✅ CONSIDER flow — marks request and notifies staff for manual review
- ✅ Webhook race condition handling — lookup by `externalId`; not-found requeues with delay
- ✅ FCRA adverse action workflow — pre-adverse notice → 5-day waiting period → adverse action notice
- ✅ `FcraStatus` state machine (NONE → PRE_ADVERSE_SENT → ADVERSE_ACTION_SENT / RESOLVED)
- ✅ Volunteer-facing FCRA emails with legally-required rights information
- ✅ AES-256-GCM encryption of Checkr OAuth tokens at rest (`tryDecrypt` for zero-downtime migration)
- ✅ Shared lazy-initialized Resend email client singleton

Key entities added:

- BackgroundCheckRequest (provider, externalId, status, fcraStatus, webhookPayload, credentialId)
- BackgroundCheckProvider (enum: CHECKR / STERLING)
- FcraStatus (enum: NONE / PRE_ADVERSE_SENT / ADVERSE_ACTION_SENT / RESOLVED)
- CheckrWebhookEvent (idempotency table for webhook deduplication)

## 6C — Portable Credential Sharing ✅ Complete (v0.3.0)

- `CredentialShareToken` — volunteer generates a time-limited (30-day) share link for any
  VERIFIED credential; SHA-256 hashed token storage with P2002 collision retry
- Org staff claims the token at `/credentials/claim/[token]` — credential appears in their view
  without re-verification; optimistic lock prevents concurrent claims
- Token lifecycle: ACTIVE → CLAIMED / EXPIRED; domain guards check 6 conditions at claim time
- Credential provenance: `sharedFromOrgId` + `sharedFromCredentialId` on copied credentials
- "Bring my credentials" checkbox on apply flow — `shareAllOnApply()` auto-shares all portable
  credentials in a single transaction (volunteer opt-in)
- Credential wallet on profile page (tabbed UI: Profile + Credentials) with share link generation,
  copy-to-clipboard toast, token expiry countdown, revoke functionality
- Credential card type icons (Shield, GraduationCap, Fingerprint, Users)
- "Shared from [Org Name]" badge on credential cards
- Org-initiated credential request: staff sees "N credentials elsewhere" card on application
  detail page; sends email asking volunteer to share
- Claim notification email (fire-and-forget, outside transaction)
- Shared token utility (`src/server/lib/tokens.ts`) with DRY refactor across 4 existing call sites
- `VolunteerCredential` gains: `sharedFromOrgId`, `sharedFromCredentialId`, `notifiedAt`

Key entities added:

- CredentialShareToken (tokenHash, credentialId, expiresAt, claimedByOrgId, claimedAt, status)
- ShareTokenStatus enum (ACTIVE / CLAIMED / EXPIRED)

## 6D — Corporate ESG Reporting ✅

- Corporate account dashboard at `/app/company/[companyId]/esg` (originally `/team`, renamed v0.27.0.0) — employee volunteer activity, hours, orgs supported
- Aggregate-only view for corporate admins — individual employee records require employee consent
- One-click ESG report export (CSV + PDF) — hours logged, verified credentials, supported nonprofits
- `EmployerReportService` — uses raw SQL aggregations (`$queryRaw` with `Prisma.sql`), not per-row queries
- Structured audit log events for report generation (best-effort with `await` + `catch`)

## 6E — Mobile PWA + QR Check-in + Event Command Center ✅ Complete (v0.13.0)

- ✅ QR-based volunteer check-in — HMAC-SHA256 stateless tokens with 5-minute rotation, staff scanner page (`/app/scan`), search-by-name a11y fallback
- ✅ Volunteer QR display on my-shifts — auto-refresh, countdown timer, contextual copy, check-in status polling with QR→checkmark transition
- ✅ PWA manifest + service worker — installable on iOS/Android, cache-first static assets, network-first API, install prompt
- ✅ Offline QR codes — 10-minute token prefetch to localStorage with offline badge
- ✅ Geo-fenced auto check-in — haversine distance, auto-check-in within 100m; `latitude`/`longitude` on Shift model
- ✅ Real-time check-in counter — live progress bar in shift detail dialog (polls within ±2h)
- ✅ Post-shift thank-you notifications (`SHIFT_COMPLETED` type) with hours logged
- ✅ Session summary email to org admins on shift completion
- ✅ Check-in analytics — method breakdown (QR/manual/geo) + busiest hours on analytics page
- ✅ QR color customization per org with WCAG contrast validation
- ✅ Scanner keyboard shortcuts (`/` focuses search, `Esc` returns to camera)
- Push notification groundwork — deferred (vague scope)

Key new routes:

- `/pricing` — public nonprofit + corporate pricing page
- `/for-employers` — corporate marketing landing page
- `/app/company/[companyId]/esg` — corporate account dashboard (employees, activity, ESG report; originally `/team`)
- `/app/billing` — nonprofit plan management + upgrade flow
- `/credentials/claim/[token]` — credential share token claim

This phase establishes **the corporate CSR revenue surface and portable volunteer identity network**.

---

# Phase 7 — Network Growth & Volunteer Identity ✅ Complete

Goal: Drive organic growth through volunteer-facing public identity and deepen the quality moat
with AI-assisted matching.

## Delivered (v0.6.0–v0.7.2)

Volunteer impact public pages:

- ✅ `/v/[userId]` — SEO-optimized public page per volunteer showing verified credentials, total
  hours, distinct org count, tenure badge, and reliability score; respects visibility settings
- ✅ OG social share card (`/api/share-card/[userId]`) — 1200×630 image with Fraunces font, forest
  green header, sand stat boxes; generic fallback for non-public profiles
- ✅ Volunteer identity panel on the application screener — org staff see volunteer credentials,
  hours, and reliability score inline when reviewing applications
- ✅ "Share your volunteer card" button on `/app/profile` credentials tab
- ✅ Volunteer tenure badges — `TENURE_1YR`, `TENURE_3YR`, `TENURE_5YR` auto-issued via
  `tenureBadgeService` (fire-and-forget, idempotent) triggered on signup, application, and credential events
- ✅ `computeTenure()` — calculates tenure level from earliest recorded activity
- ✅ `computeReliabilityScore()` — 0–100 score (40% attendance, 30% credentials, 20% tenure, 10% recency)

AI-powered matching upgrades:

- ✅ Credential-weighted recommendations — +5 bonus for verified credential type match
- ✅ Availability alignment bonus — +5 when volunteer availability matches shift schedule

Infrastructure:

- ✅ `VolunteerInvitation` table — org-to-volunteer invitation tracking with rate limiting
- ✅ Indexes on `VolunteerProfile(visibility)`, `VolunteerProfile(city, state)`, `VolunteerCredential(userId, status)`

Cross-org volunteer discovery:

- ✅ `/app/discover` — org staff can search PUBLIC volunteer profiles by skills, credential types, city, state, and availability; cursor-based pagination; rate-limited (60 req/min per org)
- ✅ Invite to Apply — staff invites a discovered volunteer to a specific opportunity; rate-limited (10/day per org); TOCTOU-safe atomic transaction guard; duplicate invite rejected at DB level
- ✅ `volunteerDiscoveryRepo` — `visibility = PUBLIC` hardcoded structural privacy invariant (not caller-supplied)
- ✅ `volunteerDiscoveryService` — orchestrates search + invite; audit logged

## Delivered (v0.7.3)

- ✅ Organization analytics dashboard (`/app/analytics`, PRO-gated) — application funnel (submitted → approved → shifted → credentialed), volunteer retention rate, average shift fill rate, and top volunteers by attended hours; date range selector (30d / 90d / 1yr / all-time); upgrade prompt for non-PRO orgs

## Delivered (v0.8.0)

- ✅ Platform-wide rate limiting infrastructure — `@upstash/ratelimit` with Upstash Redis, sliding window, fail-open on Redis unavailability
- ✅ Three tRPC middleware factories: `rateLimitByOrg`, `rateLimitByUser`, `rateLimitByIp`
- ✅ Rate limits applied to: `discovery.searchVolunteers` (60/min per org), `credentialSharing.generate` (5/min per user), `credentialSharing.claim` (10/min per org), `screener.submit` (3/min per IP), `credentialSharing.getTokenInfo` (30/min per IP)
- ✅ Removed `VOLUNTEER_DISCOVERY_ENABLED` env var gate — volunteer discovery now available to all staff
- ✅ IP extraction in `createTRPCContext` via `x-forwarded-for` / `x-real-ip` headers

## Delivered (v0.9.0)

- ✅ Branded email template — all transactional emails (invitations, FCRA, credentials, billing) use consistent VolunteerReady branding (forest green header, warm neutral footer)
- ✅ Billing lifecycle emails — org/company owners receive emails for plan upgrades, payment failures, and cancellations (fire-and-forget via `trySendBillingEmail`)
- ✅ Credential & share token expiry cron — daily Vercel Cron job (03:00 UTC) auto-transitions VERIFIED→EXPIRED credentials and ACTIVE→EXPIRED share tokens with audit logging
- ✅ Consolidated credential display constants — single source of truth for credential labels and icons (`src/lib/credential-meta.ts`)

## Planned

- "Add to LinkedIn" deep link for verified credential badges (blocked on LinkedIn Partner Org ID)

This phase evolves VolunteerReady into a **network with compounding value** — more verified
volunteers attract more orgs; more orgs attract more corporate sponsors.

---

# Phase 8 — Operational Polish & CEO Quick Wins ✅ Complete

Goal: Ship the high-impact operational features that nonprofit admins and volunteers ask for most — notifications, shift templates, waitlists, and plan-gated feature access — while cleaning up infrastructure debt.

## Delivered (v0.10.0)

- ✅ In-app notifications — bell in app header with unread count (30s polling), infinite scroll, mark-read/mark-all-read, soft delete
- ✅ `Notification` + `NotificationPreference` Prisma models with per-user, per-org, per-type delivery preferences
- ✅ `PlanGate` component — features gated behind higher plan tiers show a branded lock card with upgrade CTA
- ✅ Shared `sendEmail()` helper — single entry point for all outbound email with branded templates
- ✅ `maxShiftTemplates` plan limit added to plan tier domain

## Delivered (v0.11.0)

- ✅ Shift templates — recurring patterns (day of week, time range, capacity) with bulk shift generation for N weeks; plan-gated to STARTER+
- ✅ Waitlist for full shifts — WAITLISTED signup status with FIFO auto-promotion when a confirmed volunteer cancels; in-app notification on promotion
- ✅ Templates tab on admin shifts page with full CRUD and "Generate N Weeks" workflow
- ✅ Waitlist UI — staff see waitlist in shift detail dialog; volunteers see badges and "Leave Waitlist" on My Shifts
- ✅ Delete confirmations for shifts and templates
- ✅ Shared `requireUserId` utility extracted from 6 tRPC routers
- ✅ 38 new tests: domain validation (17), waitlist service (10), template service (11)

## Delivered (v0.11.1)

- ✅ Email consolidation — migrated 7 email senders to shared `sendEmail()` helper (FCRA excluded for legal compliance)
- ✅ Notification cleanup cron — daily purge of dismissed notifications older than 90 days
- ✅ PlanGate self-contained billing query (replaced inline upgrade prompts in analytics)
- ✅ Top volunteers date range filter — analytics query now respects the selected date range
- ✅ Accessibility audit — `aria-label` on icon-only buttons, `aria-hidden` on decorative icons, `aria-pressed` on date toggle, semantic `<fieldset>` for analytics date range
- ✅ Dead code removal (old plan-gate component)

Key entities added:

- Notification (userId, orgId, type, title, body, href, readAt, deletedAt)
- NotificationPreference (userId, orgId, type, inApp, email)
- ShiftTemplate (orgId, dayOfWeek, time range, capacity, optional opportunity link)
- WAITLISTED added to SignupStatus enum

This phase makes the platform **operationally ready for daily use** — admins get templates and analytics, volunteers get notifications and waitlists, and plan gating drives upgrades.

---

# Phase 9 — Production-Ready + Activation ✅ Complete

Goal: Make the platform production-ready for real users with self-serve onboarding,
reliability infrastructure, and activation features that help a new org get their
first volunteer application within 30 minutes.

Full plan: [`docs/designs/phase-9-production-ready.md`](designs/phase-9-production-ready.md)

Delivered (v0.12.0):

- ✅ Onboarding wizard (4-step guided first-run modal)
- ✅ Getting started checklist (dashboard widget)
- ✅ Shift reminder emails (24hr before, daily cron)
- ✅ Application status timeline (AuditLog-powered)
- ✅ Email notification digests (daily/weekly with preferences UI)
- ✅ Bulk volunteer import (CSV upload with progress tracking)
- ✅ Stripe webhook event reconciliation (admin tool)
- ✅ Credential share token expiry notification email (7-day advance warning)
- ✅ Product screenshots for marketing pages (6 PNGs)
- ✅ Cron job health dashboard (admin, consecutive failure alerting)
- ✅ `reminderSentAt` on ShiftSignup (idempotency)
- ✅ Mobile bulk import guard
- ✅ First-volunteer celebration notification

Delivered (v0.12.1):

- ✅ Design system compliance fixes — removed AI slop patterns (floating circles, colored left-border), replaced `transition-all` with explicit properties, added `font-display` (Fraunces) to PageHeader and inline h1 elements
- ✅ Mobile layout fixes — welcome page role-selection cards, nav bar org/company switcher overflow

Delivered (v0.12.2):

- ✅ Privacy policy page (`/privacy`) — 10 sections covering data collection, storage, security, sharing, retention, cookies, user rights, children's privacy; third-party service disclosure table
- ✅ Terms of service page (`/terms`) — 15 sections with reusable Section component
- ✅ Cookie consent banner — GDPR-compliant with essential (always on) and analytics (opt-in) categories; expandable preferences panel; localStorage persistence with shape validation
- ✅ Consented analytics — `<ConsentedAnalytics>` component gates Google Analytics (gtag.js) and Vercel Analytics behind cookie consent; `ga-disable-*` flag for in-memory disable on revoke; custom event listener for real-time consent changes
- ✅ Seed file refactor — split monolithic `seed.ts` (2,191 lines) into `seed-helpers.ts`, `seed-production.ts`, `seed-dev.ts`, and thin dispatcher; added `seed:production` and `seed:dev` npm scripts

Deferred from Phase 9:
- Context-switch UI (Org ↔ Company) — moved to Phase 10

Architecture: BulkImportJob table, CronJobRun table, UserDigestPreference table,
`withCronAuth` DRY wrapper, `platformAdminProcedure` tRPC middleware.

---

# Phase 10 — Scale & Enterprise Readiness ✅ Complete

Goal: Fix every known production failure mode, add Sterling background check adapter
for enterprise nonprofits, and ship observability infrastructure that makes email
delivery and cron health visible.

Full plan: [`docs/designs/phase-10-scale-enterprise.md`](designs/phase-10-scale-enterprise.md)

Delivered (v0.13.3):

- Digest cron pagination (100 users/batch, cursor tracking via `CronJobRun.resultSummary`)
- Timezone-aware notification delivery (`Organization.timezone`, hourly cron schedules)
- Digest per-type email preferences (`NotificationPreference.email` filter)
- Volunteer re-engagement emails (30/60/90-day segments, `REENGAGEMENT` notification type)
- Activity tracking (`OrganizationMember.lastActivityAt` on shift signup + application)
- Backfill script (`pnpm backfill:activity`)

Shipped (PR1 — v0.13.4):

- Bulk import durability (`waitUntil()` from `@vercel/functions`)
- AuditLog + Shift composite indexes (`CONCURRENTLY IF NOT EXISTS`)
- Shift auto-close cron (hourly, TOCTOU-safe)
- `completeShift()` actorId nullable for cron use

Shipped (PR2 — v0.14.0):

- Org health score widget (`computeOrgHealth()` pure domain fn + `OrgHealthWidget` component)
- Admin activity feed (`ActivityFeed` component, curated AuditLog query, last 20 events grouped by date)
- Dashboard rewrite: Getting Started Checklist replaced by health widget + activity feed
- Audit log improvements: MEMBER_INVITED event, shift.completed metadata, try-catch resilience
- Health score shift filter fix (CONFIRMED/ATTENDED/NO_SHOW only)

Shipped (PR3 — v0.15.0):

- Context-switch UI (CompanySwitcher component + `company.switchCompany` mutation)
- Encryption key rotation (dual-key decryption, `reEncrypt()`, batch migration script)
- ESG report integration tests (13 tests covering raw SQL queries)
- Stripe webhook reconciliation (admin `stripeReconcile` mutation)
- Email delivery tracking (Resend webhook handler, `EmailEvent` + `EmailBounceStatus` models, bounce suppression)
- Unified webhook health dashboard (Stripe + Checkr + Resend aggregates on `/app/admin/health`)
- Email bounce management UI (per-address re-enable + platform admin "Reset All" override)

Shipped (PR4 — v0.16.0):

- Sterling background check adapter (full API integration, HMAC-SHA256 webhook verification, admin UI)
- Provider-agnostic service refactor (shared `initiateProviderCheck` + `handleProviderWebhookEvent`)
- Adapter registry pattern via `getAdapter()` factory
- Sterling API keys included in encryption key rotation script

Shipped (PR5 — v0.16.2):

- Volunteer dashboard (`/app` for non-staff users) — upcoming shifts, pending applications, expiring credentials, impact stats (DB-side SQL aggregation), recommended opportunities from familiar orgs
- Role-conditional `/app` page — staff see health score + activity feed; volunteers see `VolunteerDashboard`
- Platform admin onboarding funnel (`/app/admin/onboarding`) — 4-step funnel visualization + per-org progress table
- `volunteer.getDashboard` tRPC procedure + `admin.onboardingFunnel` procedure
- Session loading fix (skeleton during `useSession()` resolve)
- `/app` layout exempt from org-redirect for volunteer-only users
- 14 new unit tests (8 volunteerDashboardService + 6 onboardingAnalyticsService)

Architecture: Sterling adapter via `BackgroundCheckAdapter` interface,
`EmailEvent` + `EmailBounceStatus` tables, `Organization.timezone` field (shipped),
dual-key encryption in `crypto.ts` (shipped v0.15.0). `computeOrgHealth()` pure
domain function (shipped v0.14.0). Resend webhook handler at `/api/resend/webhook`.
Sterling webhook handler at `/api/sterling/webhook`. Provider-agnostic adapter
registry at `src/server/lib/adapters/background-check/registry.ts`.

---

# Phase 11 — Volunteer Marketplace & API Platform (in progress)

Goal: Transform VolunteerReady from an org-centric SaaS into a two-sided volunteer
marketplace with network effects, a public REST API, and webhook integrations.

Full plan: [`docs/designs/phase-11-marketplace-api.md`](designs/phase-11-marketplace-api.md)

## 11A — Marketplace Foundation ✅ Complete (v0.25.0.0)

- ✅ Public volunteer marketplace at `/opportunities` — cross-org browse with full-text search (PostgreSQL tsvector + GIN index), 300ms debounce, remote/in-person filter, cursor-based "Load more" pagination, "This Weekend" strip
- ✅ Organization discovery page at `/organizations` — lists marketplace-visible nonprofits with verified-only filter, location, cause-area tags, opportunity and member counts
- ✅ "I'm interested" heart toggle — authenticated volunteers express lightweight interest via `OpportunityInterest` model; idempotent P2002/P2025 race handling
- ✅ Marketplace settings on `/app/settings/team` — orgs set description, location, cause-area tags, and enable marketplace visibility
- ✅ Org activation banner on staff dashboard — dismissible nudge for orgs that haven't enabled the marketplace
- ✅ `ApplicationSource` enum on `VolunteerApplication` — `DIRECT`, `MARKETPLACE`, `REFERRAL`, `WIDGET`
- ✅ Analytics events for marketplace page views, search queries, opportunity clicks, interest toggles, and org clicks
- ✅ `/opportunities` and `/organizations` added to sitemap, footer, and OG image config
- ✅ Rate limiting: marketplace browse at 120 req/min per IP; interest procedures at 60 req/min per user

Key entities added:

- `OpportunityInterest` (userId, opportunityId — unique; cascades on delete)
- `UserMarketplacePreference` (userId 1:1; reserved for future preferences)
- `ApplicationSource` enum (DIRECT / MARKETPLACE / REFERRAL / WIDGET)
- `Organization` gains: `marketplaceVisible`, `description`, `location`, `causeAreaTags`, `verified`
- `VolunteerOpportunity` gains: `searchVector` (tsvector, GIN-indexed)

Deferred to follow-up:
- Composite index on `VolunteerOpportunity(status, createdAt)` (P2 — see TODOS.md)
- Service layer migration for marketplace tRPC procedures (P3 — see TODOS.md)
- Member count privacy threshold on org discovery page (P3)
- Timezone-aware "This Weekend" window (P3)

## 11B — API & Integrations (planned)

- **API & Integrations:** Public REST API with SHA-256 hashed API keys, webhook
  subscriptions with retry (waitUntil + cron sweep), OpenAPI spec via zod-to-openapi,
  grant/funding tracker for opportunities

## 11C — Volunteer Experience (partial — v0.26.0.0)

Delivered:
- ✅ Weekly opportunity digest emails — HMAC-SHA256 one-click unsubscribe, cursor-paginated cron loop, window guard (Monday 8am UTC), branded HTML email
- ✅ ApplicationSource tracking — `?source=MARKETPLACE` on apply links, server-side validation with org.marketplaceVisible downgrade guard
- ✅ Service layer — `marketplaceService.ts` (`toggleInterest`, `getMyInterests`); `org.updateMarketplaceSettings` routed through `orgMarketplaceService.ts`

Still planned:
- Referral links with attribution tracking
- Volunteer streaks and gamification

Architecture decisions: cross-org read via publicProcedure + marketplaceRepository (AD-1),
SHA-256 hashed API keys (AD-2), webhook retry via waitUntil + cron sweep (AD-3),
PostgreSQL tsvector for search (AD-4 — shipped), marketplaceVisible default false (AD-5 — shipped),
OpenAPI via zod-to-openapi (AD-6), OpportunityInterest as lightweight alternative
to full Application (AD-7 — shipped).

---

# Phase 12 — Concierge Activation Engine ✅ Complete

Goal: Build the go-to-market activation system for concierge nonprofit onboarding —
screening landing page, onboarding tools, referral loop, feedback collection, and
impact reporting.

Full plan: [`docs/designs/concierge-activation-engine.md`](designs/concierge-activation-engine.md)

Delivered (v0.17.0):

- ✅ Screening wedge landing page (`/screening`) with interactive Switch Cost Calculator
- ✅ "Powered by VolunteerReady" footer on public apply pages (org-configurable)
- ✅ Onboarding checklist on staff dashboard (4 milestones, dismissible)
- ✅ Referral prompt after first background check + referral landing page (`/apply/refer`)
- ✅ Org feedback survey system — day-7 and day-30 emails with public feedback form
- ✅ Org feedback cron (`/api/cron/org-feedback`, daily 10:00 UTC)
- ✅ Onboarding baseline capture (`/app/settings/onboarding`)
- ✅ Impact report (`/app/impact-report`) — baseline vs platform usage metrics

Key entities added:

- OrgFeedback (orgId, type, responses — unique per org + type)
- OrgFeedbackType enum (DAY_7, DAY_30)
- Organization gains: `onboardingBaseline`, `showPoweredBy`, `onboardingComplete`, `referralSource`

Delivered (v0.17.1):

- ✅ Content Flywheel — case study generation from org usage data
- ✅ Two-step HMAC consent flow (GET confirmation + POST mutation, 7-day token expiry)
- ✅ Admin case study management UI (`/app/admin/case-studies`)
- ✅ Public story pages (`/stories/[orgSlug]`) with before/after metrics
- ✅ Testimonial section on screening landing page (live from consented orgs)
- ✅ Case study PDF export (`/api/case-study/pdf`)
- ✅ Consent backfill script (`scripts/backfill-consent.ts`)
- ✅ 9 security fixes (consent-on-GET, auto-consent, XSS, HTML injection, timingSafeEqual, etc.)

Delivered (v0.17.2):

- ✅ Error handling hardening — consent POST, feedback form, PDF generation, testimonial fetch
- ✅ Shared `escapeHtml()` utility — DRY'd 3 copies into `src/server/lib/html.ts`
- ✅ Runtime type safety — replaced unsafe `as` casts with runtime checks in impact report + feedback
- ✅ Test coverage — 45 new tests (caseStudyService, org-feedback-service, consent route)

Key entities added:

- CaseStudyData (domain type — composed from org, impact report, analytics, feedback)
- Organization gains: `consentToPublicize`, `logoUrl`

This phase establishes **the concierge onboarding playbook** — white-glove activation
for the first 3 nonprofits, with built-in feedback loops and referral mechanics.

---

# Platform Principles

Across all phases the platform must maintain:

- Multi-tenant isolation — every record scoped by `orgId` or `companyId`
- Organization-scoped data access — no cross-org data leakage
- Clear domain boundaries — routers → services → repositories, no shortcuts
- Audit logging of all writes via `writeAuditLogTx`
- Extensible service architecture — new integrations go through adapter classes in
  `src/server/lib/adapters/`
- Plan tier enforcement is server-side only — never trust client-passed tier values
- PII discipline — sensitive identity data (SSN, DOB) is never stored; pass-through only

---

# Long-Term Vision

VolunteerReady is the **quality layer for volunteer engagement** — the platform that serious
nonprofits choose when screening, credentials, and fit matter more than volume.

The long-term ecosystem connects:

- Volunteers — portable verified identity that travels across every org they serve
- Nonprofit organizations — full workflow from application through scheduling and credentialing
- Corporate employers — CSR and employee volunteer programs with real ESG reporting
- Background check and identity providers — integrated, not bolted on

The goal is to be the **trusted infrastructure layer** that makes volunteer engagement safer,
more accountable, and more meaningful for everyone involved.
