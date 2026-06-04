# DOMAIN

This document defines the canonical domain model for the VolunteerReady platform.

VolunteerReady is a multi-tenant nonprofit platform that connects volunteers and organizations.
Every domain object must respect the tenant boundary defined by `Organization`.

This file exists to ensure developers and AI agents use **consistent terminology and modeling**.

---

# Core Entities

## User

Represents a person with an account in the system.

Users may:

- belong to multiple organizations
- apply as volunteers
- manage organizations depending on role
- have a cross-org volunteer profile
- hold org-scoped credentials

Users are global identities.

---

## Organization

Top-level tenant.

All operational data belongs to an organization.

Key fields:

- `timezone` — IANA timezone string (e.g. `America/New_York`). NULL = UTC. Controls when digest emails and shift reminders are delivered at local morning time.

Examples:

- screening questions
- volunteer applications
- volunteer opportunities
- shifts
- credentials
- organization members
- feature flags
- audit logs

Organizations have a plan tier (FREE / STARTER / PRO) and optional Stripe billing.

Activation fields (Phase 12):

- `onboardingBaseline` — JSON blob storing pre-platform baseline data (volunteer count, hours/week, current process)
- `showPoweredBy` — boolean (default true), controls "Powered by VolunteerReady" footer on public apply pages
- `onboardingComplete` — boolean (default false), set when org dismisses the onboarding checklist
- `referralSource` — optional string tracking how the org was referred

Content Flywheel fields (v0.17.1):

- `consentToPublicize` — boolean (default false), org consented to public case study
- `logoUrl` — optional string, org logo (Vercel Blob URL) for case study branding

Marketplace fields (v0.25.0.0):

- `marketplaceVisible` — boolean (default false), opt-in to appear in the public volunteer marketplace
- `description` — optional string, org description shown on marketplace listing card
- `location` — optional string, city/region for marketplace display
- `causeAreaTags` — string array, cause-area labels (e.g. "food security", "education") for filtering
- `verified` — boolean (default false), platform-verified org badge on marketplace

Important rule:

All organization-owned records must contain `orgId`.

---

## OrganizationMember

Join table connecting a `User` to an `Organization`.

Contains the role the user has within that organization.

Roles:

- OWNER
- ADMIN
- STAFF
- READONLY

Activity tracking fields:

- `lastActivityAt` — DateTime, updated on shift signup and application submission. Used for re-engagement targeting.
- `lastReengagementSegment` — '30d' | '60d' | '90d' | null. Tracks which re-engagement email was last sent. Resets to null on new activity.

Constraint:

(organizationId, userId) must be unique.

---

## VolunteerApplication

Represents a volunteer submitting an application to an organization.

An application contains answers to screener questions and may be linked to a VolunteerOpportunity.

Applications are organization-scoped.

Status: SUBMITTED | REVIEW | APPROVED | REJECTED | WITHDRAWN

Screening result: PASS | REVIEW | FAIL (auto-evaluated from disqualifier and review rules)

Source: `ApplicationSource` enum (v0.25.0.0) — `DIRECT` (default), `MARKETPLACE` (applied from marketplace page), `REFERRAL` (referral link), `WIDGET` (embeddable widget). Marketplace apply links pass `?source=marketplace`.

Dedup constraint: partial unique index on `(submittedByUserId, opportunityId)` WHERE `submittedByUserId IS NOT NULL` AND `status NOT IN ('REJECTED', 'WITHDRAWN')`. Prevents authenticated volunteers from submitting duplicate applications to the same opportunity. Rejected and withdrawn applications are excluded so volunteers can re-apply. Anonymous (unauthenticated) applications are not covered by this constraint.

---

## VolunteerAnswer

Represents a response to a screening question.

Each answer belongs to:

- a `VolunteerApplication`
- a `ScreenerQuestion`

Values are stored as JSON to support any question type.

---

## ScreenerQuestion

Questions configured by an organization to screen volunteers.

Types: TEXT | SINGLE_CHOICE | MULTI_CHOICE | BOOLEAN | NUMBER

Questions support:

- Disqualifier rules — matched answer auto-rejects (FAIL)
- Review rules — matched answer flags for manual review (REVIEW)
- Rule operators: equals, includes, lt, lte, gt, gte

