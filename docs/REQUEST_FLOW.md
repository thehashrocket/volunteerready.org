# REQUEST_FLOW

This document describes the expected request and workflow patterns in the VolunteerReady platform.

It exists to help developers and AI coding agents understand how data and control should flow through the system.

The architecture follows a strict layered pattern:

UI -> tRPC Router -> Service -> Repository -> Database

Services orchestrate workflows. Routers remain thin.

---

# Standard Request Flow

Typical request lifecycle:

```
UI (React / Next.js page or component)
    -> tRPC Procedure
        -> Service Layer
            -> Repository Layer
                -> Prisma / PostgreSQL
            -> Audit Log (inside same transaction)
        -> Return Result
    -> UI Update
```

---

# Example: Volunteer Application Submission

## Step-by-step flow

1. Volunteer opens application form.
2. UI collects answers to screener questions.
3. Client calls `screener.submitApplication` mutation.
4. Router validates input and ensures organization context.
5. Router calls `volunteer-screening` service.
6. Service validates screener questions and answers.
7. Service evaluates disqualifier and review rules -> screening result (PASS / REVIEW / FAIL).
8. Service creates `VolunteerApplication` record with status and screening result.
9. Service creates `VolunteerAnswer` records.
10. Service writes `AuditLog` entry (inside same transaction).
11. Result is returned to client.
12. UI displays success confirmation.

---

# Sequence Diagram

```
Volunteer
    -> UI Form
        -> tRPC Mutation (submitApplication)
            -> volunteer-screening Service
                -> ScreenerQuestion Repository
                -> VolunteerApplication Repository
                -> VolunteerAnswer Repository
                -> AuditLog Repository
                    -> Database (all in one $transaction)
```

---

# Organization Membership Check

Any request involving organization data must confirm membership.

Expected flow:

```
Client
    -> tRPC Procedure
        -> Resolve session
        -> Resolve orgId (from Session.currentOrgId)
        -> Verify OrganizationMember (via middleware)
            -> Continue to Service
```

If membership fails, the request should return an authorization error.

---

# Background Check Initiation Flow

Staff initiates a background check for a volunteer.

```
Staff UI (/app/credentials)
    -> tRPC Mutation (backgroundChecks.initiate)
        -> backgroundCheckService.initiateCheck()
            -> Validate org has Checkr connected
            -> Decrypt Checkr OAuth token
            -> Call Checkr API (pass PII through, never store)
            -> Create BackgroundCheckRequest (PENDING)
            -> Write AuditLog
        -> Return request ID
    -> UI shows pending status
```

## Webhook callback (async)

```
Checkr POST /api/checkr/webhook
    -> Verify signature (constant-time comparison)
    -> Check idempotency (CheckrWebhookEvent)
    -> Parse webhook payload
    -> backgroundCheckService.processWebhookResult()
        -> Lookup request by externalId
        -> Update status (PENDING -> COMPLETE / CONSIDER / FAILED)
        -> If COMPLETE: auto-issue VolunteerCredential (BACKGROUND_CHECK)
        -> Sanitize PII from payload before storing
        -> Write AuditLog
    -> Return 200
```

---

# FCRA Adverse Action Flow

When a background check returns CONSIDER, staff may initiate the FCRA process.

```
1. Staff clicks "Pre-Adverse Notice"
    -> backgroundChecks.sendPreAdverseNotice
        -> Send FCRA pre-adverse email to volunteer (rights info)
        -> Update fcraStatus: NONE -> PRE_ADVERSE_SENT
        -> Record preAdverseNoticeSentAt

2. Wait 5 calendar days (enforced by domain guard)

3a. Staff clicks "Finalize Adverse Action"
    -> backgroundChecks.finalizeAdverseAction
        -> Verify waiting period elapsed (domain: isWaitingPeriodElapsed)
        -> Send adverse action final notice email
        -> Update fcraStatus: PRE_ADVERSE_SENT -> ADVERSE_ACTION_SENT
        -> Update status: CONSIDER -> FAILED (terminal)

3b. OR Staff clicks "Resolve" (issue credential anyway)
    -> backgroundChecks.resolveFcra
        -> Update fcraStatus: PRE_ADVERSE_SENT -> RESOLVED
        -> Staff can then manually issue credential
```

---

# Billing / Stripe Webhook Flow

```
Stripe POST /api/stripe/webhook
    -> Verify signature (constructEvent)
    -> Check idempotency (StripeWebhookEvent)
    -> Route by event type:
        customer.subscription.created -> update org plan tier + send upgrade email
        customer.subscription.updated -> update org plan tier (no email)
        customer.subscription.deleted -> downgrade to FREE + send cancellation email
        invoice.payment_failed -> send payment failed email
    -> Write AuditLog
    -> Return 200

Billing emails are fire-and-forget (trySendBillingEmail) — failures are
logged but never crash the webhook handler. Emails are sent to the org
or company OWNER's email address.

Error routing:
    400 = bad signature
    200 = duplicate event (already processed)
    500 = processing error (Stripe will retry)
```

---

# Shift Signup Flow

```
Volunteer UI (/app/my-shifts or opportunity page)
    -> tRPC Mutation (shifts.signup)
        -> shiftSignupService.signUpForShift()
            -> Check capacity (not full)
            -> Check duplicate (no existing active signup)
            -> Check time overlap (no conflicting confirmed shifts)
            -> Create ShiftSignup (CONFIRMED)
            -> Auto-update shift status to FULL if at capacity
            -> Write AuditLog
        -> Return signup
    -> UI shows confirmed signup
```

---

# Credential Share + Claim Flow

## Volunteer generates share link

