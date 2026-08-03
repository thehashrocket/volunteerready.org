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
3. Client calls the `screener.submit` mutation (public; `submittedByEmail` is normalized to its canonical lowercase form by the input schema).
4. Router validates input and ensures organization context.
5. Router calls `volunteer-screening` service (`submitVolunteerApplication()`).
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
        -> tRPC Mutation (screener.submit)
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

This is the **staff tRPC** path, and note that line 4 — resolving `orgId` from
`Session.currentOrgId` — is what makes it specifically that. Two other shapes do not
follow it:

- Volunteer-facing procedures: a volunteer is not an `OrganizationMember`, so there is
  no membership to verify and no `currentOrgId` to resolve. See "Volunteer Access
  Revocation Flow" below.
- Route Handlers under `/api/org/[orgId]/**`: membership is still confirmed, but the
  `orgId` comes from the **URL** and never from the session. Resolving it from the
  session there is the v0.29.2.0 bug class — for a multi-org user the active org and
  the org in the path can differ, so the route would serve the wrong tenant. See
  "Roster CSV Export Flow" below.

---

# Volunteer Access Revocation Flow

A volunteer revokes one organization's access to them. Staff can add any email
address to a roster without the recipient's consent, and the roster-added email
promises the recipient they can leave from `/app/profile`, so this is the
surface that keeps that promise.

```
Volunteer UI (/app/profile → "Organizations you volunteer with")
    -> tRPC Query (profile.listMyOrgMemberships)   [protectedProcedure, UNGATED]
        -> staffVolunteerService.listMyOrgMemberships(userId)
            -> listMyOrgRelationships(userId)
                 roster rows   WHERE userId, deletedAt: null
                 applications  WHERE submittedByUserId = userId, distinct orgId
                 shift signups WHERE userId, joined THROUGH Shift.orgId
                 blocks        WHERE userId          <-- excluded from the list
                 org memberships for the surviving orgs  -> isStaff
        -> Returns { orgId, organization { name, slug }, reason, since,
                     onRoster, isStaff }
           (never the volunteer's userId — a cross-tenant correlation handle)

    -> tRPC Mutation (profile.leaveOrgRoster { orgId })
        -> staffVolunteerService.leaveOrgRoster()
            -> hasLeavableOrgRelationship(tx, orgId, userId)   <-- precondition
                 roster row OR application OR shift signup, else NOT_FOUND
            -> findOrgVolunteerBlock(orgId, userId)  -> already left? NOT_FOUND
            -> softDeleteOwnOrgVolunteerByOrg(tx, userId, orgId)   [OPTIONAL]
                 -> findFirst  WHERE orgId, userId, deletedAt: null
                 -> updateMany WHERE id, userId, deletedAt: null
                 -> returns the row id, or null when there was no roster row
            -> createOrgVolunteerBlock(tx, orgId, userId)         [MANDATORY]
                 upsert on the (orgId, userId) compound unique
            -> Write AuditLog (VOLUNTEER_LEFT, metadata.hadRosterRow)
    -> UI drops the row from the card
```

Four properties worth preserving:

- **The block is the half that revokes, and it is not optional.** The soft
  delete is: an application-only or shift-only org has no roster row, and `null`
  there is a normal outcome rather than an error. Both run in one transaction —
  a leave that dropped the row but not the block would report success while
  revoking nothing.
- **The `orgId` is a claim, checked before any write.**
  `hasLeavableOrgRelationship()` runs first, so an arbitrary `orgId` cannot mint
  a block against an org the caller has never interacted with. It deliberately
  does not reuse `findOrgVolunteerRelationship()`: that function now consults
  blocks, so it could not tell "no relationship" from "already blocked", and it
  accepts `ORG_MEMBER`, which must not by itself make an org leavable.
- **`userId` sits in the `WHERE` of both roster statements.** Either alone
  closes the hole; both are kept so a later refactor of one does not silently
  open it.
- **`NOT_FOUND` covers every miss.** Unknown org, an org the caller has no edge
  with, and an org already left are deliberately indistinguishable. The
  already-left case is reachable from a stale tab, since the listing filters
  blocked orgs out, and answering `NOT_FOUND` keeps one departure from writing
  two audit rows.