Questions are organization-specific. New orgs are seeded with 5 default questions
(age verification, background check consent, availability, prior experience, motivation)
via `seedDefaultQuestions()` in `screenerQuestionsRepo.ts`. The defaults are defined in
`DEFAULT_SCREENER_QUESTIONS` in `volunteer-screening.ts`.

---

## VolunteerOpportunity

A volunteer position published by an organization.

Status lifecycle: DRAFT -> PUBLISHED -> CLOSED

Key fields: title, description, location, remote flag, start/end dates, commitment hours, capacity.

Opportunities have tags (free-text, up to 10) and skill requirements (REQUIRED / PREFERRED).

Marketplace field (v0.25.0.0):

- `searchVector` — tsvector column populated by a PostgreSQL trigger from title, description, and tags. GIN-indexed for full-text search on the public marketplace.

---

## OpportunityTag

Free-text tag associated with a VolunteerOpportunity.

Up to 10 per opportunity.

---

## OpportunityRequirement

Skill requirement for a VolunteerOpportunity.

Level: REQUIRED | PREFERRED

Links to a Skill from the global catalog.

---

## Skill

Entry in the global skill catalog.

Belongs to a SkillFamily (grouping like "Teaching", "Technical").

Referenced by OpportunityRequirement (demand side) and VolunteerSkill (supply side).

---

## VolunteerSkill

Volunteer-to-skill association. Cross-org (tied to User, not Organization).

Constraint: unique per (userId, skill).

---

## VolunteerProfile

Cross-org volunteer identity, 1:1 with User.

Fields: bio, phone, location (city/state/country), availability preferences, interest tags, visibility.

Visibility: PUBLIC | ORGS_ONLY | PRIVATE

Profile completeness scored 0-100 with levels: MINIMAL / BASIC / STRONG / COMPLETE.

---

## VolunteerCredential

Org-scoped verification badge for a volunteer.

Types: BACKGROUND_CHECK | TRAINING_COMPLETE | ID_VERIFIED | REFERENCE_CHECK | ORIENTATION_COMPLETE

Status lifecycle: PENDING -> VERIFIED -> EXPIRED / REVOKED

Constraint: unique per (userId, orgId, type).

Credentials may have provenance fields (`sharedFromOrgId`, `sharedFromCredentialId`) indicating they were claimed via a share token from another organization.

---

## CredentialShareToken

Time-limited link that allows a volunteer to share a VERIFIED credential with another organization.

Token lifecycle: ACTIVE -> CLAIMED / EXPIRED

Key fields:

- `tokenHash` — SHA-256 hash of the raw token (raw token is never stored)
- `credentialId` — the credential being shared
- `createdByUserId` — the volunteer who generated the share link
- `expiresAt` — 30 days from creation
- `claimedByOrgId` — the org that claimed the credential (set on claim)
- `claimedAt` — timestamp of claim
- `status` — ACTIVE / CLAIMED / EXPIRED

Claim guards (6 conditions checked at claim time):

1. Token status is ACTIVE
2. Token is not expired
3. Underlying credential is still VERIFIED
4. Underlying credential is not expired
5. Claiming org is not the issuing org
6. No duplicate credential of the same type exists for the volunteer in the claiming org

Optimistic lock: claim uses `updateMany` with `WHERE status = 'ACTIVE'` to prevent concurrent claims.

Domain logic: `src/server/domain/credential-sharing.ts`

---

## Shift

Org-scoped volunteer time block.

Status lifecycle: OPEN -> FULL (auto at capacity) -> COMPLETED / CANCELLED

Key fields: title, description, start/end time, capacity, optional opportunity link.

FULL auto-reverts to OPEN when a signup is cancelled.

Time validation: end must be after start, max 24h duration.

Auto-completion: Shifts past endTime are automatically transitioned to COMPLETED by the hourly shift-auto-close cron. Status transition uses atomic `updateMany` with WHERE status constraint to prevent TOCTOU races.

---

## ShiftSignup

Volunteer sign-up for a Shift.

Status: CONFIRMED | CANCELLED | NO_SHOW | ATTENDED | WAITLISTED

Constraint: unique per (shiftId, userId).

