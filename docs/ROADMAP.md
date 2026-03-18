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
- ✅ Staff credential management UI (`/app/credentials`) — issue, revoke, remove
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
- ✅ `CompanyMember` roles: OWNER / ADMIN / MEMBER; `companyProcedure` / `companyAdminProcedure` tRPC middleware
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
- ✅ Staff-initiated check UI at `/app/credentials` — existing page extended
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

- Corporate account dashboard at `/app/company/[companyId]/team` — employee volunteer activity, hours, orgs supported
- Aggregate-only view for corporate admins — individual employee records require employee consent
- One-click ESG report export (CSV + PDF) — hours logged, verified credentials, supported nonprofits
- `EmployerReportService` — uses raw SQL aggregations (`$queryRaw` with `Prisma.sql`), not per-row queries
- Structured audit log events for report generation (best-effort with `await` + `catch`)

## 6E — Mobile PWA

- Progressive Web App manifest — installable on iOS and Android home screens
- Volunteer check-in via mobile — QR code displayed on `/app/my-shifts`; staff scans to mark
  ATTENDED
- Push notification groundwork — shift reminders (implementation deferred to Phase 7)

Key new routes:

- `/pricing` — public nonprofit + corporate pricing page
- `/for-employers` — corporate marketing landing page
- `/app/company/[companyId]/team` — corporate account dashboard (employees, activity, ESG report)
- `/app/billing` — nonprofit plan management + upgrade flow
- `/credentials/claim/[token]` — credential share token claim

This phase establishes **the corporate CSR revenue surface and portable volunteer identity network**.

---

# Phase 7 — Network Growth & Volunteer Identity 🚧 In Progress

Goal: Drive organic growth through volunteer-facing public identity and deepen the quality moat
with AI-assisted matching.

## Delivered (v0.6.0–v0.7.0)

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

## Planned

- "Add to LinkedIn" deep link for verified credential badges (blocked on LinkedIn Partner Org ID)
- Cross-org volunteer discovery (`/app/discover`) — feature-flagged, pending rate limiting PR
- Organization analytics dashboard — volunteer engagement metrics, conversion funnel, shift fill rate

This phase evolves VolunteerReady into a **network with compounding value** — more verified
volunteers attract more orgs; more orgs attract more corporate sponsors.

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
