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

Constraint:

(organizationId, userId) must be unique.

---

## VolunteerApplication

Represents a volunteer submitting an application to an organization.

An application contains answers to screener questions and may be linked to a VolunteerOpportunity.

Applications are organization-scoped.

Status: SUBMITTED | REVIEW | APPROVED | REJECTED

Screening result: PASS | REVIEW | FAIL (auto-evaluated from disqualifier and review rules)

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

Questions are organization-specific.

---

## VolunteerOpportunity

A volunteer position published by an organization.

Status lifecycle: DRAFT -> PUBLISHED -> CLOSED

Key fields: title, description, location, remote flag, start/end dates, commitment hours, capacity.

Opportunities have tags (free-text, up to 10) and skill requirements (REQUIRED / PREFERRED).

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

---

## ShiftSignup

Volunteer sign-up for a Shift.

Status: CONFIRMED | CANCELLED | NO_SHOW | ATTENDED

Constraint: unique per (shiftId, userId).

Validated against: capacity limits, duplicate check, time overlap with other confirmed shifts.

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
- BackgroundCheckRequest
- FcraStatus
- CredentialShareToken
- ShareTokenStatus
- CompanyAccount
- CompanyMember
- CompanyNonprofitLink
- FeatureFlag
- AuditLog

Do not introduce alternate terminology unless intentionally extending the model.