Validated against: capacity limits, duplicate check, time overlap with other confirmed shifts.

Waitlist behavior: when a shift is FULL, volunteers may join as WAITLISTED. When a confirmed volunteer cancels, the earliest waitlisted volunteer is auto-promoted to CONFIRMED (FIFO).

---

## ShiftTemplate

Org-scoped recurring shift pattern used to generate concrete shifts.

Key fields: title, description, location, isRemote, dayOfWeek (0-6), startHour, startMinute, endHour, endMinute, capacity, optional opportunity link.

Templates are plan-gated (STARTER+). The `maxShiftTemplates` plan limit controls how many templates each org can create.

---

## Notification

User-scoped, org-scoped notification record.

Type: APPLICATION_UPDATE | SHIFT_REMINDER | CREDENTIAL_UPDATE | SYSTEM | BADGE_EARNED | FIRST_APPLICATION | REENGAGEMENT

Key fields: title, body, href (optional deep link), readAt (null = unread), deletedAt (soft delete).

Notifications support mark-read, mark-all-read, and soft delete. Dismissed notifications older than 90 days are purged by the daily cron job.

---

## NotificationPreference

Per-user, per-org, per-notification-type delivery preferences.

Channels: inApp (boolean), email (boolean). Both default to true.

Constraint: unique per (userId, orgId, type).

---

## BackgroundCheckRequest

Represents a background check initiated by org staff for a volunteer.

Scoped to an organization (`orgId`) and linked to a user (`userId`).

Status lifecycle: PENDING -> COMPLETE / CONSIDER / FAILED / CANCELLED

FCRA status lifecycle (nested within CONSIDER): NONE -> PRE_ADVERSE_SENT -> ADVERSE_ACTION_SENT / RESOLVED

Key fields:

- `provider` — background check provider (CHECKR / STERLING)
- `externalId` — provider's report ID (unique, idempotency key)
- `status` — overall check status
- `fcraStatus` — FCRA adverse action workflow state
- `preAdverseNoticeSentAt` — when pre-adverse notice was emailed to volunteer
- `adverseActionAt` — when adverse action was finalized
- `webhookPayload` — sanitized provider payload (no PII)
- `credentialId` — linked credential if auto-issued on COMPLETE

Rules:

- Terminal statuses (COMPLETE, FAILED, CANCELLED) ignore subsequent webhooks
- FCRA emails must succeed before DB state is updated (fail-loudly)
- Status transitions use atomic WHERE guards to prevent concurrent duplicates
- PII (SSN, DOB) is never stored — pass-through to provider only

---

## CompanyAccount

Corporate employer account for CSR / employee volunteer programs.

Has its own plan tier and optional Stripe billing.

Key fields: name, slug, stripeCustomerId.

---

## CompanyMember

Join table connecting a User to a CompanyAccount.

Roles: OWNER | ADMIN | MEMBER

---

## CompanyNonprofitLink

Companies sponsor nonprofit organizations.

Status: ACTIVE | PAUSED

---

## StripeWebhookEvent

Idempotency table for Stripe webhook deduplication.

Constraint: unique `stripeId`.

---

## CheckrWebhookEvent

Idempotency table for Checkr webhook deduplication.

Constraint: unique `checkrId`.

---

## OrgFeedback

Structured feedback record for an organization. Used by the concierge activation engine to track which feedback surveys have been sent.

Type: DAY_7 | DAY_30

Key fields:

- `orgId` — the organization
- `type` — feedback window (DAY_7 or DAY_30)
- `responses` — JSON blob of survey answers (nullable, populated when org submits feedback)

Constraint: unique per (orgId, type). Idempotency — creating the record before sending the email ensures each feedback type is sent at most once per org.

---

## UserFeedback

In-app feedback submitted by users via the floating feedback widget. Tracks mood, message, page context, and admin triage workflow.

Mood: HAPPY | NEUTRAL | FRUSTRATED | BUG | IDEA
Status: NEW | IN_PROGRESS | RESOLVED | DISMISSED

Key fields:

- `userId` — the submitting user (nullable — SetNull on delete)
- `orgId` — the organization context, if on an org-scoped page (nullable)
- `mood` — one of the 5 mood categories
- `message` — freetext feedback (max 2000 chars)
- `pageUrl` / `pageName` — where the feedback was submitted from
- `userRole` — role at time of submission (defaults to VOLUNTEER)
- `status` — triage workflow state
- `replyMessage` / `repliedAt` / `repliedBy` — admin reply (triggers email to user)
- `resolvedAt` / `resolvedBy` — resolution tracking

Soft-deletable via `deletedAt`. Rate limited to 5 submissions per user per hour. Org tagging is automatic based on page URL (non-org pages like /app/my-shifts get `orgId=null`).

---

## ReferenceDataMeta

Key-value table for tracking the seeded version of global reference data (skill catalog, platform org).

Key fields:

- `key` — identifier for the reference data set (e.g. `"skill_catalog"`)
- `version` — integer version matching `CATALOG_VERSION` in `src/server/domain/reference-data.ts`
- `seededAt` — timestamp of the last successful seed

Used by `referenceDataService.ts` to detect stale reference data and trigger re-seeding when `CATALOG_VERSION` is bumped. Not tenant-scoped — global singleton rows.

---

## FeatureFlag

Per-organization configuration toggle.

Allows features to be:

- enabled gradually
- tested safely
- rolled out per organization

Constraint:

(orgId, key) must be unique.

---

## AuditLog

Append-only record of organization and company activity.

Tracks: actor, action, entity, orgId, companyId.

Rules:

- audit logs cannot be edited
- audit logs cannot be deleted
- all DB writes go through services so audit logging is automatic
- uses `writeAuditLogTx(tx, input)` inside transactions for atomicity

---

## OrganizationInvitation

Team invite token for nonprofit org members.

Token is SHA-256 hashed before storage. Has expiry and used-at tracking.

---

## CompanyInvitation

Team invite token for corporate members.

Same pattern as OrganizationInvitation.

---

## ApplicationStatusToken

Opaque token for public email-based application status lookups.

Token is hashed before storage.

---

## OpportunityInterest

Lightweight "I'm interested" signal from an authenticated volunteer on a marketplace opportunity.

An alternative to a full application — lower friction, no screener questions.

Key fields:

- `userId` — the volunteer expressing interest
- `opportunityId` — the target opportunity
- `createdAt` — when interest was expressed

Constraint: unique per (userId, opportunityId). Cascades on delete.

Rules: target opportunity must be PUBLISHED, marketplace-visible, and from a non-suspended org before interest is accepted. `getMyInterests` and `listForMap` also filter `suspendedAt: null` so suspended-org opportunities disappear from all volunteer-facing views. Concurrent toggle races: the interest create + preference upsert are wrapped in `prisma.$transaction`; P2002 (concurrent duplicate create) is caught inside the transaction and treated as idempotent success.

---

## UserMarketplacePreference

Per-user marketplace UI preferences (reserved for future use — e.g., preferred cause areas, location radius, remote-only toggle).

Key fields:

- `userId` — the user (1:1)

---

# Tenant Boundary

The organization is the tenant boundary.

Rules:

1. Every organization-owned record must include `orgId`.
2. Queries must filter by `orgId`.
3. Users may belong to multiple organizations.
4. Authorization must check organization membership.
5. Company-scoped records use `companyId` as the tenant boundary.

---

# Domain Vocabulary

Use these terms consistently across the codebase:

- Organization
- OrganizationMember
- VolunteerApplication
- VolunteerAnswer
- ScreenerQuestion
- VolunteerOpportunity
- OpportunityTag
- OpportunityRequirement
- Skill / SkillFamily
- VolunteerSkill
- VolunteerProfile
- VolunteerCredential
- Shift
- ShiftSignup
- ShiftTemplate
- Notification
- NotificationPreference
- BackgroundCheckRequest
- FcraStatus
- CredentialShareToken
- ShareTokenStatus
- CompanyAccount
- CompanyMember
- CompanyNonprofitLink
- OrgFeedback
- OrgFeedbackType
- UserFeedback
- FeedbackMood
- FeedbackStatus
- ReferenceDataMeta
- FeatureFlag
- AuditLog
- OpportunityInterest
- UserMarketplacePreference
- ApplicationSource

Do not introduce alternate terminology unless intentionally extending the model.