Both procedures are `protectedProcedure`, deliberately **not** `rosterProcedure`
— the roster feature flag gates staff surfaces, and gating the volunteer's exit
would strand people on rosters they cannot leave.

The list is keyed on the ACCESS, not on the roster. Listing only live roster
rows let an org deny the remedy by removing the volunteer first: the row (and
the Leave button) vanished, while the `VolunteerApplication` or `ShiftSignup` it
still held kept satisfying `requireOrgVolunteerRelationship()`. `ORG_MEMBER`
never puts an org on the list — it is surfaced as `isStaff` so the UI can say
plainly that leaving changes nothing for a coordinator at their own org.

While the block stands, the org loses `getOrgVisibleProfile` /
`credentials.issue` / `backgroundChecks.initiate`, and `addVolunteer`,
`ensureAppliedRosterRow`, `restoreVolunteer`, and `assignVolunteerToShift` all
refuse. Only the volunteer lifts it:

```
Volunteer applies / claims an application / signs up for a shift
    -> liftOrgVolunteerBlock(tx, orgId, userId)
        -> deleteOrgVolunteerBlock  (deleteMany — a missing block is the norm)
        -> if a row was removed: Write AuditLog (ORG_ACCESS_RESTORED)
```

It is a no-op when nothing was blocked, because every caller invokes it
unconditionally inside a transaction that is really about something else. An
anonymous application does **not** lift: `screener.submit` is a
`publicProcedure` accepting an arbitrary `submittedByEmail`, so letting an
address alone clear a block would hand the revocation back to anyone who can
type it.

---

# Background Check Initiation Flow

Staff initiates a background check for a volunteer.

```
Staff UI (/app/settings/background-checks)
    -> tRPC Mutation (backgroundChecks.initiate)
        -> backgroundCheckService.initiateBackgroundCheck()
            -> initiateProviderCheck()  (shared Checkr/Sterling path)
            -> Guard 0: consentAttested?                       <-- before any query
            -> Guard 1: requireOrgVolunteerRelationship()      <-- before any PII leaves
            -> Guard 1.5: submitted email == the account's?    <-- after Guard 1, deliberately
            -> Guard 2/3: no active check, no verified credential
            -> Validate org has Checkr connected
            -> Decrypt Checkr OAuth token
            -> Call Checkr API ({ ...pii, email: accountEmail }, never stored)
            -> Create BackgroundCheckRequest (PENDING, consentAttestedBy)
            -> Write AuditLog (metadata.relationship = why it was allowed,
                               metadata.identityNameMismatch if the names disagree)
            -> waitUntil(notify the VOLUNTEER a check has started)
        -> Return request ID
    -> UI shows pending status
```

**All four guards live in the shared `initiateProviderCheck()` path**, so Sterling
gets them too, and all of them run before the paid third-party call that receives
the candidate's SSN and date of birth. A guard placed after the provider call, or
in only one of the two callers, is not a guard.

`Guard 1` throws `NOT_FOUND` for a user outside the org — see
`src/server/services/orgVolunteerAccessService.ts`.

`Guard 1.5` exists because `userId` and the `pii` block are two independent
fields on one form: without it, picking the wrong row sent a stranger's SSN to
the provider and filed the report against the intended volunteer. The email is
the only submitted field the platform can verify, so restating it is what turns a
row mistake into a refusal, and the ACCOUNT's address — never the typed one — is
what reaches the provider. It runs **after** Guard 1 so it cannot be used as an
oracle for "does user X have address Y?" against arbitrary user ids, which are
not secret. SSN and date of birth stay unverifiable; a disjoint name is recorded
on the audit row rather than refused.

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
        -> submitVolunteerApplication() (committed)
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

# Roster CSV Export Flow

The fourth Route Handler shape: session-authenticated and **URL-scoped**, rather than
signature-verified (webhooks) or `CRON_SECRET`-bearing (crons).