```
Volunteer UI (/app/profile → Credentials tab)
    -> tRPC Mutation (credentialSharing.generate)
        -> credentialShareService.generateShareToken()
            -> Validate ownership + VERIFIED status
            -> Generate 256-bit random token
            -> SHA-256 hash token
            -> $transaction:
                ├─ Create CredentialShareToken (ACTIVE, 30-day expiry)
                └─ Write AuditLog
            -> If P2002 (hash collision): retry once with new token
        -> Return raw token (never stored)
    -> UI copies share link to clipboard
```

## Staff claims shared credential

```
Staff UI (/credentials/claim/[token])
    -> tRPC Query (credentialSharing.getTokenInfo)
        -> Hash token → lookup CredentialShareToken
        -> Return credential type + issuing org name + expiry
    -> Staff clicks "Claim credential"
    -> tRPC Mutation (credentialSharing.claim)
        -> credentialShareService.claimShareToken()
            -> Hash token → lookup
            -> Run 6 claim guards (domain pure function)
            -> Check no duplicate credential in claiming org
            -> $transaction:
                ├─ Optimistic lock: updateMany WHERE status=ACTIVE
                ├─ Create VolunteerCredential copy (with provenance)
                └─ Write AuditLog
            -> Fire-and-forget: send claim notification email
        -> Return new credential
    -> UI shows success
```

## Auto-share on apply ("Bring my credentials")

```
Volunteer UI (/apply/[orgSlug])
    -> Checks "Bring my credentials" checkbox
    -> tRPC Mutation (screener.submit)
        -> submitApplication() (committed)
        -> shareAllOnApply(userId, orgId) (try/catch, non-blocking)
            -> Fetch all VERIFIED credentials for user
            -> Filter: skip types already in target org, skip same org
            -> $transaction:
                ├─ For each eligible: create token + immediately claim
                └─ Write single AuditLog entry
        -> Return application result
```

---

# Credential & Token Expiry Cron Flow

```
Vercel Cron (daily, 03:00 UTC)
    -> GET /api/cron/expire-credentials
        -> Verify Authorization: Bearer CRON_SECRET
        -> credentialExpiryService.expireStaleCredentialsAndTokens()
            -> Find VERIFIED credentials with expiresAt in the past (limit 500)
            -> For each: $transaction(update status → EXPIRED + audit log)
            -> Find ACTIVE share tokens with expiresAt in the past (limit 500)
            -> For each: $transaction(update status → EXPIRED + audit log)
            -> Per-record try/catch: P2025 (concurrent modification) → skip
        -> Return { ok: true, credentialsExpired, tokensExpired }
```

Audit log entries use `actorId: null` (system action, no human actor).
Limit of 500 per query prevents unbounded processing; remaining records
picked up on the next run.

---

# Shift Auto-Close Cron Flow

```
Vercel Cron (hourly)
    -> GET /api/cron/shift-auto-close
        -> Verify Authorization: Bearer CRON_SECRET
        -> shiftAutoCloseService.autoCloseExpiredShifts()
            -> Find OPEN shifts with endTime in the past
            -> For each: atomic updateMany with status = OPEN WHERE guard (TOCTOU-safe)
            -> Per-record try/catch: P2025 (concurrent modification) → skip
        -> Return { ok: true, processed, completed, errors }
```

Uses atomic `updateMany` with a status WHERE clause so concurrent calls
(manual complete + cron) never double-complete. `actorId: null` marks
the audit log entry as a system action.

---

# Matching / Recommendations Flow

```
Volunteer browses /opportunities/[orgSlug]
    -> Page fetches opportunities (public)
    -> If authenticated: tRPC Query (matching.getRecommendations)
        -> volunteerMatchingService.getMatchedOpportunities()
            -> Fetch volunteer skills (VolunteerSkill)
            -> Fetch published opportunities with requirements
            -> scoreOpportunity() for each (pure domain function)
                -> Missing REQUIRED skill -> score 0 (NONE)
                -> All REQUIRED met -> 50 + bonus for PREFERRED ratio
                -> PERFECT = 100, PARTIAL = 50-99, NONE = 0
            -> rankOpportunities() -> sorted by score descending
        -> Return scored list
    -> UI shows match badges (green/amber/gray)
```

---

# Feature Flag Flow

When features are gated:

```
Client
    -> tRPC Procedure
        -> Service
            -> FeatureFlag Repository
                -> Check flag state
                    -> Enable / Disable behavior
```

Feature flags allow gradual rollout.

---

# Admin Action Flow

Example: Creating a Screener Question

```
Admin User
    -> UI Form
        -> tRPC Mutation
            -> staffProcedure guard
                -> Screener Service
                    -> ScreenerQuestion Repository
                        -> Database
                    -> AuditLog Repository
                        -> Database
            -> Return created question
```

---

# Error Handling Pattern

Services should return structured errors.

Recommended pattern:

- validation errors
- authorization errors
- domain rule violations
- persistence failures

Routers should map service errors to appropriate tRPC error codes.

---

# Key Principles

1. Routers validate and delegate.
2. Services orchestrate workflows.
3. Repositories handle database operations.
4. Domain rules remain explicit and pure.
5. Organization scope is always enforced.
6. Important actions are logged (inside transactions).
7. PII is never stored — pass-through only.
8. Webhook handlers verify signatures and deduplicate.

---

# Anti-patterns to Avoid

Do not:

- call Prisma directly from UI
- place business logic in routers
- bypass services
- ignore organization scoping
- create hidden side effects in repositories
- store PII (SSN, DOB) in the database
- fire-and-forget audit logs (use `writeAuditLogTx` in transactions)