```
Browser (<a href> — the page never sees the response)
    -> GET /api/org/[orgId]/roster/csv
        -> Read params.orgId
        -> Resolve session + impersonation (resolveEffectiveUserId)
             -> resolutionFailed → 401 (fail closed, never the real admin's identity)
        -> Bounds-check the segment (3-64 chars)
        -> PROBE rate limit, keyed on userId alone — BEFORE the org lookup
        -> findOrgByIdOrSlug(orgId)          (id wins over apply slug on collision)
        -> requireOrgAccess({ userId, orgId: org.id, minRole: 'STAFF' })
        -> isRosterEnabledForOrg(org.id)     — AFTER the access check
        -> EXPORT rate limit, keyed on `${userId}:${org.id}`
        -> rosterExportService.streamRosterCsv()
             -> paged reads (ROSTER_EXPORT_BATCH), live rows only
             -> at ROSTER_EXPORT_CAP: append formatTruncationNotice()
             -> on mid-stream error: append formatFailureNotice(rowsEmitted)
        -> 200 text/csv, Cache-Control: no-store, private
```

Four properties worth preserving:

1. **Every miss returns the same 404** — unknown org, not a member, insufficient role,
   suspended org, flag off. The URL therefore cannot be used to discover which orgs
   exist or which are in the pilot.
2. **The order is the security property.** The probe rate limit runs before the org
   lookup so an unauthenticated-ish prober cannot use lookups as an oracle; the flag
   read runs *after* `requireOrgAccess` for the same reason.
3. **The cap and the failure notice are rows in the file, not a toast.** The response is
   already committed as a 200 with headers flushed by the time either is known, and the
   page never receives the body anyway. A truncated file that looks complete is the
   failure mode both notices exist to prevent.
4. **FREE tier on purpose.** An org that cannot get its data back out has not chosen to
   stay.

---

# Concierge Roster Import Flow

No HTTP request at all — a CLI entry point that joins at the **service** layer.

```
pnpm import:roster --org <slug-or-id> --file <path.csv> [--dry-run] [--yes] [--actor <email>] [--no-notify]
    -> scripts/import-roster.ts
        -> Reject unknown flags (so --dryrun cannot silently become a live import)
        -> A write run requires --yes; --dry-run requires nothing
        -> findOrgByIdOrSlug(args.org)      -> no match      → exit 1
        -> Refuse a suspended org                             → exit 1
        -> If --actor: resolve the address, then require that
           user to be a member of THIS org                     → exit 1
        -> parseRosterCsv(file)  (domain/roster-import.ts over domain/csv.ts, RFC 4180)
             -> an unbalanced quote refuses the WHOLE file, naming the line
        -> Echo the plan (database, org, file, actor, mode, notify, valid/invalid counts)
        -> Print the invalid rows FIRST, in both modes
        -> branch:
             --dry-run  -> previewRosterImport()   — reads only, writes nothing
             write      -> importRoster()          — per-row transaction,
                             addVolunteer(..., { sendNotification: false,
                                                 via: 'CONCIERGE_IMPORT' }),
                             streaming each row's outcome as it commits
        -> Summary
        -> If a write run AND notify is on (default; suppressed by --no-notify):
             sendImportNotifications() — sequential, awaited, each failure named
        -> Re-running the same file reports every row "already on roster", exits 0
```

It calls `addVolunteer()` rather than inserting `OrgVolunteer` rows, which is why the
`OrgVolunteerBlock` refusal, the shadow-user branch, first-writer-wins on `User.name`
and the audit row are all the same code the add form runs — and why
`rosterImportService` writes no audit rows of its own. Notifications are the one thing
it does *not* delegate: `addVolunteer` fires its send as fire-and-forget behind a
`.catch`, which is right for one coordinator clicking Add and wrong for sixty rows
against a rate limiter — and the people owed that email are precisely those added from
a spreadsheet they never saw, since it carries the only link to the page where they can
revoke the org's access.

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

That is one of several read shapes, and the tRPC one is not the most common. The roster
flag predicate `isRosterEnabledForOrg()` (in `services/featureFlagService.ts`) has six
callers of four shapes: the `rosterProcedure` middleware, two Server Components
(`app/(app)/app/layout.tsx`'s nav gate and `resolveVolunteerRosterFlag()` in
`lib/roster-flag.ts`), the roster CSV Route Handler, and two onboarding reads — which
hide a checklist step rather than guarding anything. Two rules follow:

- **There is no client flag-read path, deliberately.** Reading a gate over tRPC from the
  client flashes the gated surface in after hydration. That is why `shifts/page.tsx` is
  a Server Component wrapping a client child rather than querying the flag itself.
- **A flag read is not an access check and must not run before one.** The CSV route reads
  the flag *after* `requireOrgAccess`, so a stranger cannot use the response to probe
  which orgs are in the pilot.

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

An error takes a second path back out of the system, and it is not the reverse of
the request path. Two things happen to every failure that leaves a tRPC procedure,
in this order (v0.39.0.0):

```
Service throws (TRPCError, or an unhandled Prisma/driver error)
    -> onError  = reportTrpcError   (server/trpc/error-reporting.ts)
         sees the RAW error, before any redaction
         skips deliberate refusals and Zod input failures
         console.error always; Sentry capture within a per-procedure+code budget
    -> errorFormatter               (server/trpc/init.ts)
         allowlisted code AND a message we authored -> message ships
         anything else                              -> GENERIC_ERROR_MESSAGE
         `data.stack` stripped on BOTH paths
    -> HTTP response
        -> safeErrorMessage() / QueryErrorCard      (components/app/query-error-card.tsx)
             decides what is PAINTED
```

The allowlist itself — `CLIENT_SAFE_ERROR_CODES`, `isClientSafeErrorCode()` and
`GENERIC_ERROR_MESSAGE` — lives once, in `src/server/domain/error-disclosure.ts`,
and all three consumers read it from there.

Rules that follow from the ordering:

- **The server decides disclosure; the component only decides display.** Before
  the `errorFormatter` existed, a raw Prisma string had already crossed the
  network and was sitting in the browser's network tab and React Query's cache no
  matter what the component rendered. A client-side check alone is not a control.
- **An allowlisted code is not sufficient on its own.** tRPC resolves
  `message = opts.message ?? cause.message`, and it manufactures `BAD_REQUEST`
  that way for every input-validation failure — so the formatter also requires
  `error.cause` NOT to be an `Error` (i.e. the message is one we wrote). Never
  build a `TRPCError` carrying both a `message:` and a `cause:`; the message is
  silently degraded to the generic string.
- **A message the user is meant to READ needs an allowlisted code.**
  `throw new Error('Cannot remove yourself.')` maps to `INTERNAL_SERVER_ERROR` and
  now renders as generic copy. Services throw a `TRPCError` carrying one of the
  eight codes in `CLIENT_SAFE_ERROR_CODES` — read them off
  `src/server/domain/error-disclosure.ts`, which is authoritative, rather than off
  any list in a doc. Assert the **code** in tests: a `rejects.toThrow('…')`
  message assertion passes identically for a plain `Error`.
- **Disclosure-safe and "not our fault" are different questions.**
  `SERVICE_UNAVAILABLE` is shown to the caller AND reported, because a provider
  outage the user can read about is still an outage we need paged about. Zod input
  failures are the inverse: shown, never reported, because the public procedures
  are unauthenticated and `httpBatchLink` batches N of them per request.
- **Route Handlers never reach the formatter.** Anything under `src/app/api/**`
  builds its own `Response`, so it is audited by hand. A raw `await res.text()`
  rendered into the UI is the same disclosure bug by another door.

`errorFormatter` also runs for HTTP responses only — `createCaller` throws the raw
`TRPCError` without consulting it, which is why router unit tests see the original
message and the formatter carries its own tests.

On the display side there are two helpers, not one. `safeErrorMessage(error)` is
for a query's `error` object; `safeCaughtErrorMessage(caught)` is for a `catch`
around `mutateAsync()`, where the caught value is typed `unknown` and
`err instanceof Error ? err.message : fallback` returns the raw message because
`TRPCClientError extends Error`. Both return `undefined` rather than copy when the
code is not allowlisted — `QueryErrorCard` is what substitutes
`GENERIC_ERROR_MESSAGE`, so a caller rendering a bare `safeErrorMessage()` result
outside that card must supply its own fallback.

The repo-wide guard test `src/server/domain/error-disclosure.guard.test.ts` walks
`src/app` and `src/components` and fails on a raw `error.message` render.

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
