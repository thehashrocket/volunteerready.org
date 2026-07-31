# Staff-Created Volunteers & Unclaimed Accounts — Design Plan

> **Status:** revised 2026-07-26. Through `/plan-eng-review` (18 findings), `/plan-ceo-review`
> (SELECTIVE EXPANSION), two adversarial spec-review passes, and two Codex outside-voice passes.
> **This document is the implementation source of truth.** The CEO plan at
> `~/.gstack/projects/thehashrocket-volunteerready.org/ceo-plans/2026-07-26-staff-created-volunteers.md`
> holds the scope-decision record and the strategic rationale.
>
> The plan is **split**: v1a below is the shippable unit. v1b is specified but deferred.

## Problem

VolunteerReady is only useful to an org once volunteers exist in the system, and today
volunteers can only exist by applying through the public form. Every org arrives with a roster
already in hand (spreadsheet, binder, group text), which means the first week on the platform is
spent asking 60 existing volunteers to create accounts before the tool does anything. That is a
marketplace assumption living inside a management app.

Partial plumbing already exists: `VolunteerApplication.submittedByUserId` is nullable with
`submittedByEmail` as fallback, and `bulk-import-service.ts` creates email-only applications from
CSV. But everything operational (`ShiftSignup`, `VolunteerCredential`, `VolunteerProfile`)
requires a real `User`, so an email-only volunteer can't be scheduled, checked in, or reported on.

**Two claims are already live and false.** `src/app/(public)/for/animal-shelters/page.tsx:89`
promises *"we … import your existing volunteer list if you have one"* on your primary
lead-generation page. `src/app/(public)/page.tsx:200` carries alt text describing a
*"dashboard showing volunteer roster."* There is no `/app/volunteers` route. This plan is not
only a feature; it closes a marketing-truth gap that exists right now.

## Core Design Decision: Unclaimed Users, Not a Parallel Record Type

**Shadow `User` rows in an UNCLAIMED state.** Staff-created volunteers are real `User` rows that
nobody has logged into yet. `ShiftSignup`, `VolunteerCredential`, `VolunteerSkill`, and
`VolunteerProfile` all keep their existing `userId` FK. Claiming is a state flip, not a data
migration.

**Verified:** all four hours implementations (`volunteerIdentityService.ts:80`,
`volunteerDashboardService.ts:107`, `orgAnalyticsRepo.ts:174`, `companyRepo.ts:202`) join
`ShiftSignup → Shift → User` and none filters on `Account` or `Session`. A shadow user's
attendance flows into every hours and impact report with zero code changes.

**Correction to the original framing.** "The entire operational layer works for free" is true for
**reporting** and false for **identity**. Several staff endpoints accept a naked `userId` with no
org-relationship check, and `User.name` is read in more surfaces than any grep reliably
enumerates. Both are handled explicitly below rather than assumed away.

### Roster membership is its own table, not an application

The original plan modeled roster membership as a `VolunteerApplication` with
`source: STAFF_ADDED`. **Rejected.** Reasons:

1. **No dedup.** The partial unique index
   (`migrations/20260421151557_add_withdrawn_status`) has the predicate
   `WHERE "submittedByUserId" IS NOT NULL AND "opportunityId" IS NOT NULL AND ...`. A roster row
   has `opportunityId = NULL`, so it is excluded from the index entirely.
2. **Leaks into two queues built for real applications.** `listApplications`
   (`volunteer-applications.ts:9-37`) filters only on `status`/`opportunityId`, so roster rows
   would land in the staff review queue. `listUserApplications` (`:120`) feeds
   `/app/my-applications`, showing a volunteer a phantom application they never submitted.
3. **Collides with bulk import.** `bulk-import-service.ts` dedups with
   `findFirst({ orgId, submittedByEmail })`, so a staff-added volunteer would silently cause a
   later CSV import of that email to be skipped.

This is **not** the "new record type" option originally rejected. That one replaced `User` and
forced union FKs across the scheduling and reporting stack. This models only the org-to-volunteer
edge and touches neither.

## Schema Changes (v1a)

```prisma
enum AccountState {
  ACTIVE      // default; every existing user backfills to this
  UNCLAIMED   // created by org staff; no one has ever authenticated
}

enum OrgVolunteerSource {
  STAFF_ADDED
  APPLIED
}

model User {
  // new fields
  accountState AccountState @default(ACTIVE)
  claimedAt    DateTime?    // stamped on first authenticated session
  // NOTE: `createdByOrgId` from the original draft is DROPPED — OrgVolunteer carries
  // provenance, and a second source of truth would drift.
}

model OrgVolunteer {
  id            String             @id @default(cuid())
  orgId         String
  userId        String
  displayName   String             // org-typed name, max 120 chars (validated in Zod)
  phone         String?            // org-typed. NOT duplicated onto VolunteerProfile.
  source        OrgVolunteerSource @default(STAFF_ADDED)
  addedByUserId String?
  createdAt     DateTime           @default(now())
  updatedAt     DateTime           @updatedAt
  deletedAt     DateTime?

  organization Organization @relation(fields: [orgId],  references: [id], onDelete: Cascade)
  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  addedBy      User?        @relation("OrgVolunteerAddedBy", fields: [addedByUserId], references: [id], onDelete: SetNull)

  // NO @@unique([orgId, userId]) — see the partial index below. Prisma cannot see raw
  // partial indexes, so `upsert`/`findUnique` on the pair are unavailable by design.
  // Use findFirst({ orgId, userId, deletedAt: null }) + create, catching P2002.
  @@index([orgId, createdAt]) // cursor pagination
  @@index([userId])
}
```

Hand-written in the migration, alongside the Prisma-generated statements:
```sql
-- Partial unique index: soft-deleted rows must not block re-adding the same volunteer.
-- A plain @@unique would throw P2002 on re-add because Postgres does not know about deletedAt.
-- CONCURRENTLY is unnecessary here: the table is brand new and empty.
CREATE UNIQUE INDEX "OrgVolunteer_orgId_userId_active"
  ON "OrgVolunteer" ("orgId", "userId")
  WHERE "deletedAt" IS NULL;
```

**Roster removal is a soft delete.** `deletedAt` is set, the row is retained, and
`ShiftSignup` rows are untouched so the org keeps hours it recorded.

**Migration safety.** New `User` columns are defaulted; `AccountState` backfills every existing
row to `ACTIVE`. Follow the repo convention: hand-written `migration.sql` with `-- CreateEnum` /
`-- AlterTable` / `-- CreateTable` / `-- CreateIndex` section comments.

### Prerequisite: email canonicalization, enforced at the database

`User.email` is `String? @unique` — plain text, no `citext`, no normalization.
The email guard looks users up by lowercased address, so without this it silently misses a row
stored as `Bob@shelter.org` and **fails open** on a privacy control.

⚠️ Updated 2026-07-27 — this paragraph previously cited `linkApplicationsToUser`
(`my-applications.ts:101`) as the exact-string-equality comparison that motivated canonicalization.
That function was **deleted** (see §5). Its successor `claimApplicationForUser()`
(`volunteer-applications.ts`) still compares stored addresses by exact equality, and
`screener.submit` / `screener.checkAnonymousApplication` now normalize `submittedByEmail` on input
so both sides of that comparison stay canonical. The argument for the DB-level constraint is
unchanged — it is what lets the claim path use exact equality instead of an unsafe
case-insensitive match.

**Service-layer lowercasing is not sufficient.** New auth users are created by the raw
`PrismaAdapter` (`src/server/auth.ts:26`), which never passes through a service. Enforce at the
database with a normalizing constraint plus a backfill, so every write path is covered including
ones nobody has written yet. Pre-check for rows that already differ only by case and document the
resolution before running the backfill.

## Flows

### 1. Staff adds a volunteer

```
/app/volunteers → "Add volunteer" → name (req, <=120), email (req), phone (opt)
         │
         ├─ normalize email ── invalid ──→ 400, inline error
         │
         ├─ lookup User by normalized email
         │
         ├── no User found
         │     └─→ tx: create User{accountState: UNCLAIMED, name: <set only if null>}
         │              + VolunteerProfile{visibility: PRIVATE}      ← no phone; see below
         │              + OrgVolunteer{displayName, phone, source: STAFF_ADDED, addedByUserId}
         │              + writeAuditLogTx(VOLUNTEER_ADDED)
         │         → roster row, badge "Not activated"
         │
         ├── User exists, accountState = ACTIVE
         │     └─→ tx: create OrgVolunteer only (User untouched)
         │         → fire-and-forget notification email
         │           (send failure MUST NOT roll back the roster row)
         │
         ├── User exists, accountState = UNCLAIMED (another org created it)
         │     └─→ tx: create OrgVolunteer only
         │
         └── OrgVolunteer already exists, deletedAt IS NULL
               └─→ P2002 → "Already on your roster" (not an error toast)
```

**`phone` lives on `OrgVolunteer` only.** It is org-entered data about a roster relationship,
like `displayName`. `VolunteerProfile.phone` remains in the schema for what the volunteer sets
themselves after claiming. Do not write it in this flow.

**`User.name` is first-writer-wins.** Set it only when currently `null`. This was reconsidered
twice: the stronger version (never write `User.name`, render an org-scoped `displayName`
everywhere) was scoped at one surface, then three, then eight-plus across credentials,
background-check screens, and background-check emails. Each grep found more. The residual leak is
that org B may see the name org A typed, which is the "minor leak" the original doc identified
and accepted. Every existing surface keeps working with zero query changes, and the estimate
stops moving.

### 2. Account state machine

```
                    staff adds email that has no User
                                  │
                                  ▼
                          ┌──────────────┐
                          │  UNCLAIMED   │  emailVerified = NULL
                          │              │  suppressUnclaimed senders skip this address
                          └──────┬───────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
   magic link              Google sign-in            v1b claim link
   (works today)      (needs allowDangerous-      (deferred)
        │              EmailAccountLinking)             │
        └────────────────────────┼────────────────────────┘
                                 │
                        NextAuth events.signIn
                                 ▼
                          ┌──────────────┐
                          │    ACTIVE    │  claimedAt = now()
                          └──────────────┘
```

The flip lives in `auth.ts` events, **not** in a claim page. Without it, a shadow user who signs
in by ordinary magic link stays `UNCLAIMED` forever and their cron mail is suppressed permanently.

⚠️ **`events.signIn`, NOT `events.updateUser`** — this paragraph originally specified
`updateUser`, and shipping that would have silently defeated the whole task. Verified against
installed `next-auth@4.24.14`: on the Google account-linking path, `callback-handler` assigns
`user = userByEmail` directly and never calls `adapter.updateUser`, so `events.updateUser` never
fires. That is precisely the path the `allowDangerousEmailAccountLinking` change below opens, so
a volunteer claiming via Google would have stayed `UNCLAIMED` and email-suppressed forever.
`events.signIn` fires on every path — magic link and OAuth, new user and existing.

The handler is **awaited inside a try/catch**, not fire-and-forget. The
`.catch(console.error)`-on-a-detached-promise convention
(learning: `nextauth-events-createuser-void-rejection`) is right for `sendNewUserAlert`, which is
droppable; it is wrong here, because a dropped flip leaves a real person permanently unable to
receive mail they asked for, and a detached promise can be killed when a serverless response
returns. The try/catch is what keeps a claim failure from becoming a failed sign-in.

**Google account linking.** `allowDangerousEmailAccountLinking: true` on the Google provider.
Without it, NextAuth throws `AccountNotLinkedError` for any pre-created `User` row with no linked
`Account`, permanently blocking Google sign-in for anyone whose email an org typed. The flag is
"dangerous" for providers asserting unverified emails; Google is not one. Add a `// SECURITY:`
comment explaining the reasoning.

### 3. Email suppression — opt-in, not opt-out

```
sendEmail(to, subject, html, opts)
   │
   ├─ opts.isCritical? ──────────── yes ──→ send (existing behavior)
   │
   ├─ opts.suppressUnclaimed? ───── NO (default) ──→ send
   │      │
   │     yes  ← set by exactly four senders:
   │             digest-service.ts:153
   │             reengagement-service.ts:150
   │             opportunityDigestService.ts:174
   │             shift-reminder-service.ts:75
   │      ▼
   ├─ Promise.all([ bounceStatus lookup, User.accountState lookup ])
   │      (independent reads; sequential would double latency on every cron send)
   │
   ├─ suppressed bounce?   ──→ return false (existing)
   ├─ accountState UNCLAIMED? ──→ write EmailEvent{status: SUPPRESSED_UNCLAIMED}, return false
   └─ otherwise ──→ send
```

**The guard is opt-in by design.** An earlier draft blocked by default with an exemption list.
Auditing every sender showed the exemption list was already missing six transactional senders
people actually asked for: the `/apply/status` link the applicant typed their own address to
request, org member invites, company invites, invite-to-apply, credential requests, and lead
confirmations. Roster population and invite population are the same people, so those would have
gone silently dead.

Only four senders exist to push unrequested bulk mail. Scoping the guard to those four means the
failure mode is "one unwanted email, visible and recoverable" rather than "a person never hears
back, invisibly" — and a sender added later by someone who never read this document fails safe.

**Suppression is observable.** Write an `EmailEvent` row with `status: SUPPRESSED_UNCLAIMED`.
Without it, "did this person get their shift reminder?" is unanswerable three weeks later, since
`EmailEvent` rows are currently written on `SENT` only.

**Known bypass, deliberate.** `sendFcraEmails.ts:34` and `:84` call the Resend SDK directly and
never reach `sendEmail`. They are legally mandated adverse-action notices and are exempt by
design. Recorded here so it is a decision, not an oversight.

### 4. Operating on unclaimed volunteers

- **Assign to shift.** New `assignVolunteerToShift()` in `shiftSignupService.ts`, reusing
  `validateSignup` from `domain/shift.ts` rather than reimplementing capacity rules. Takes an
  explicit `allowOverCapacity` flag. ~~`ShiftSignup @@unique([shiftId, userId])` makes reassignment
  idempotent.~~ **Single-assign only in v1a** — bulk assign was cut, see NOT in scope.

  ⚠️ **Two corrections during implementation (v0.35.0.0).**

  1. **The unique index does the opposite of making reassignment idempotent.** `createSignup`
     only ever creates, and `validateSignup`'s duplicate check matches `CONFIRMED` alone — so a
     volunteer with a CANCELLED, ATTENDED or NO_SHOW row for that shift passed validation, reached
     `create`, and raised an unhandled P2002. Re-adding someone who cancelled is an ordinary
     coordinator action. The service resolves the existing row explicitly instead: CANCELLED and
     WAITLISTED are revived to CONFIRMED on the SAME row (so `createdAt` and the audit trail
     survive), and the three "already on this shift" states are refused by name. Pinned by
     `services/assignVolunteer.integration.test.ts`, which reproduces the raw P2002 first so the
     reason is recorded.

  2. **`allowOverCapacity` is an option ON `validateSignup`, not a filter on its result.** Each
     refusal in that function returns early, so a service that called it unchanged and ignored the
     `SHIFT_FULL`/`AT_CAPACITY` codes would also be ignoring the fact that the duplicate and
     time-conflict checks never ran — and would create a signup for someone already on the shift.
     Skipping only the capacity block lets execution fall through to the rules nobody may waive.
     Three `SECURITY:` domain tests hold that line.

  Takes an `OrgVolunteer.id`, never a `User.id`: the roster projection deliberately withholds
  `User.id` from clients, and resolving the row through `findOrgVolunteerById(orgId, …)` means the
  org relationship is proven by construction rather than by a separate
  `requireOrgVolunteerRelationship` call.
- **Attendance.** **Already exists.** `shifts.markAttendance` (`routers/shifts.ts:143-159`) is a
  `staffProcedure` taking an arbitrary `userId`, wired into `shifts/page.tsx:252` and the
  search-by-name fallback at `scan/Scanner.tsx:97`. It requires a pre-existing `ShiftSignup`
  (`shiftSignupService.ts:317`), which `assignVolunteerToShift` now provides. No new attendance
  code.
- **Reports.** No changes needed. Verified with a test, not new code.

### 5. One list of volunteers (E1a)

Approving a `VolunteerApplication` creates an `OrgVolunteer` row with `source: APPLIED`, **when
`submittedByUserId` is non-null.**

Because the partial index is invisible to Prisma, this is not `upsert`.

⚠️ **Corrected during implementation (v0.34.0.0).** This paragraph prescribed
`findFirst({ orgId, userId, deletedAt: null })` then `create` with a `P2002` catch. That
shape cannot work here. In Postgres a failed statement poisons its whole transaction:
verified against this database, swallowing a P2002 inside `prisma.$transaction` and issuing
any further statement fails with `current transaction is aborted, commands ignored until end
of transaction block`. Because the enclosing transaction must COMMIT — it carries the
approval, or the claim and its audit row — a concurrent roster race would have rolled the
approval back.

The implementation uses `createOrgVolunteerIfAbsent()` in `orgVolunteerRepo.ts`, a
`createMany({ skipDuplicates: true })` compiling to `ON CONFLICT DO NOTHING`, which the
server resolves without raising. Also verified that this honours the PARTIAL index, so a
previously-removed volunteer is re-added rather than silently skipped. Both facts are pinned
by `repositories/appliedRoster.integration.test.ts`, including a test that deliberately
reproduces the abort.

`addVolunteer` deliberately keeps the catch-outside-the-transaction shape: there the
duplicate IS the answer the coordinator needs ("Already on your roster").

**Gate on the TRANSITION into APPROVED, not the resulting status.**
`updateOrgApplicationStatus` is not idempotent — re-saving an already-APPROVED application
re-runs the update — so `status === 'APPROVED'` alone would resurrect a volunteer a
coordinator had deliberately removed, since the soft-deleted row does not block a fresh
insert. The condition is `previousStatus !== 'APPROVED'`, matching the guard
`notifyApplicationStatusChange` already uses.

**Also create the row in the CLAIM path.** ⚠️ Updated 2026-07-27 — this paragraph previously
named `linkApplicationsToUser` (`my-applications.ts:96-107`), which **no longer exists**. That
function auto-attached applications by email on every page load and was deleted as a privilege
escalation; binding is now an explicit user action.

The second entry point is `claimApplication()` in `my-applications.ts`. An application approved
*before* the applicant ever signed in gains `submittedByUserId` at the moment they claim it, and
without handling it there the roster row is never created — leaving an APPROVED application with
a `submittedByUserId` and no `OrgVolunteer` row, never reconciled. Cover both entry points, and
create the roster row **inside the same `prisma.$transaction` as the bind and its
`APPLICATION_CLAIMED` audit row**, so a partial commit cannot produce that inconsistency.

**Anonymous applications (`submittedByUserId = null`) do not create roster rows in v1a.** Doing so
would mean minting a shadow `User` from `submittedByEmail` on every approval, which changes the
semantics of every public application, has no source for `displayName` (anonymous applications
carry only an email, and `DEFAULT_SCREENER_QUESTIONS` has no name question), and would be the
largest task in the plan. Deferred to v1b, where the invite flow gives shadow users a purpose.
**Consequence, accepted knowingly:** an org with anonymous applicants carries a partial roster
until v1b. Do not describe the roster as complete.

## Security & Privacy

1. **Wrong-email risk.** In v1a nothing is sent to a mistyped address and nothing is shown to
   them, so the blast radius is a row in one org's list. This is why the invite flow is deferred:
   v1b is where a typo reaches a human inbox. ⚠️ Updated 2026-07-27 — the stated prerequisite was
   "`linkApplicationsToUser` org scoping (TODOS.md P1)", which is **resolved**: that function is
   deleted and binding is now an explicit claim the recipient must accept (see §"NOT in scope"
   and the resolved P1 in TODOS.md). A coordinator typo can no longer silently attach anything;
   it produces an offer to the wrong recipient, which they must decline or ignore.

2. **Org adds an ACTIVE user's email.** That user is notified and can remove the roster link.
   ⚠️ Updated — this was **aspirational when written**: the notification shipped with T12 and
   linked to `/app/profile`, but the surface it promised did not exist until T32. Now real:
   `leaveOrgRoster()` behind the "Organizations you volunteer with" section on `/app/profile`.

   ✅ **Updated again (v0.37.0.0): the exit now revokes, and the button means it.** As shipped in
   T32 it soft-deleted the `OrgVolunteer` edge only, which closed almost nothing — a `ShiftSignup`
   satisfies `requireOrgVolunteerRelationship` with no status filter and staff mint one
   unilaterally via `assignVolunteerToShift`, and `addVolunteer` recreates the roster row from an
   email address anyway. `leaveOrgRoster` now also writes an `OrgVolunteerBlock` in the same
   transaction. That row overrides every relationship kind except `ORG_MEMBER` and
   `EXISTING_CREDENTIAL`. Four paths refuse while it stands: the three that CREATE a roster row
   (`addVolunteer`, `ensureAppliedRosterRow`, `restoreVolunteer`) plus `assignVolunteerToShift`,
   which creates none but reads one directly. It is the only state in this relationship staff cannot clear, which is
   the entire point: the previous design left the volunteer with nothing the org could not undo.

   The two exemptions are deliberate. `ORG_MEMBER` is staff membership, not a volunteer
   relationship, and without the exemption a coordinator who is also on their own org's roster
   would lock themselves out of their own organisation by leaving it. `EXISTING_CREDENTIAL` is
   opt-in and reached by `revokeCredential` alone, which is strictly narrowing — suppressing it
   recreated the dead end `acceptExistingCredential` exists to prevent, a credential
   `listOrgCredentials` still shows but nobody can ever revoke.

   Lifted **only** by the volunteer re-engaging of their own accord — submitting an application
   **while signed in**, claiming one, or signing up for a shift (`liftOrgVolunteerBlock()`). The
   signed-in condition is load-bearing: `screener.submit` is a `publicProcedure` carrying an
   attacker-supplied address, so an anonymous submission must never clear a block. There is deliberately no
   org-initiated lift; an org that wants someone back asks them, which is what v1b's
   `VolunteerActivationInvite` will carry.

   **The volunteer's list is keyed on ACCESS, not on the roster.** `listMyOrgRelationships()`
   returns every org holding any authorizing edge — roster row, `VolunteerApplication`, or
   `ShiftSignup`. The first cut listed live roster rows only, which let an org deny the remedy
   outright: remove the volunteer, and the row vanished from their profile along with the Leave
   button, while the `ShiftSignup` staff had minted kept satisfying the guard. So leaving is
   addressed by `orgId`, the soft delete became the optional half, and the block the mandatory
   one. Note there are **four** roster-row creators that must refuse while a block stands, not
   three: `restoreVolunteer` is the one that does not look like a create, and it was missed
   until review caught it.

   Still narrower than deletion, and the UI says so: the application stays sent, recorded hours
   stay recorded. What changes is that neither is a key any more.

   **Two things this does NOT cover**, both now tracked in `docs/TODOS.md`: an org can still
   background-check a volunteer it rostered who never left and never consented (the block answers
   "I left", not "I never agreed"); and an UNCLAIMED shadow user has no account, so never sees
   this control at all.

3. **Cross-org name collision — accepted, not closed.** `User.email` is unique, so two orgs adding
   the same person share one `User` row and `User.name` is global. First-writer-wins means org B
   sees whatever org A typed. Accepted after the alternative was scoped three times and kept
   growing (see Flow §1).

4. **Unclaimed invisibility.** `ProfileVisibility.PRIVATE` on creation. Most originally planned
   exclusion filters are **already satisfied**: `volunteerDiscoveryRepo.ts:55-58` hardcodes
   `visibility: 'PUBLIC'`; the opportunity digest selects on `UserMarketplacePreference`, the
   notification digest on `UserDigestPreference`, and re-engagement on `OrganizationMember` — a
   shadow user has none. The one real exposure is **shift reminders**
   (`shift-reminder-service.ts:75`), created by `assignVolunteerToShift` and covered by the guard.

5. **Org-relationship authorization.** Several staff endpoints take a naked `userId` or `shiftId`
   with no check that the target relates to the caller's org:
   `profile.getOrgVisibleProfile` (`routers/profile.ts:73`), `credentials.issue`
   (`routers/credentials.ts:47`), `credentials.revoke` and `credentials.remove`
   (`routers/credentials.ts:70-97`), background-check initiate (`routers/background-checks.ts:45`),
   and the shift routes at `routers/shifts.ts:55,139` whose reads
   (`shiftRepo.ts:10`, `shiftSignupRepo.ts:10`) are not org-scoped.

   **The predicate must not be roster-only.** Applicants have no `OrgVolunteer` row, E1a creates
   rows on APPROVED, and background checks run at **REVIEW** — so a roster-only check would take
   background-check initiation offline for every PRO org on merge. That is the flagship paid
   feature.

   ```
   requireOrgVolunteerRelationship(orgId, targetUserId) passes if ANY of:
     - OrgVolunteer         { orgId, userId: targetUserId, deletedAt: null }
     - VolunteerApplication { orgId, submittedByUserId: targetUserId }   (any status)
     - OrganizationMember   { orgId, userId: targetUserId }
   ```
   Mandatory test: a REVIEW-stage applicant with no roster row still passes.
   **Accepted trade-off:** a REJECTED applicant from two years ago passes permanently; there is no
   de-authorization path. A broader sweep of every `staffProcedure` taking a naked id is filed as
   a P1 TODO.

   **Shipped as (v0.32.1.0)** — the plan's three-way predicate grew to four probed kinds plus one
   opt-in: `APPLICATION`, `ORG_VOLUNTEER`, `SHIFT_SIGNUP` (joined through `Shift.orgId`),
   `ORG_MEMBER`, and `EXISTING_CREDENTIAL` behind `acceptExistingCredential`, which
   `revokeCredential` alone passes so a de-rostered volunteer's credential stays revokable.
   `VolunteerInvitation` and `OpportunityInterest` were considered and rejected — staff can mint
   both against a stranger, which would void the guard. Landed on four callsites: profile read,
   credential issue, credential revoke, and background-check initiate (in the shared
   `initiateProviderCheck()` path, so Sterling is covered too). `credentials.remove` needs no
   guard — it deletes on the `(userId, orgId, type)` compound key. The `shifts.ts` /
   `shiftRepo.ts` / `shiftSignupRepo.ts` org-scoping half of T7 is still open. Code:
   `src/server/services/orgVolunteerAccessService.ts`, `repositories/orgVolunteerRepo.ts`.

   ⚠️ **Amended in v0.37.0.0.** This set is still what the guard PROBES, but an
   `OrgVolunteerBlock` now suppresses all of it except `ORG_MEMBER` and `EXISTING_CREDENTIAL`. If
   you are reading this section to answer "what does the guard accept?", the answer is
   "these kinds, unless the volunteer has revoked the org" — see §2.

6. **Erasure.** Roster removal soft-deletes the edge only. A separate platform-admin scrub nulls
   `name`/`email`/`phone` on the shadow `User` for a genuine erasure request. Hard-deleting the
   `User` is **not** an option: `ShiftSignup.userId` is `onDelete: Cascade` and would silently
   destroy attendance history the org entered and reported on.

7. **Account enumeration — accepted.** The add form's differing copy for "email unknown" vs
   "email belongs to an existing user" lets authenticated staff probe whether an address has an
   account. The information is low-value, the attacker must already be org staff, and the copy
   difference is how a coordinator learns their volunteer was notified rather than created.

8. **Bulk PII egress.** The roster CSV export is a bulk read of names, emails, and phone numbers.
   Streamed, capped at 10k rows with the limit stated in the response, rate-limited via the
   existing `rateLimitByOrg` middleware, and audit-logged as `ROSTER_EXPORTED`.

## Rollback posture

The per-org feature flag gates the page and the mutations. It does **not** gate the three
platform-wide changes, which are the ones most likely to cause an unpredicted problem:

| Change | Reversible by | Mechanism |
|---|---|---|
| `/app/volunteers`, roster mutations | per-org flag | `staff_created_volunteers`, default `false` |
| Email guard (T4) | env kill switch | `UNCLAIMED_EMAIL_GUARD_ENABLED` |
| `accountState` flip (T5) | env kill switch | `ACCOUNT_STATE_FLIP_ENABLED` |
| Google account linking (T6) | env kill switch | `GOOGLE_EMAIL_LINKING_ENABLED` |
| Schema | forward-only | additive; no rollback needed |

Without the kill switches, rolling back those three means `git revert` plus a deploy, which is
roughly ten minutes of broken auth for everyone.

## v1a Scope

- DB-level email canonicalization + backfill **(prerequisite)**
- `AccountState`, `OrgVolunteerSource`, `User.accountState`/`claimedAt`, `OrgVolunteer` table,
  partial unique index, migration
- `staffVolunteerService` (add / remove) + repo + `VOLUNTEER_ADDED` / `VOLUNTEER_REMOVED` audit
  via `writeAuditLogTx`, with `metadata.impersonatedBy = ctx.realUserId`
- `/app/volunteers` roster page: add form, badges, remove, **cursor pagination**
- `assignVolunteerToShift()` with `allowOverCapacity` (single-assign)
- E1a: roster row on application approval and in the sign-in link path
- `sendEmail` opt-in unclaimed guard + `EmailEvent.SUPPRESSED_UNCLAIMED` + env kill switch
- `accountState` flip via NextAuth events + env kill switch
- `allowDangerousEmailAccountLinking` + env kill switch
- `requireOrgVolunteerRelationship()` + 6 callsites + org-scoped shift reads
- Roster notification email for the existing-ACTIVE-user path, escaped via `lib/html.ts`
- Roster CSV export at `/api/org/[orgId]/roster/csv`
- Platform-admin PII scrub
- `staff_created_volunteers` in `FEATURE_FLAG_REGISTRY`, default `false`
- Concierge import script: per-row transactions, idempotent, `--dry-run`
- `checkin-token.ts` timing-safe compare fix
- Marketing copy (ships only when the flag default flips platform-wide)
- Tests per the coverage plan

## v1b Scope (deferred, specified)

`VolunteerActivationInvite` model, DB-backed token lib following `src/server/lib/tokens.ts`
(random token + SHA256 at rest — **not** the stateless HMAC pattern of `checkin-token.ts`, which
signs a self-contained payload and carries no server-side row), invite email
(`{Org} via VolunteerReady`, reply-to the coordinator, `List-Unsubscribe` header and postal
address for CAN-SPAM), `/welcome/[token]` at **top level** (sibling to `apply/` and
`credentials/`, not inside `(public)/` — token URLs must not enter `PUBLIC_PAGES`/sitemap; needs
its own `layout.tsx` + `providers.tsx` copied from the `opportunities/` pair), claim + decline
paths, expiry, one org-triggered reminder, per-org invite rate limiting, and E1b (mint an
UNCLAIMED user on approval of an anonymous application).

**~~Blocked on:~~ UNBLOCKED (2026-07-27).** `linkApplicationsToUser()` is deleted. It ran
`updateMany({ where: { submittedByUserId: null, submittedByEmail: email } })` with no `orgId`
filter, so any orphan application matching a signing-in address was silently attached. Replaced
by an explicit claim step (`listClaimableApplications()` / `claimApplication()`), which resolves
the wrong-email scenario Security §1 worries about: a coordinator typo now produces an offer the
wrong recipient must actively accept, not a silent bind. See the resolved P1 in TODOS.md.

**Do not hand-roll the session mint.** Only `e2e/utils/db.ts:65` creates NextAuth `Session` rows
today and there is zero production precedent. Prefer issuing a NextAuth `VerificationToken` and
redirecting through the standard email callback, so cookie naming (`__Secure-` prefix by
protocol), `emailVerified`, and events are handled by machinery that already works.

## What already exists (reuse, do not rebuild)

| Capability | Where | Original assumption |
|---|---|---|
| Staff manual attendance, incl. by-name kiosk | `routers/shifts.ts:143-159`, `Scanner.tsx:97` | "ensure the UI supports it" — it already does |
| Hours / impact aggregation over shadow users | 4 implementations, none filtering on Account/Session | correct; verify with a test |
| Discovery exclusion | `volunteerDiscoveryRepo.ts:55-58` hardcodes `PUBLIC` | listed as work; already satisfied |
| Digest / marketplace / re-engagement exclusion | preference + membership rows shadow users lack | listed as work; free by construction |
| Feature flag model + registry | `schema.prisma:234-247`, `domain/feature-flags.ts` | "Feature flag (`FeatureFlag` model)" — exists |
| Per-org rate limiting, two patterns | `rateLimitByOrg`; DB-counter at `orgService.ts:258-271` | needed for the CSV export and v1b invites |
| DB-backed token pattern | `src/server/lib/tokens.ts` | draft cited the wrong precedent |
| Address-keyed suppression in the email chokepoint | `email.ts:27-43` | `canEmail(user)` had the wrong signature |
| CSV export route shape | `api/esg-report/csv/route.ts` | copy the auth shape, not the global path |

## NOT in scope

1. **Invite / claim flow and E1b (v1b)** — ~~blocked on `linkApplicationsToUser()` org scoping~~
   **UNBLOCKED 2026-07-27** (that function is deleted; see the "Blocked on" note above). Still out
   of scope for v1a on size alone, not on a dependency.
2. **CSV import UI** — deferred pending five real spreadsheets. The concierge script is the bulk
   path; the single-add form is the trickle path. They do different jobs.
3. **Bulk-select assign to shift** — cut. `validateSignup` has no waitlist outcome and
   `signUpForShift` only creates `CONFIRMED`, so "9 confirmed, 3 waitlisted" needs new domain
   behavior, not just UI. Filed in TODOS.md.
4. **Never-write-`User.name` with an org-scoped display name everywhere** — reconsidered and
   reversed to first-writer-wins after the surface count grew from 1 to 3 to 8+.
5. **Fuzzy duplicate detection** — same human under two addresses.
6. **No-email volunteers** — requires making `submittedByEmail` nullable.
7. **Shift reminder emails to unclaimed volunteers** — suppressed by the guard; enabling them
   needs its own consent thinking.
8. **Promoting `impersonatedBy` into `AuditLogInput`** — TODOS.md :1635.
9. **The items filed in TODOS.md** under the staff-created-volunteers review sections.

Design deferrals (`/plan-design-review`):

10. **Staff-side waitlist when assigning to a full shift** — `signUpForShift` only creates
    `CONFIRMED`, so this needs a position-ordering decision against volunteer-initiated waitlist
    entries. Same root cause as #3. Filed as a TODO.
11. **Deep-linkable `/app/volunteers/[id]` route** — the D4 dialog covers v1a; promote it when a
    coordinator asks to send a colleague a link. Filed as a TODO.
12. **Assigning from a roster row** — a second entry point for `assignVolunteerToShift`. Rejected
    for v1a because picking a shift from the roster means picking it blind, and the over-capacity
    override becomes a prompt about a number the coordinator cannot see.
13. **Inline add-form card below the table** — better rhythm for batch entry, and it is the one
    existing add-a-person-by-email precedent (`team/page.tsx:263-313`). Reversed in favour of the
    header dialog on visual grounds; D12's stay-open behaviour recovers most of the ergonomics.
14. **Avatars in the roster** — no table in this app has them; introducing them here would be
    net-new vocabulary for no informational gain.

## Failure modes

| Codepath | Failure | Test? | Handled? | User sees |
|---|---|---|---|---|
| `sendEmail` guard | Guard suppresses a transactional sender | T9 | opt-in default | nothing — this is why the guard is opt-in |
| Email guard lookup | Case-variant email misses the row, fails open | T9 | DB-level canonicalization | silent; closed by T1 |
| `accountState` flip | No hook; user stays UNCLAIMED forever | T9 | `events.signIn` (**not** `updateUser` — see §2) | silent mail suppression |
| Google sign-in | `AccountNotLinkedError` on a shadow user's email | T15 ✅ | `allowDangerousEmailAccountLinking` | hard error, no recovery |
| Suppressed send | Cannot answer "did they get it?" | T9 | `EmailEvent.SUPPRESSED_UNCLAIMED` | queryable |
| `addVolunteer` notify | Resend down; roster row rolls back with the email | T14 | fire-and-forget outside tx | roster row missing |
| `addVolunteer` dup | Two coordinators add the same email concurrently | T14 | partial index → P2002 | "Already on your roster" |
| Re-add after removal | Soft-deleted row blocks the insert | T2 | partial index `WHERE deletedAt IS NULL` | succeeds |
| `assignVolunteerToShift` | Shift fills between page load and submit | T14 | domain `validateSignup` | over-capacity confirmation |
| Roster list | Org exceeds page size; rows truncated | T14 | cursor pagination | complete list |
| CSV export | Org with 50k rows | T19 | streamed, 10k cap, rate-limited | stated limit |
| Concierge script | Row 31 of 60 fails | T17 | per-row tx, idempotent re-run | summary report |
| Org-relationship helper | Applicant at REVIEW has no roster row | T9 | three-way predicate | passes |
| PII scrub | Scrub cascades and deletes attendance | T14 | null fields, never delete User | hours preserved |

**Critical gaps (no test AND no handling AND silent): 0.** Three were identified and closed: the
magic-link guard trap, the missing `accountState` hook, and unobservable suppression.

## Test coverage

`/qa`-consumable test plan:
`~/.gstack/projects/thehashrocket-volunteerready.org/jasonshultz-thehashrocket-staff-created-volunteers-review-eng-review-test-plan-20260726-131131.md`

Baseline before this work: **3 of 50 paths covered (6%)**. Only the reused `domain/shift.ts`
rules, the `sendEmail` bounce branch, and `checkin-token` have existing tests.

`shiftSignupService.ts` has **no test file at all**, unlike its siblings `shiftWaitlistService`,
`shiftCompletionService`, and `checkinService`. v1a adds tests for `assignVolunteerToShift` and
backfills `markAttendance`; the remaining three functions are a P3 TODO.

Conventions: `vi.hoisted()` + `vi.mock` of the repository layer (not a mock Prisma client),
`$transaction` stubbed as `async (fn) => fn(fakeTx)`, `auditRepo` always mocked and asserted.
Security cases prefixed `it('SECURITY: …')`. The e2e spec follows
`impersonation-company-picker.spec.ts`, and its `afterAll` deletes only the ids its own
`beforeAll` created — never a prefix sweep (CLAUDE.md:71).

## Design Specification (v1a)

From `/plan-design-review`, 2026-07-26. 20 decisions. Design completeness 3/10 → 9/10.
Approved visual reference is recorded under **Approved Mockups** below; where this section
and the mockup disagree, this section wins.

### Information architecture

- **Nav.** `{ label: 'Volunteers', href: '/app/volunteers', icon: BookUser }` inserted into
  `STAFF_NAV` immediately after `Applications`, so the list reads in funnel order. `BookUser`
  rather than `Users` (taken by Team) or `UsersRound` (visually confusable with it at 16px).
  Add a case to `app-sidebar.test.tsx`. `getActiveHref()` needs no change and already handles
  a future `/app/volunteers/[id]`.
- **Row click opens a volunteer detail dialog**, matching `ShiftDetailDialog` — a list row
  opens a dialog in this app, it does not push a route. Shows org `displayName`, email, phone,
  date added, shift history with attendance, total hours. Reuses `getOrgVisibleProfile`
  (hardened by T7) and `getAttendedShiftsForUser`. The row becomes clickable, so `Remove`
  needs `e.stopPropagation()` — pattern at `OpportunitiesClient.tsx:255`.
- **Assign-to-shift lives inside `ShiftDetailDialog`**, not on the roster row. That dialog
  already shows `{signups}/{capacity}`, the check-in strip and the waitlist, which is the
  context the decision needs. A search-as-you-type picker over the org roster sits above the
  signups table, built on `command.tsx` (cmdk). **Correction (eng re-review): it is not unused.**
  Three consumers exist — `settings/team/page.tsx`, `opportunities/OpportunityDialog.tsx`,
  `my-skills/page.tsx`. Copy the `team/page.tsx` one; it is a person picker keyed by email, the
  same job.

### Screen: `/app/volunteers`

Columns: **Volunteer** (two lines: name medium, email 12px muted, no avatar) · **Added**
(date over muted relative, matching `applications/page.tsx:180`) · **Shifts** · **Status** ·
right-aligned actions. Search input and `Export CSV` share a row above the card. Cursor
pagination renders as a centred `Load more` inside the card — never numbered pages.

**No avatars anywhere.** None exist in any table in this app today; introducing them here
would be net-new vocabulary for no gain.

**`Shifts` column** counts `ShiftSignup` with `status = 'ATTENDED'` **joined through
`Shift.orgId = ctx.orgId`**. One grouped query per page, not an N+1. Counting off the `User`
without the org join would show org A how many shifts a shared volunteer worked for org B —
same bug class as v0.29.2.0/v0.29.3.0. Mandatory `SECURITY:` test: a volunteer on two rosters
shows each org only its own count.

### Status badge

One shared component, `src/components/volunteers/volunteer-status-badge.tsx`, following
`ApplicationStatusBadge` exactly (a `statusConfig` record rendered through one `<Badge>`):

| State | Label | Variant | Icon |
|---|---|---|---|
| `UNCLAIMED` | `No account yet` | `neutral` | `Clock` |
| `ACTIVE` | `Has account` | `success` | `CheckCircle2` |

Renders in **three** places — roster table, assign picker, `ShiftDetailDialog` signups table —
across two worktree lanes, which is why it is a component and not an inline map.

`neutral`, not `warning`: `neutral` is the established inert not-yet state (DRAFT, EXPIRED);
`warning` means "needs your attention" (REVIEW, WAITLISTED).

**Wording is deliberate and supersedes the plan's original "Not activated".** Three independent
mockup generations, given no guidance, all reached for "Active / Inactive" — which reads as
*volunteer engagement*, not *account state*. "Not activated" fails the same way, and worse:
with v1b deferred there is no invite button, so it labels every row with a deficiency the
coordinator cannot act on, on the primary screen of a feature whose own scope note says it
"succeeds even at 0% activation". "No account yet / Has account" states a fact about the
account instead.

**No hex anywhere in the new surfaces.** All semantic tokens already carry `.dark` values
(`globals.css:116-127`, `:166-177`), so dark mode is free through variants and broken by
literals. Includes D11's over-capacity count, which uses `text-warning-foreground`.

### Interaction states

| Surface | Loading | Empty | Error | Success | Partial |
|---|---|---|---|---|---|
| Roster list | `PageHeader` + table-shaped skeleton with real `<TableHead>` labels and width-matched cells (`applications/page.tsx:40-75`), so nothing reflows | see below | `QueryErrorCard` + `safeErrorMessage()` | rows render | `placeholderData: (prev) => prev` on paginate, so `Load more` never blanks the list (`discover-client.tsx:271`) |
| Add volunteer | button `Adding…` | n/a | inline `text-sm text-destructive` under the field | dialog **stays open**, fields clear, focus returns to Name, footer shows running `3 added`, primary becomes `Add another` beside `Done` | duplicate → `Already on your roster`, not an error toast |
| Remove | — | — | toast error | **no confirm**; row collapses, toast with `Undo` | Undo clears `deletedAt` on the same row, preserving `addedByUserId`/`createdAt` |
| Assign to shift | picker spinner | `No volunteers match that search.` | toast error | toast naming person + shift | full shift → inline confirm, see below |
| Detail dialog | skeleton rows | `No shifts yet` | `QueryErrorCard` | — | — |

**Empty state (true empty).** `EmptyState` with `icon={BookUser}`, title `No volunteers yet`,
description *"Add the volunteers you already work with. They don't need to sign up first — you
can schedule them and track their hours right away."*, action `Add volunteer`. Beneath the card,
a quiet secondary line: *"Have a spreadsheet? Send it over and we'll import it for you."*
linking to `FOUNDER_BOOKING_URL`.

**Empty state (filtered).** `No volunteers match that search.` — the house distinction between
true-empty and filtered-empty (`admin/platform/users/page.tsx:53-55`).

**The concierge line persists until the roster reaches 10 rows**, then disappears. Same
threshold as the success metric and the T20 checklist milestone. The org that types three names
and stalls is exactly the org that needs the offer and, if it lived only in the empty state,
is exactly the org that would never see it again.

**`Export CSV` is hidden at 0 rows.** T19's 10k cap is surfaced as a final row in the file
~~plus a toast~~ — never a silent truncation (the failure mode of open TODO :137).

⚠️ **Corrected in v0.38.0.0 — the toast half was never buildable.** The final row shipped and is
the whole mechanism. `Export CSV` is a plain `<a href>` to `/api/org/[orgId]/roster/csv`, so the
browser owns the download: the page never receives the response, never learns the row count, and
has no event to hang a toast on. Getting one would mean fetching the CSV into JS to inspect it
and then re-materialising the file as a Blob — buying a toast by loading a 10k-row export into
memory twice. The truncation notice therefore lives **only** in the file, which is also the one
place the person who opens it three days later will still find it. The same mechanism carries the
interrupted-stream case (`formatFailureNotice` — a partial export ends by saying the file is
INCOMPLETE and must not be used), so the file is where both failures are disclosed, and neither
is disclosed anywhere else. Both notices are padded to the full column width, so a strict parser
does not read them as a phantom volunteer.

### Add-form copy — three branches, two of which must be identical

Flow §1 branches three ways and the plan specified copy for none of them.

| Branch | Toast |
|---|---|
| Email unknown → shadow user minted | `Ava Thompson added to your roster.` |
| Email is an `UNCLAIMED` user another org created | **identical to the row above** |
| Email is an `ACTIVE` user | `Ava Thompson added to your roster. We let them know by email.` |

**`// SECURITY:` — branches one and three must never diverge.** Security §7 reasons about
"unknown vs existing" and accepts account enumeration. There are three branches, not two, and
if the other-org-`UNCLAIMED` case reads differently the coordinator learns that *some other
organisation already has this person on their roster*. That is cross-org membership disclosure,
which §7 did not accept.

Persistent hint under the email field: *"If they already use VolunteerReady, we'll let them know
you added them."* The coordinator is causing mail to be sent to a third party on the org's
behalf and should know before submitting, not after.

### Shift-reminder suppression must be visible

`shift-reminder-service.ts:75` sets `suppressUnclaimed`, so assigning a volunteer with no
account silently guarantees they are never reminded. The plan's own justification for inverting
the email guard was that failures should be "visible and recoverable" rather than "invisible";
that argument applies here and was not carried through to the UI.

1. Assign picker rows carry the `No account yet` badge, so the state is known before choosing.
2. Confirmation toast: *"Maria Garcia added to Saturday Morning Sort. She won't get an automatic
   reminder — no account yet."*
3. **Persistent** in `ShiftDetailDialog`'s signups table: those rows keep the badge, and a
   summary line above the table reads *"3 volunteers won't get an automatic reminder."*

Point 3 is the one that matters. Assignment happens weeks out; the coordinator needs this on the
Friday afternoon they are checking Saturday is covered, and that is when they can act on it.

### Over-capacity confirm

Selecting a person for a full shift swaps the picker footer for a confirm strip:
*"Saturday Morning Sort is full — 9 of 9 spots taken. Add Maria Garcia anyway?"* → `Cancel` /
`Add anyway`, setting `allowOverCapacity: true`. Afterwards the signups header shows `10 / 9`
with the count in the warning tone, so the exceeded state stays visible rather than normalising.
Confirm takes focus on open and cancels on Escape.

No staff-side waitlist path in v1a — `signUpForShift` only creates `CONFIRMED`. Filed as a TODO.

### Volunteer-facing surface

In v1a the T12 notification is the **only** volunteer-facing artifact. Security §2 claimed the
recipient "can remove the roster link"; no such surface existed. It does now: an
**Organisations** section on `/app/profile` listing orgs that have this person on a roster, each
with a quiet `Leave` that soft-deletes the `OrgVolunteer` row and writes `VOLUNTEER_LEFT`. The
T12 email says what happened, who did it, and links there.

⚠️ **Superseded in v0.37.0.0 — this paragraph describes T32 as shipped, not current behaviour.**
The list is keyed on ACCESS, not the roster: it also includes orgs holding only an application or
a shift signup, because those authorize too. The soft delete became the OPTIONAL half and the
`OrgVolunteerBlock` write the mandatory one. See §2.

### Payoff

Roster header description is two parts: `62 volunteers · 1,240 hours recorded`, sourced from the
existing grouped hours query (`orgAnalyticsRepo.ts:174`). Roster adds emit into the existing
`ActivityFeed`, which also serves as feature discovery for other staff. Without this, a
coordinator maintains a list for three months and the product never tells them it was worth it.

### Motion

DESIGN.md: minimal-functional, ease-out enter, 150-250ms short. `globals.css:216` **already has
a global `prefers-reduced-motion` block** — inherit it, do not bypass it.

- New row: fade + slide, 200ms ease-out. Header count animates, so the change is visible even
  when the row lands below the fold (D12 keeps the dialog open over the list).
- Removed row: height collapse, 150ms ease-in, so the `Undo` toast has a referent.
- `Load more`: appended block gets the same 200ms enter, no scroll jump.

### Responsive

| Viewport | Roster | Add form |
|---|---|---|
| `< lg` | `Card` + `divide-y` full-width tappable rows (`Scanner.tsx:505-522`, `admin/platform/users/page.tsx:57-89`). Name, muted email, right-aligned badge. `Added` and `Shifts` drop out — reference data, one tap away in the detail dialog. Search full width. | `Drawer` via `useMediaQuery` (`feedback-widget.tsx:252`, `org-profile-form.tsx:399-435`). Matters more given D12: a stay-open modal fighting the keyboard is far worse than a bottom sheet. |
| `≥ lg` | Table as specified | Dialog |

Horizontal-scroll tables are not an acceptable mobile answer. This is the first table in the app
designed for a phone; the other four are filed as a TODO.

### Accessibility

Four of the decisions above created obligations the primitives do not cover:

- Focus returns to the name input after each successful add; the running count is
  `aria-live="polite"`.
- The animated header count is `aria-hidden` during transition with the value exposed statically,
  so a screen reader hears `62 volunteers` once rather than counting.
- Search gets an `sr-only` `<Label>` — placeholder-as-label fails once the field has content, and
  the one existing staff search (`admin/platform/users/page.tsx:29-42`) gets this wrong.
- Mobile row buttons get `aria-label="View {name}"`.
- **`Remove` moves out of the mobile row into the detail dialog** — a `Remove` button inside a
  full-width tappable row is a nested interactive target and a mis-tap generator.
- Desktop `Remove` is `h-11`, matching the repo's 44px convention (`shifts/page.tsx:595-641`,
  `app-shell.tsx:57`).
- Badge icons are `aria-hidden`; the label carries the meaning.

### Feature-flag gating

**T16 cannot pass its own verify step as written.** `isFeatureEnabled()` has zero production
callsites, there is no client flag read path, and `AppSidebar` receives only
`hasOrg`/`hasCompany`/`companyId` (`app/layout.tsx:85`).

Resolve `isFeatureEnabled(orgId, 'staff_created_volunteers')` in `app/(app)/app/layout.tsx`,
thread a fourth prop through `AppShell` → `AppSidebar` following the `hasOrg` idiom, and guard
the route with a server-side `redirect()` — nav hiding is cosmetic and the route must close
independently. Re-estimated at ~3h, not 1h.

**There is no `orgId` in that layout** (eng re-review). `app/(app)/app/layout.tsx:50` runs
`prisma.organizationMember.count()` — a count, deliberately, never an id. Getting one means
reading `session.orgId`, which `trpc/init.ts:77` **nulls under impersonation** and then
re-resolves across ~60 lines of membership fallback. The layout must do the same or the flag
resolves against the wrong org for an impersonated multi-org target — the v0.29.2.0 /
v0.30.0.0 bug class. Also note `AppShell` renders `AppSidebar` **twice** (`app-shell.tsx:130`
desktop aside, `:148` mobile drawer); the fourth prop threads to both.

**The flag boundary must cover every staff surface, not just the page.** The design review moved
this feature's central mutation onto `/app/shifts` (T24), its disclosure onto the same page
(T23), and events into the dashboard `ActivityFeed` (T31). Gating only `/app/volunteers` means a
non-pilot org opens a shift and finds an "Add volunteer" picker backed by a roster they cannot
see or populate.

```
staff_created_volunteers = false
  ├─ GATED  /app/volunteers route + nav item        (T11, T16)
  ├─ GATED  assign picker in ShiftDetailDialog      (T24)
  ├─ GATED  suppression disclosure on shifts        (T23)
  ├─ GATED  roster adds in ActivityFeed             (T31)
  ├─ ON     OrgVolunteer rows on approval / link    (T10)  ← roster is warm at flip
  └─ ON     /app/profile Organisations + Leave      (T32)  ← rows exist, so must the exit
```

T10 stays ungated deliberately: roster rows accumulate from application approvals for every org
from merge onward, so the roster is populated the day the flag flips. T32 stays ungated because a
volunteer must be able to leave a roster that exists whether or not staff can see the page.
Without this split the "Rollback posture" table below overstates what the flag contains.

Note this diverges from the only existing precedent: `PlanGate` (`shifts/page.tsx:654-658`)
leaves nav visible and gates content. That is right for a paid tier; this is a pilot flag with
nothing to upgrade to, so the item should simply not be there.

### DESIGN.md corrections required

`DESIGN.md:92` says the staff dashboard has a **forest green sidebar**. It does not:
`app-shell.tsx:128` is `border-r border-border/60` with no fill, sitting on the page background,
green appearing only on the active item as `bg-primary/10 text-primary border-l-2 border-primary`.
`DESIGN.md:68` says 220px; the implementation is `w-56` (224px). The 56px sticky top bar with the
org switcher is undocumented entirely.

This is not cosmetic. CLAUDE.md instructs every agent to read DESIGN.md before a visual decision,
and the first mockup round in this review came back with a solid green sidebar *because that is
what the design system says to build*. A design system that misdescribes the shipped product
produces confidently wrong work.

## Implementation Tasks

- [x] **T1 (P1, human: ~7h / CC: ~45min)** — schema — Canonicalize `User.email` at the database, backfill, case-insensitive index ✅ **CODE DONE — production backfill still gated, see below**
  - Surfaced by: Codex outside voice — service-layer lowercasing misses `PrismaAdapter` (`auth.ts:26`), the main write path
  - Files: `prisma/migrations/20260726225900_canonicalize_user_email/`, `prisma/schema.prisma` (doc comment only), `scripts/check-email-collisions.ts`, `scripts/seed-email-collision-fixture.ts`, `src/server/repositories/userEmailCanonicalization.integration.test.ts`
  - **Mechanism chosen: BEFORE INSERT/UPDATE trigger + functional unique index + backfill.** The plan said "a normalizing constraint", which is three different designs. A functional unique index alone was rejected: it stops duplicate rows but does **not** make `WHERE email = 'Bob@x'` case-insensitive, so the guard would keep missing and keep failing open — a fix that looks done and isn't. `citext` was rejected for the deployment dependency (`CREATE EXTENSION`) plus a column-type rewrite on `User`. A trigger covers every writer including `PrismaAdapter`, and this repo already ships triggers (`trg_opportunity_search_vector`)
  - **The functional index is deliberately redundant.** With the trigger in place, storage is always lowercase so the existing `User_email_key` already rejects case-variants (confirmed in rehearsal — the duplicate was caught by `User_email_key`, not the new index). It is kept as defense in depth: if the trigger is ever dropped, the index still refuses the row rather than letting a privacy control silently start failing open again
  - **Trade-off accepted:** storage is normalized, so `Bob@Shelter.org` reads back as `bob@shelter.org`. Prisma cannot see the trigger, so `create()` returns what you passed while the row holds the normalized value — re-read if you need the stored form. Documented on the `User.email` field in `schema.prisma`
  - Verify: ✅ 9 integration tests — lowercases on insert *with no service in the path* (the `PrismaAdapter` shape), trims whitespace, lowercases on update, rejects a case-variant duplicate with P2002, a lowercased lookup finds a mixed-case-created row (the actual bug), NULL emails preserved and multiple NULLs allowed, unrelated-column updates leave email alone, and both trigger and index assert present in `pg_trigger` / `pg_indexes`. Typecheck clean; 1502 unit + 72 integration + 9 script tests pass
  - Verify: ✅ **full migration rehearsal in a scratch database.** Built the pre-T1 shape with two rows differing only by case, ran the real migration: it **aborted with the actionable message and left the data untouched** — no partial backfill. Resolved the collision, re-ran: backfilled the mixed-case row, preserved NULLs, installed trigger + index. Then confirmed a new `  NEW@Person.IO ` insert stored as `new@person.io` and a `BOG@SHELTER.ORG` duplicate was rejected

  **Three CRITICALs found by the `/ship` data-migration review, all fixed here:**
  1. **Silent data loss — the backfill was not correlated.** Lowercasing `User.email` alone de-links every column matched against it by exact equality. `VolunteerApplication.submittedByEmail` is compared in `my-applications.ts:104` and `volunteerDashboardService.ts:57,135`, so every anonymous application submitted with a mixed-case address would have become permanently unclaimable and vanished from the volunteer's dashboard — no error, just an empty list. The backfill now also canonicalizes `submittedByEmail`, `OrganizationInvitation.email`, `CompanyInvitation.email` and `ApplicationStatusToken.email` (all verified non-unique, so no collision risk). Deliberately excluded and documented in the migration: `EmailBounceStatus.email` (UNIQUE, and already looked up lowercased), `LeadCapture.contactEmail` (never compared to `User.email`), `NotificationPreference.email` (a **boolean**, not an address).
  2. **Google sign-in lockout on the READ path.** The trigger covers every write but cannot cover a lookup: `PrismaAdapter.getUserByEmail` runs `findUnique({ where: { email } })` with the raw IdP address, so a profile with any uppercase would miss the lowercased row, fall through to `createUser`, and collide on `User_email_key` — a hard sign-in failure for someone who already has an account. Fixed with a `profile()` mapper on `GoogleProvider` (`auth.ts`) that normalizes to the same canonical form. `EmailProvider` needs no equivalent; NextAuth's default `normalizeIdentifier` already lowercases.
  3. **Migration ordering wedged the deploy pipeline.** The guard was timestamped AFTER the schema migration, so a RAISE would leave `20260726230000` committed and this one recorded as failed — P3009 on every subsequent deploy until an operator ran `migrate resolve`. **Renumbered to `20260726225900` so it sorts FIRST**; failing first means failing clean. `scripts/vercel-build.sh` now runs `pnpm check:email-collisions` before `migrate deploy`, so production never reaches the RAISE. Recovery steps documented in the migration header.

  Verified by clean replay on a scratch database: canonicalization applies first, the index is `lower(btrim(email))` (matching the trigger — a `lower()`-only index would fail open on whitespace variants if the trigger were dropped), the trigger installs, and the guard aborts on dirty data **leaving it untouched**.

  ⚠️ **STILL GATED FOR PRODUCTION.** The migration refuses to run if case-only collisions exist (Step 1 raises with a pointer to `pnpm check:email-collisions`), so it is safe to *attempt* — it fails clean rather than corrupting. But **run `pnpm check:email-collisions` against production before deploying** so the resolution is a decision rather than a failed deploy. Resolution rule if it finds any: keep the `emailVerified` row → else older `createdAt` → else lower `id`; repoint FKs from MERGE rows to the KEEP row **before** deleting, because `ShiftSignup.userId` is `onDelete: Cascade` and would destroy attendance history
- [x] **T2 (P1, human: ~4h / CC: ~25min)** — schema — `AccountState`, `OrgVolunteerSource`, `User` fields, `OrgVolunteer` + partial unique index ✅ **DONE**
  - Surfaced by: Architecture A1, corrections C1/C2 — roster-as-application has no dedup; soft delete conflicts with `@@unique`
  - Files: `prisma/schema.prisma`, `prisma/migrations/20260726230000_add_org_volunteer_and_account_state/`, `src/server/repositories/orgVolunteer.integration.test.ts`
  - Verify: ✅ 7 integration tests (`pnpm test:integration`) — live duplicate rejected with P2002, re-add after soft delete succeeds, 3 stacked soft-deletes coexist, one user on two orgs' rosters, `SetNull` keeps the roster row when the adding coordinator is deleted. Typecheck clean, 1492 unit tests pass. Confirmed: no compound-unique input is generated, so `upsert`/`findUnique` on the pair genuinely do not typecheck — the constraint is enforced only by Postgres

  **Two migration hazards found while doing this — read before T1.**

  1. **`prisma migrate dev` does not work in this repo at all.** Migration
     `20260320100000_add_activity_feed_indexes` uses `CREATE INDEX CONCURRENTLY`, which
     Postgres refuses inside the transaction Prisma wraps the shadow database in, so *every*
     `migrate dev` fails with P3006 regardless of what you changed. Use
     `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`
     to generate SQL, hand-edit it, and apply with `prisma migrate deploy`.
  2. **The generated diff emits destructive statements you must delete.** For T2 it wanted to
     `DROP INDEX "VolunteerOpportunity_searchVector_idx"` — the GIN full-text index built
     CONCURRENTLY in `20260603200100` — because it is raw SQL that `schema.prisma` cannot
     represent, so every diff wants it gone. Shipping that silently degrades marketplace search.
     It also emitted no-op FK drop/re-add churn on `Organization_suspendedById_fkey` and
     `FeatureFlag_updatedById_fkey`. **Never apply a generated diff unread in this repo.**
- [x] **T3 (P1, human: ~6h / CC: ~35min)** — services — `staffVolunteerService` add/remove + repo + audit; set `User.name` only when null ✅ **DONE**
  - Surfaced by: Architecture A1, Code Quality Q2, cross-model T1 reversal
  - Files: `src/server/domain/org-volunteer.ts` (new — Zod + `normalizeEmail` + outcome types), `src/server/repositories/orgVolunteerRepo.ts`, `src/server/services/staffVolunteerService.ts`, `src/server/trpc/routers/volunteers.ts`, `src/server/trpc/root.ts`, plus `__tests__/staffVolunteerService.test.ts` and `routers/volunteers.test.ts`
  - Registered as `volunteers` (plural) — `volunteer` (singular) is the existing volunteer-dashboard router. Different audience, different auth
  - **`normalizeEmail()` in the domain module MUST stay identical to the T1 database trigger** (`lower(btrim(...))`). If they drift, lookups built on the helper stop finding rows the trigger wrote — reintroducing exactly the fail-open bug T1 closed
  - Built ahead for later tasks so their repos already exist: `countAttendedShiftsByUser` (T33, org-scoped through `shift.orgId` with the `SECURITY:` note), `listOrgsForVolunteer` (T32), `restoreVolunteer` + `VOLUNTEER_RESTORED` (T26)
  - Verify: ✅ 22 tests — three add branches, `SECURITY:` indistinguishability of the unknown-email and other-org-`UNCLAIMED` branches, `User.name` set-when-null **and** not-overwritten-when-set, email normalization, live-duplicate and concurrent-P2002 both mapping to the same `Already on your roster` CONFLICT, audit rows with/without `impersonatedBy`, cross-org remove returning NOT_FOUND, restore's re-added conflict. Typecheck + Biome clean; 1524 unit + 72 integration pass

  ⚠️ **Bug caught in implementation — T8, T24 and T32 will hit the same trap.** The first router draft passed `impersonatedBy: ctx.realUserId ?? null`. But `ctx.realUserId` is populated on **every** logged-in request (`trpc/init.ts:42`), not only impersonated ones, so that stamps every audit row as impersonated and makes `queryAuditLog`'s `impersonatedOnly` filter match everything — silently destroying the ability to answer "what did admins do while impersonating?". The house expression is `ctx.realUserId && ctx.realUserId !== effectiveUserId ? ctx.realUserId : null` (`routers/company.ts:58`), now pinned by 6 router tests mirroring `esg-report.test.ts:56`.

  📝 **Testing note for the remaining router work.** A router test using `orgProcedure`/`staffProcedure` must mock `prisma.organization.findUnique` to return `{ suspendedAt: null }` — `orgProcedure` (`init.ts:279`) runs a suspension lookup on every call. Mocking `prisma: {}` the way `esg-report.test.ts` does (it uses a company procedure) fails with `Cannot read properties of undefined`. Use `t.createCallerFactory(router)` with a full ctx object.
- [x] **T4 (P1, human: ~5h / CC: ~30min)** — email — Opt-in unclaimed guard + `EmailEvent.SUPPRESSED_UNCLAIMED` + env kill switch ✅ **DONE**
  - Surfaced by: Architecture A5, D3 inversion, observability §8
  - Files: `src/server/lib/email.ts`, the 4 cron senders, `prisma/schema.prisma`, `prisma/migrations/20260727190000_add_suppressed_unclaimed_email_event/`
  - `SUPPRESSED_UNCLAIMED` is an added value on the **existing `EmailEventType` enum**, not a new `status` column — §3's pseudocode (`EmailEvent{status: …}`) is shorthand; `EmailEvent` has no `status` field
  - The recipient lookup uses `normalizeEmail()` (`lower(btrim)`), **not** the `.toLowerCase()` the adjacent bounce lookup uses. The bounce lookup is correct as-is: `EmailBounceStatus.email` is deliberately excluded from T1 canonicalization (see the T1 migration header), and is separately tracked as a P3. Getting this wrong is the failure-mode table's "case-variant email misses the row, fails open" row — the guard would mail the exact person it exists to protect
  - The `SUPPRESSED_UNCLAIMED` write is **awaited**, unlike the fire-and-forget `SENT` write. If the `SENT` log is lost the mail still went and Resend holds its own record; if this row is lost there is no record anywhere that someone did not get their reminder, which is the whole reason the event type exists. A failed log still suppresses — sending mail we decided to withhold because the audit write failed is the wrong recovery
  - **No admin dashboard change needed** — `admin.ts:93` groups by `eventType`, so the new value flows through on its own
  - Verify: ✅ 18 unit tests in `lib/__tests__/email.test.ts` (opt-in default sends, ACTIVE sends, missing row fails open, `isCritical` bypasses both guards, canonical lookup key, event written, kill switch + 5 mistyped values, the two lookups proven concurrent, log-failure still suppresses, bounce+unclaimed does not double-log) + 4 source-scan tests in `unclaimed-guard-optin.test.ts` + 7 **integration** tests in `lib/emailUnclaimedGuard.integration.test.ts`
  - **The verify step "assert the 4 senders suppress and every other sender does not" is only half expressible as unit tests.** The second half is a property of the tree, so `unclaimed-guard-optin.test.ts` scans `src/` and asserts the opted-in set is exactly those four — plus explicit assertions that the magic-link sender and the roster-added sender never opt in. Without it, someone adding `suppressUnclaimed: true` to a transactional sender silently stops applicants hearing back about their own applications
- [x] **T5 (P1, human: ~2h / CC: ~15min)** — auth — Flip `accountState` on sign-in + env kill switch ✅ **DONE**
  - Surfaced by: Architecture A4 — no hook exists, so shadow users stay suppressed forever
  - Files: `src/server/auth.ts`, `src/server/services/accountClaimService.ts`, `src/server/repositories/userAccountStateRepo.ts`
  - ⚠️ **THE PLAN'S HOOK WAS WRONG — corrected to `events.signIn`.** §2's state machine and the failure-mode table both said `events.updateUser`. Verified against installed `next-auth@4.24.14`: on the Google account-linking path `callback-handler` assigns `user = userByEmail` directly and **never calls `adapter.updateUser`**, so `events.updateUser` never fires there. That is the exact path T6 exists to open, so wiring T5 to `updateUser` would have left every Google-claiming volunteer UNCLAIMED and email-suppressed forever — with the badge showing "unclaimed" for someone who had signed in. `events.signIn` fires on every path. §2 and the failure-mode table are corrected above; a test pins `events.updateUser` as *undefined* so this cannot be silently "fixed" back
  - **Awaited, not fire-and-forget** — deviates from the plan's `.catch(console.error)`. That convention came from `sendNewUserAlert`, a droppable notification; a dropped flip leaves a real person permanently unable to receive mail they asked for, and a detached promise can be killed when a serverless response returns. `auth.ts` wraps the call in try/catch instead, so a failure logs and can never turn into a failed sign-in
  - `updateMany` scoped on the current state, not `update` by id: idempotent by construction (a second sign-in must not re-stamp `claimedAt`), a compare-and-set under concurrency, and it needs no prior read of an untyped `accountState` surviving the adapter cast
  - Writes an `ACCOUNT_CLAIMED` audit row, deliberately **not** in a transaction with the flip — a lost audit row is recoverable from `claimedAt`, a flip rolled back by a failed audit write is not
  - Verify: ✅ 8 service tests + 5 auth-event tests + 6 **integration** tests in `repositories/userAccountState.integration.test.ts` (idempotence, concurrent single-winner, no-op on ACTIVE, missing id returns false rather than throwing P2025, no sibling touched). e2e badge flip landed with T15 (v0.35.1.0)
- [x] **T6 (P1, human: ~1h / CC: ~10min)** — auth — `allowDangerousEmailAccountLinking` + `SECURITY:` comment + env kill switch ✅ **DONE**
  - Surfaced by: Architecture A3 — `AccountNotLinkedError` locks out anyone whose email an org typed
  - Files: `src/server/auth.ts`
  - **The `email_verified` claim is now enforced.** A `callbacks.signIn` refuses any Google sign-in whose profile does not assert `email_verified: true`. Without it the `SECURITY:` rationale below was an assertion rather than a control: next-auth never inspects the claim and the `profile()` mapper discards it, so linking happened on a string match alone. Found independently by the security specialist, Codex, and the coverage audit. This is NOT the UNCLAIMED-scoping design rejected below — that one re-derived the linking decision; this only asserts its precondition. Magic link and any non-Google provider return `true` untouched, pinned by a test, because the magic link is the only exit from `UNCLAIMED`
  - **Blast radius is platform-wide, not roster-only, and that was an explicit decision.** It is a provider-level boolean read in exactly one place in next-auth, so it cannot be scoped to `UNCLAIMED` rows. It therefore also links anyone who signed up by magic link and later clicks "Sign in with Google" — today they get `OAuthAccountNotLinked`. Scoping it was considered: `callbacks.signIn` runs *before* `callbackHandler`, so a hand-rolled lookup there could reject an ACTIVE user with no linked `Account`. Rejected — ~30 lines of hand-rolled auth-critical logic to defend against a threat Google's email verification already covers, at the cost of keeping a papercut that is otherwise fixed for free
  - Verify: ✅ 3 tests asserting the flag is set on the **configured** provider (read through `provider.options`, since next-auth merges caller options at runtime — reading the top-level field tests next-auth's default instead), that the kill switch turns it off, and that 5 mistyped kill-switch values leave it on. OAuth-against-a-shadow-user landed with T15 (v0.35.1.0) — `auth-account-linking.integration.test.ts` drives next-auth's real `callbackHandler`, so the *effect* of the flag is now tested and not just its value
- [x] **T9 (P1, human: ~3h / CC: ~20min)** — tests — Email guard suite ✅ **DONE** (landed with T4/T5/T6 rather than separately — it is their verify step)
  - Surfaced by: Test review — critical gap; `auth.ts:54-56` throws on a false return
  - Files: `lib/__tests__/email.test.ts`, `lib/__tests__/unclaimed-guard-optin.test.ts`, `lib/__tests__/env-flags.test.ts`, `services/__tests__/accountClaimService.test.ts`, `auth-account-linking.test.ts`, plus two integration specs
  - **Two suites are integration, deliberately.** The guard's lookup key must agree with a database trigger Prisma cannot see, and the flip's idempotence lives in a WHERE clause — a mocked client returns whatever the test tells it to and would stay green through exactly the bugs that matter. `pnpm test:integration` against the docker Postgres covers both
  - Verify: ✅ 1788 unit + 118 integration + 9 script tests pass; typecheck clean; Biome clean over `src docs prisma/schema.prisma`. Note `pnpm lint` (`biome check .`, whole repo) still reports 4 findings — all verified pre-existing on `origin/main`, none on lines this branch touched
- [~] **T7 (P1, human: ~8h / CC: ~50min)** — trpc — `requireOrgVolunteerRelationship()` (three-way) on 6 callsites + org-scope shift reads
  - **Partially shipped v0.32.1.0** — guard built and wired to profile read, credential issue, credential revoke, and background-check initiate; `credentials.remove` exempt (compound-key delete). Predicate shipped wider than "three-way" — see the Shipped-as note in section 5. **Still open:** org-scoping the shift reads in `shiftRepo.ts` / `shiftSignupRepo.ts` and the `routers/shifts.ts` callsites.
  - Surfaced by: Q4, X3, Correction 1, Codex #6 — naked ids on profile, credentials issue/revoke/remove, bg-check, shifts
  - Files: `routers/profile.ts`, `routers/credentials.ts`, `routers/background-checks.ts`, `routers/shifts.ts`, `repositories/shiftRepo.ts`, `repositories/shiftSignupRepo.ts`
  - Verify: `SECURITY:` test asserting a REVIEW-stage applicant passes and a foreign-org user does not
- [x] **T8 (P1, human: ~3h / CC: ~20min)** — shifts — `assignVolunteerToShift()` reusing `domain/shift.ts`, `allowOverCapacity` ✅ **DONE (v0.35.0.0)**
  - Surfaced by: Code Quality Q1 — avoid a second implementation of capacity rules
  - Files: `src/server/services/shiftSignupService.ts`, `repositories/orgVolunteerRepo.ts` (`findOrgVolunteerById`, `listAssignableVolunteers`), `domain/shift.ts`, `routers/shifts.ts`
  - Shipped with the two corrections in §4 — the unique index does NOT make reassignment idempotent, and `allowOverCapacity` is an option on `validateSignup` rather than a filter on its result
  - Gated by `rosterProcedure`, lifted out of `routers/volunteers.ts` into `trpc/roster-flag-middleware.ts` so both routers reach one predicate. Hiding the picker is cosmetic; this is the kill switch
  - Verify: ✅ 27 service tests + 5 domain tests + 6 router gating tests + 8 integration tests against real Postgres. Every load-bearing assertion mutation-tested — reverting the revive branch, the flag gate, or the capacity-block shape each turns tests red
- [x] **T10 (P1, human: ~4h / CC: ~25min)** — services — E1a: roster row on approval AND in `claimApplication()` (was "the sign-in link path" — `linkApplicationsToUser` is deleted; see §5) ✅ **DONE (v0.34.0.0)**
  - Surfaced by: Expansion E1, split per D4; Codex #1 — the link path was the retroactive gap
  - Files: `src/server/services/appliedRosterService.ts` (`ensureAppliedRosterRow`), `src/server/services/screener-queries.ts`, `src/server/services/my-applications.ts`, `repositories/orgVolunteerRepo.ts`
  - Shipped with two corrections to the shape prescribed here — the `findFirst`+`create`+catch-P2002 form poisons the enclosing transaction, so the insert is `createMany({ skipDuplicates: true })`; and roster creation gates on the **transition** into APPROVED, not on the status, or a re-save resurrects a deliberately-removed volunteer. Both recorded in `docs/TODOS.md`
  - Verify: ✅ `repositories/appliedRoster.integration.test.ts` + `screener-queries.approvalRoster.test.ts`. **Still open:** no end-to-end coverage of "approve in the UI, see them on `/app/volunteers`" — P2 in `docs/TODOS.md`
- [x] **T11 (P2, human: ~7h / CC: ~40min)** — ui — `/app/volunteers` page, add form, badges, remove, cursor pagination ✅ **DONE**
  - Surfaced by: Performance P1 — avoid the TODO :137 silent-truncation failure mode
  - Files: `src/app/(app)/app/volunteers/page.tsx`, `AddVolunteerDialog.tsx`, `page.test.tsx` (nav item + `layout.tsx` guard already landed with T16)
  - Built to **Design Specification (v1a)**: five columns, no avatars, two-line person cell, `Load more` (never numbered), table-shaped skeleton with the real `<TableHead>` labels, `QueryErrorCard` + `safeErrorMessage`, `placeholderData` on paginate, both empty states distinguished, `sr-only` search label, `h-11` Remove
  - Concierge line persists until `ROSTER_POPULATED_THRESHOLD` (10) — the same constant as the success metric and the T20 milestone, so all three cannot drift
  - Verify: ✅ 12 component tests — skeleton carries real headers, error renders `QueryErrorCard` and **not** an empty state, no internal error string leaks, true-empty vs filtered-empty copy differs, row renders name/email/count/badge, no avatars, `Load more` only with a cursor, no numbered pagination, concierge shown at 3 rows and hidden at 10, and not shown over an error
  - **Deferred to their own tasks, deliberately:** repeat-entry / stay-open dialog (T25), Undo-toast removal (T26), row-click detail dialog (T27), mobile card list (T28), motion (T30), payoff figure (T31), `Export CSV` (T19 owns the route)

- [x] **T12 (P2, human: ~2h / CC: ~15min)** — email — Roster-notification sender escaped via `lib/html.ts` ✅ **DONE**
  - Surfaced by: Code Quality Q3 — org names are org-controlled input
  - Files: `src/server/repositories/sendRosterAddedEmail.ts` + test, wired into `staffVolunteerService.addVolunteer`
  - Fired **after commit and not awaited**, inside the service rather than the router (business logic belongs in the service layer). Resend being down must not roll back a roster row the coordinator can already see — the failure mode is "one email missing", not "the row vanished". Uses `.catch(console.error)`, never a bare `void` (learning: `nextauth-events-createuser-void-rejection`)
  - Links to `/app/profile` for the "leave this roster" control. **If T12 ships before T32, that link is a promise the product does not keep** — Security §2's stated mitigation depends on T32 existing
  - Verify: ✅ 7 sender tests (script tag, `<img onerror>`, quotes/ampersands, named vs unknown coordinator, the profile link, no `isCritical`/`suppressUnclaimed` opts) + 4 service tests asserting the email fires for the `ACTIVE` branch and **`SECURITY:` NOT for either silent branch**, plus one asserting the add still succeeds when the send throws
- [ ] **T13 (P2, human: ~4h / CC: ~25min)** — services — Platform-admin PII scrub preserving `ShiftSignup`
  - Surfaced by: Architecture A6 — hard delete would cascade attendance
  - Files: `src/server/services/platformUserService.ts`, `routers/platformAdmin.ts`
  - Verify: assert hours survive a scrub
- [~] **T14 (P2, human: ~6h / CC: ~40min)** — tests — `staffVolunteerService`, `assignVolunteerToShift`, `markAttendance` backfill
  - Surfaced by: Test review T1 — `shiftSignupService` has no test file at all
  - Files: `src/server/services/__tests__/staffVolunteerService.test.ts`, `__tests__/shiftSignupService.test.ts`
  - **DONE (v0.35.0.0):** `shiftSignupService.test.ts` now exists — 22 `assignVolunteerToShift` cases and a 5-case `markAttendance` backfill (authorization model, audit, idempotent repeat check-in, cancelled-signup refusal, missing signup)
  - **Still open:** the other three untested functions in that file — `signUpForShift`, `cancelSignup` and the waitlist pair are covered only indirectly by `shiftSignupDisclosure.test.ts` / `shiftOrgScoping.test.ts`
  - Verify: `pnpm test`
- [x] **T15 (P2, human: ~1d / CC: ~45min)** — e2e — Identity paths + add→assign→attend→hours-in-report ✅ **DONE (v0.35.1.0)**
  - Surfaced by: Test review T2 — mocks cannot verify real NextAuth behavior
  - Files: `e2e/staff-created-volunteers.spec.ts`, `e2e/utils/db.ts` (`mintMagicLinkUrl`), `src/server/auth-account-linking.integration.test.ts`
  - **Split across two suites, because the identity paths are not equally reachable.**
    The **magic-link** branch is drivable end to end: `mintMagicLinkUrl()` writes the
    hashed half of a `VerificationToken` and the spec navigates to the real
    `/api/auth/callback/email`, so `getUserFromEmail`, `callbacks.signIn`,
    `callbackHandler`, session creation and `events.signIn` all execute. Only the
    Resend send is bypassed — deliberately, since `RESEND_FROM_EMAIL` is the shared
    `resend.dev` sandbox sender and the key in `.env.local` is live.
    The **Google** branch is not: `authOptions` builds `GoogleProvider` against
    Google's own discovery document and exchanges the token server-side, so there is
    no seam to point it at a mock IdP without adding one to production code. Those
    claims moved to an integration test that calls next-auth's real `callbackHandler`
    with the real `PrismaAdapter` — which also means they run in CI, and e2e does not
  - ⚠️ **The e2e half cannot distinguish `events.signIn` from `events.updateUser`**, even
    in principle: on the email branch `callbackHandler` calls `updateUser` too. Only
    the oauth branch separates them, which is precisely what the integration test
    isolates. Do not read the green e2e run as covering the `auth.ts:143` SECURITY note
  - Verify: ✅ 2 e2e (`pnpm e2e`) — a staff-added UNCLAIMED volunteer claims by magic link
    and the roster badge flips `No account yet` → `Has account`, asserted in the DB
    (`accountState`, `claimedAt`, same user id, a `Session` row, exactly one
    `ACCOUNT_CLAIMED` audit row) **and** in the UI; plus add → assign → T23 disclosure →
    Attended → **2.5 hours in `/app/analytics` → Top Volunteers**. Both mutation-tested:
    disabling `claimAccountOnSignIn` turns the first red, asserting the wrong hours
    figure turns the second red
  - Verify: ✅ 8 integration (`pnpm test:integration`) — `AccountNotLinkedError` without
    `allowDangerousEmailAccountLinking` and adoption with it, `adapter.updateUser`/
    `events.updateUser` never called on the adopt path (**paired with a contrast test
    asserting the email branch DOES call them**, so the negative cannot pass vacuously),
    `events.createUser` firing for a pre-existing row, adoption leaving the account
    UNCLAIMED until `claimAccountOnSignIn` runs, and both kill switches
  - **Note the deep require.** `core/lib/callback-handler` is not in next-auth's `exports`
    map and is resolved by path off the package root. Deliberate: the alternative is
    leaving four `auth.ts` claims verified only by reading `node_modules`. A next-auth
    upgrade that moves it breaks the test loudly, which is correct — those comments say
    "Verified against next-auth 4.24.14" and would need re-verifying too
- [~] **T16 (P2, human: ~3h / CC: ~20min)** — config — `staff_created_volunteers` flag, default `false`, gating page + mutations
  - Surfaced by: Step 0 — first production consumer of `isFeatureEnabled()`. **Re-estimated from 1h by design review D20:** there is no client flag read path, so the original verify step could not pass. Resolve server-side in the app layout, thread a fourth prop through `AppShell` → `AppSidebar` following the `hasOrg` idiom, and guard the route with `redirect()` — nav hiding is cosmetic and does not close the route
  - Files: `src/server/domain/feature-flags.ts`, `src/app/(app)/app/layout.tsx`, `src/components/app/app-shell.tsx`, `src/components/app/app-sidebar.tsx`, `src/app/(app)/app/volunteers/`, `src/app/(app)/app/shifts/page.tsx`, `src/components/app/activity-feed.tsx`
  - **Eng re-review, two corrections.** (1) The layout has **no `orgId`** — `layout.tsx:50` is a `.count()`. Resolving one means replicating `trpc/init.ts:77-149`, including the impersonation path that nulls `session.orgId`. (2) The flag must gate T23, T24 and T31 as well, or a non-pilot org gets an assign picker over a roster they cannot see. See **Feature-flag gating** for the full gated/ungated split. Re-estimated again: **~5h**, not 3h
  - Verify: toggle off, confirm nav, route, **and the shift-dialog assign picker** all disappear, that the item does not flash in before hydration, and that an impersonated multi-org target resolves the flag against the org whose page they are on
  - ⚠️ **PARTIALLY DONE.** Shipped: flag registered in `FEATURE_FLAG_REGISTRY` (`defaultEnabled: false`) with an exported `STAFF_CREATED_VOLUNTEERS_FLAG` const so a typo cannot silently resolve to "off"; `resolveActiveOrgId()` in `domain/active-org.ts` (pure, 6 tests) + `listMembershipOrgIds()` in `repositories/membershipRepo.ts`; the app layout's bare `count()` upgraded to return ids (same query count, more information) and resolving the flag server-side; `hasVolunteerRoster` threaded through `AppShell` to **both** `AppSidebar` instances (desktop aside + mobile drawer); the conditional `Volunteers` nav item after `Applications` with `BookUser`; and `volunteers/layout.tsx` closing the route independently and failing closed. **Update (v0.35.0.0):** the assign picker and the suppression disclosure are now gated too — `shifts/page.tsx` became a Server Component resolving the flag through the shared `server/lib/roster-flag.ts` (extracted from `volunteers/layout.tsx`), and both new procedures run under `rosterProcedure`. **Still to do when T31 lands: the activity-feed events.**
  - Verify so far: ✅ 6 `resolveActiveOrgId` tests including `SECURITY:` cases that it ignores `session.orgId` while impersonating and returns null rather than falling through to the admin's own org; 6 sidebar tests (hidden when off, shown when on, funnel position after Applications, distinct from Team, exactly one item highlighted on a child route, never shown to a non-org user); 5 layout tests including `SECURITY:` resolution against the target org while impersonating. 1552 unit + 72 integration + 9 script tests pass
- [x] **T17 (P2, human: ~4h / CC: ~25min)** — scripts — Concierge roster import: per-row transactions, idempotent, `--dry-run` ✅ **DONE**
  - Surfaced by: §4 edge cases — row 31 of 60 failing left the run in an unknown state
  - Files: `scripts/import-roster.ts`, `scripts/import-roster.test.ts`, `src/server/services/rosterImportService.ts`, `src/server/domain/roster-import.ts`, `src/server/domain/csv.ts`, `package.json`
  - Verify: ✅ 45 script tests + 17 service tests; run twice against real Postgres — second run reported every row `already on roster` and added nothing. Also verified: quoted `"Nguyen, Thu"` survives, `MARCUS.WEBB@Import-Test.Local` canonicalizes, shadow users land `UNCLAIMED` + `PRIVATE`, and a volunteer who had left came back `REFUSED` rather than being re-added
  - **Writes through `addVolunteer()`, not a parallel implementation** — so the block refusal, the shadow-user branch, first-writer-wins on `User.name` and the audit row are the same code the add form runs. A bulk loader is exactly the "new path that creates OR acts on a roster row" CLAUDE.md warns about, and reusing the service is what makes it impossible to miss the block
  - **No third `OrgVolunteerSource`.** `ORG_VOLUNTEER_SOURCE_COPY`'s docstring anticipated one; deliberately not added. An imported row IS staff-added (the staff sent the spreadsheet), and splitting the enum would drop every concierge-onboarded org out of the success metric that counts `STAFF_ADDED`. Provenance goes on the audit row instead: `metadata.via = 'CONCIERGE_IMPORT'`
  - **Notifications are paced by the script, not fired by `addVolunteer`.** New `sendNotification: false` option; the importer sends them afterwards, sequentially and awaited, and reports failures. `addVolunteer`'s own send is fire-and-forget behind `.catch(console.error)` — right for one click, wrong for sixty rows, and the people owed this email are precisely those added from a spreadsheet they never saw
  - **A write run needs `--yes`; `--dry-run` needs nothing.** Unknown flags are rejected rather than ignored, so `--dryrun` cannot silently become a live import
- [ ] **T18 (P3, human: ~30min / CC: ~5min)** — lib — `checkin-token` timing-safe compare
  - Surfaced by: Code Quality Q5 — plain `===` where both sibling modules use `timingSafeEqual`
  - Files: `src/server/lib/checkin-token.ts`, `checkin-token.test.ts`
  - Verify: `pnpm test src/server/lib/checkin-token.test.ts`
- [x] **T19 (P2, human: ~4h / CC: ~25min)** — api — Roster CSV at `/api/org/[orgId]/roster/csv`, FREE tier, 10k cap, streamed, rate-limited ✅ **DONE**
  - Surfaced by: Expansion E3; Codex #7 — a global route would derive tenancy from the session, the v0.29.2.0 bug
  - Files: `src/app/api/org/[orgId]/roster/csv/route.ts`, `src/server/services/rosterExportService.ts`, `src/server/services/orgAccessService.ts`, `src/server/domain/roster-export.ts`, `src/server/domain/csv.ts`, plus the `Export CSV` control on `/app/volunteers`
  - Verify: ✅ 15 route tests + 8 stream tests + 8 guard tests + 13 domain tests, and driven live against the dev server: 200 with `Transfer-Encoding: chunked`, a soft-deleted volunteer absent from the file, `=cmd|calc` emitted as `'=cmd|calc`, and the downloading org confirmed `planTier = FREE`. Refusals: no session → 401; foreign org → 404 byte-identical to a nonexistent org; flag off → 404
  - **`requireOrgAccess` is new** (`orgAccessService.ts`) — the Route-Handler counterpart to `staffProcedure`, which cannot be reused because it reads `ctx.orgId` from the session's ACTIVE org. It re-checks membership, role rank AND org suspension against the `orgId` in the URL. Consolidating `roleRank` into `domain/permissions.ts` came with it: there were already two private copies (`trpc/init.ts`, `memberService.ts`) and this would have been the third
  - **The route is flag-gated too.** `isRosterEnabledForOrg()` now lives in `featureFlagService` with six callers of four shapes, because grepping `rosterProcedure` does not enumerate roster surfaces — this one is not a procedure at all. The flag read runs **after** `requireOrgAccess`, so a stranger cannot use it to probe which orgs are in the pilot
  - **Streamed via `ReadableStream` paging the cursor**, not a built string: first bytes go out after the first page, and no single query holds a connection for the whole scan. The 10k cap appends a `# Truncated` row rather than silently returning a prefix
- [x] **T20 (P2, human: ~6h / CC: ~35min)** — analytics — `roster_populated` step + checklist milestone across all three onboarding surfaces ✅ **DONE**
  - Surfaced by: Expansion E4 — the success metric is currently unmeasurable
  - Files: `onboardingAnalyticsService.ts`, `screener-queries.ts`, `onboarding-service.ts`, `domain/onboarding.ts`, `onboarding-checklist.tsx`, `admin/onboarding/page.tsx`, `repositories/rosterMetricsRepo.ts`
  - Verify: ✅ 10 domain tests + 8 analytics tests + 13 integration tests, and driven live: 10 imported rows flipped the step to complete in the `onboarding.getStatus` payload, put `rosterVolunteerCount: 12` on the dashboard payload, and moved funnel step 5 and `rosterActivation` to 1
  - ⚠️ **"All three onboarding surfaces" means the two status queries and the admin funnel — NOT the multi-step wizard.** `computeOnboardingStatus()` appends the roster step to `steps[]`, so `onboarding.getStatus` returns it, but `src/components/onboarding-wizard.tsx` renders from its own hardcoded 4-entry `STEP_META` with `StepIndicator total={4}` and looks up only `org_basics`/`screener`/`opportunity` by key. The roster step therefore renders on the **dashboard checklist only**. That component is also currently exported and never mounted anywhere, which is why nothing broke. Do not describe this milestone as appearing in a setup wizard
  - **The step is OMITTED, not shown-incomplete, when the flag is off.** It links to `/app/volunteers`, which `volunteers/layout.tsx` redirects a non-pilot org away from — so showing it would be an instruction the product refuses to let the reader follow, and counting it would peg those orgs at "4 of 5" forever
  - **Two different measures, deliberately.** Funnel step 5 is "≥10 live roster rows, any source, any time" — the same predicate as the checklist and the concierge offer, so the product cannot congratulate an org it is still nudging. The launch's PRIMARY success metric (`STAFF_ADDED` only, within 7 days of signup) is reported separately as `rosterActivation`, because it answers a different question: did the concierge motion work?
  - **`countOrgsWithPopulatedRoster` is hand-written SQL and had to be.** The window compares `OrgVolunteer.createdAt` against `Organization.createdAt`, and `prisma.groupBy` cannot express a HAVING over a joined column. One static template with NULL-checked optional filters, per the raw-SQL rule. Mutation-verified against real Postgres: neutering the source filter, the window filter, or the soft-delete filter each turns exactly the tests that name it red
- [ ] **T21 (P3, human: ~1h / CC: ~10min)** — copy — Data-migration FAQ + cold email line + `page.tsx:200` alt text
  - Surfaced by: Expansion E5; Codex #8 — a per-org flag cannot make a sitewide claim true
  - Files: `for/animal-shelters/page.tsx`, `docs/cold-email-template.md`, `(public)/page.tsx`
  - Verify: **ships only when the flag default flips to `true` platform-wide, not at first pilot enablement**

### Added by `/plan-design-review` (T22-T35)

- [x] **T22 (P1, human: ~2h / CC: ~15min)** — ui — `VolunteerStatusBadge` component, tokens only ✅ **DONE — Lane J complete, B and E unblocked**
  - Surfaced by: Design D17 — the badge renders in 3 places across 2 worktree lanes, so an inline map drifts
  - Files: `src/components/volunteers/volunteer-status-badge.tsx`, `volunteer-status-badge.test.tsx`
  - Verify: ✅ 10 tests — approved copy for both states, never renders the raw enum, `neutral` (not `warning`) for `UNCLAIMED`, `success` for `ACTIVE`, className merge, icon `aria-hidden`, and a source scan asserting no hex literal. Typecheck + Biome clean, 1502 unit tests pass
  - Confirmed while building: `neutral` and `success` variants both exist in `badge.tsx`, the base class already supplies `gap-1`, and **lucide-react sets `aria-hidden="true"` automatically** when an icon has no children and no a11y prop — so T29 does not need to add it manually to badge icons
- [x] **T23 (P1, human: ~3h / CC: ~20min)** — ui — Disclose shift-reminder suppression at assign and persistently in the signups list ✅ **DONE (v0.35.0.0, shipped with T24 — same file)**
  - Surfaced by: Design D7 — `shift-reminder-service.ts:75` suppresses silently; the coordinator assumes the volunteer was reminded and does not text them
  - Files: `src/app/(app)/app/shifts/ShiftDetailDialog.tsx`, `src/server/repositories/shiftSignupRepo.ts`, `repositories/shiftRepo.ts`
  - The eng re-review was right that there was no data source. `accountState` added to a shared `signupUserSelect` in `shiftSignupRepo.ts` (covering `getSignupsByShift` and `getWaitlistForShift`) **and** to `getShiftWithSignups` in `shiftRepo.ts`, which is what `shifts.getById` — and therefore the dialog — actually reads. The original scoping named only the first file
  - **One deliberate deviation.** The signups table badges `UNCLAIMED` rows only, not both states. A "Has account" badge on every other row is noise in an operational table whose Status column is about attendance; its absence says the same thing, and the summary line above carries the count. The picker renders both states, where the reassurance is informative at the moment of choosing
  - Verify: ✅ 9 dialog tests — count excludes CANCELLED/WAITLISTED rows (they are not reminded either way, so counting them overstates the problem), singular vs plural copy, absent at zero, badge count, and both surfaces hidden when the flag is off
- [x] **T24 (P1, human: ~5h / CC: ~30min)** — ui — Assign-to-shift picker in `ShiftDetailDialog` + over-capacity confirm ✅ **DONE (v0.35.0.0)**
  - Surfaced by: Design D3, D11 — `assignVolunteerToShift` had no specified entry point anywhere in the plan
  - Files: `src/app/(app)/app/shifts/AssignVolunteerPicker.tsx`, `ShiftDetailDialog.tsx`, `ShiftsClient.tsx`, `page.tsx`
  - **The eng re-review's "copy `team/page.tsx`" note is wrong.** `team/page.tsx:531` is a **timezone** picker filtering a static array in the browser; it is not a person picker. All three `command.tsx` consumers are client-side filters over static lists. This is the codebase's first server-search picker, so it uses `shouldFilter={false}` + a debounced `shifts.assignableVolunteers` query, with cmdk as the keyboard/aria shell only
  - **Server-side exclusion is not optional.** The picker cannot filter out people already on the shift: roster rows are keyed by `OrgVolunteer.id` and signups by `User.id`, and the roster projection withholds `User.id` from clients — there is no join key. Hence `listAssignableVolunteers`, which excludes every non-CANCELLED signup
  - **`page.tsx` is now a Server Component** wrapping the former page as `ShiftsClient`. There is no client flag-read path (D20), so a tRPC read would flash the picker in after hydration — which T16's own verify step forbids. The flag block previously inlined in `volunteers/layout.tsx` is now `server/lib/roster-flag.ts`, shared by both
  - Verify: ✅ 8 picker tests (confirm strip shows the real `9 of 9`, `allowOverCapacity` set only after confirming, cancel writes nothing, both toast strings) + the `10 / 9` warning-tone assertions in the dialog suite. Also driven end-to-end against the running dev server over HTTP: assign, capacity refusal, override, reassign-after-cancel reviving the same row id, picker exclusion, and both procedures returning FORBIDDEN with the flag off
- [ ] **T25 (P1, human: ~3h / CC: ~20min)** — ui — Add-volunteer dialog: repeat entry, three success strings, pre-submit hint
  - Surfaced by: Design D8, D12 — batch trickle entry is the core task; branches 1 and 3 must be indistinguishable
  - Files: `src/app/(app)/app/volunteers/`, `src/server/services/staffVolunteerService.ts`
  - Verify: `SECURITY:` test asserting the unknown-email and other-org-`UNCLAIMED` responses are byte-identical
- [x] **T26 (P2, human: ~3h / CC: ~20min)** — ui — Undo-toast removal, restore path, `VOLUNTEER_RESTORED` audit ✅ **DONE** (service half landed early with T3; the UI half shipped with T28)
  - Surfaced by: Design D9 — removal is a reversible soft delete; the house confirm copy ("This cannot be undone") would be false
  - Files: `src/server/services/staffVolunteerService.ts` (T3), `src/app/(app)/app/volunteers/page.tsx` (T28)
  - Verify: ✅ 3 unit tests — the toast carries an `Undo` action calling `volunteers.restore` with the same id, the toast outlives sonner's ~4s default, and the restore names the right person when two removals are undone out of order
  - **The removed-name store is a `Map` keyed by volunteer id, not one "last removed" slot.** By the time the undo fires, `volunteers.list` has been invalidated and the row is gone, so the name cannot be looked up again — it has to be captured at removal. Two quick removals leave two undo toasts on screen at once, and a single slot would make the older one confirm the newer one's name
  - **`onError` is not optional here.** An undo can legitimately fail: the volunteer may have used the exit on `/app/profile` in the meantime, which writes an `OrgVolunteerBlock` that `restoreVolunteer` refuses with `FORBIDDEN`. That refusal is the whole point of the block — surface it rather than let the UI imply the undo worked
- [ ] **T27 (P2, human: ~4h / CC: ~25min)** — ui — Volunteer detail dialog on row click
  - Surfaced by: Design D4 — the roster would be the only list in the product that dead-ends
  - Files: `src/app/(app)/app/volunteers/`, `src/server/repositories/shiftSignupRepo.ts`
  - **`SECURITY:` — eng re-review. Do not reuse `getAttendedShiftsForUser` as-is.** It is `where: { userId, status: 'ATTENDED' }` with **no org filter** (`shiftSignupRepo.ts:53-66`) — it selects `shift.orgId` and never filters on it. Rendering it in this dialog shows org A every shift the volunteer attended for org B. This is the identical leak class T33 wrote a mandatory `SECURITY:` test for, except the dialog displays the underlying rows rather than a count, so it leaks strictly more. Add an org-scoped variant (`getAttendedShiftsForUserInOrg(userId, orgId)`) rather than filtering in the component
  - Verify: assert `Remove` does not open the dialog (`stopPropagation`); `SECURITY:` test — a volunteer on two rosters shows each org only its own shift history
- [x] **T28 (P2, human: ~5h / CC: ~30min)** — ui — Mobile: card list below `lg`, Drawer add form ✅ **DONE**
  - Surfaced by: Design D18 — five columns at 375px; the coordinator's Saturday happens on a phone
  - Files: `src/app/(app)/app/volunteers/page.tsx`, `AddVolunteerDialog.tsx`, both `.test.tsx`, `e2e/staff-created-volunteers.spec.ts`
  - Verify: ✅ 375px e2e (executed, green) asserts the widest node **inside the roster region** is `<= 375` and that the region carries no internal horizontal scroll, that the card list is visible and the table is hidden, and that the add form opens as `drawer-content`. **40 new unit tests** across four files (suite 2153 → 2193): `page.test.tsx` +17, `AddVolunteerDialog.test.tsx` +7, new `query-error-card.test.tsx` +13, new `ShiftsClient.test.tsx` +3 — the last two added during pre-landing review, and both mutation-verified (neutering the branch they name turns them red)
  - ⚠️ **The scroll assertion is roster-scoped, NOT `document.documentElement.scrollWidth`, and that is a real limitation.** `app-shell.tsx:54-82` overflows ~22px at 375px on every authenticated page (measured: `scrollWidth` 397 on a clean load) because its `justify-between` left cluster has no `min-w-0`. A page-level assertion would fail on that pre-existing bug and say nothing about the roster, so it would get deleted or padded with a tolerance the first time someone hit it. Tracked as a `[P2]` in `docs/TODOS.md`; **tighten this assertion to `documentElement` once the shell is fixed**
  - **The LIST switch is pure CSS (`hidden lg:block` / `lg:hidden`), NOT `useMediaQuery`.** That hook (`lib/hooks/use-media-query.ts:4`) initialises to `false` and only reads `matchMedia` in an effect, so gating layout on it paints the CARD shape to every desktop user and swaps after hydration — the same flash the roster flag has no client read path in order to avoid. On this page the hook is used for the add form and only there: nothing renders until the trigger is pressed, by which point the effect has run. (Elsewhere in the app, `admin/feedback/page.tsx:91-92` still gates a page layout on it and has the flash this rule describes — recorded in `CLAUDE.md` under "Responsive staff tables".) Both trees are always in the DOM; `display: none` also removes one from the accessibility tree, so exactly one `Remove` per volunteer is ever reachable
  - **`lg` for the Drawer too, diverging from the two existing consumers** (`feedback-widget.tsx:252`, `org-profile-form.tsx:71`, both `md`). One breakpoint per page: a 768-1023px band where the list behind the modal is already cards but the form is still a centred dialog is a worse inconsistency than differing from a sibling
  - ⚠️ **DELIBERATE DEVIATION from the Responsive/Accessibility spec above: `Remove` stays on the mobile card.** The spec moves it into T27's detail dialog and makes the row itself tappable. T27 is not built, so following it literally would leave a phone unable to remove a volunteer **at all** — a capability this surface has today via the horizontally-scrolling table. The spec's stated reason for moving it is that "a `Remove` button inside a full-width **tappable** row is a nested interactive target"; that holds only once the row is tappable, and it is not — the card is a plain `div` with exactly one control, pinned by a test asserting one button per row. When T27 lands, the row becomes the tap target and `Remove` moves into the dialog as specified; the e2e assertion carries a note to delete then
  - The mobile skeleton is card-shaped, not the table one: a table skeleton under `lg:hidden` reserves the wrong height and reflows on data arrival, which is the exact failure the desktop skeleton exists to prevent
  - **Testing note for T36.** Once both trees render, `displayName`, `email` and the badge label each match TWICE — every unscoped `getByText` in `page.test.tsx` had to be rescoped through `within(getByTestId('roster-table'))`. jsdom has no layout, so a CSS breakpoint switch cannot be tested there at all; the unit tests assert both trees exist with the right classes and content, and the 375px e2e is the only thing that proves which one a human sees. Also: `AddVolunteerDialog.test.tsx` needs vaul's pointer-capture polyfills AND a `getComputedStyle` shim — vaul reads `style.transform || style.webkitTransform || style.mozTransform` and calls `.match()` on it, and jsdom yields `undefined` there, which throws asynchronously and **fails the run while every test still reports green**
- [~] **T29 (P2, human: ~4h / CC: ~25min)** — a11y — Focus return, `aria-live` count, `sr-only` search label, row `aria-label`, 44px targets
  - Surfaced by: Design D19 — obligations created by D9, D12, D15 and D18, none covered by the primitives
  - Files: `src/app/(app)/app/volunteers/`
  - Verify: keyboard-only add of 3 volunteers without touching the mouse — ✅ reachable today: Radix returns focus to the trigger on close, so tab → Enter → fill → Enter → repeat works without T25's stay-open flow
  - ⚠️ **PARTIALLY DONE.** Shipped with T11: `sr-only` search `<Label>`, `h-11` targets, badge icons `aria-hidden` (lucide auto-applies, pinned by `volunteer-status-badge.test.tsx:52`). Shipped with T28: a per-row `aria-label` naming the volunteer on **both** trees' `Remove` (every other named-target button in the app does this — `ShiftsClient.tsx:409,423,439` — and without it a rotor lists N identical "Remove" buttons); an `<output aria-live="polite" class="sr-only">` announcing removal and restore by name, following `org-profile-form.tsx:270` and the volunteer-side leave control at `profile/page.tsx:697-704`; `role="alert"` plus `aria-invalid`/`aria-describedby` on the add form's inline error, which is most often the benign "Already on your roster" — the case that makes a silent form look broken
  - **A discrete live message, not `aria-live` wrapped around the list.** The list also changes on search and on `Load more`; announcing the whole roster on every keystroke is worse than announcing nothing
  - **Still open, and each is blocked on an unbuilt task — do not check these off against T28's diff:** focus return to the name input after each add and the `aria-live` running count both need **T25**'s stay-open repeat entry (the dialog closes on success today); the animated header count being `aria-hidden` during transition needs **T30**; `aria-label="View {name}"` on a mobile row needs **T27** to give the row something to open
- [ ] **T30 (P3, human: ~2h / CC: ~15min)** — ui — Motion: row enter/exit, animated count, `Load more` append
  - Surfaced by: Design D15 — litmus check 6 was the only NOT SPEC'D. Inherits the existing `globals.css:216` reduced-motion block
  - Files: `src/app/(app)/app/volunteers/`
  - Verify: assert transitions are suppressed under `prefers-reduced-motion`
- [ ] **T31 (P2, human: ~3h / CC: ~20min)** — ui — Roster header payoff figure + roster adds in the activity feed
  - Surfaced by: Design D14 — nothing ever tells the coordinator the roster produced anything
  - Files: `src/app/(app)/app/volunteers/`, `src/components/app/activity-feed.tsx`, `orgAnalyticsRepo.ts`
  - **Eng re-review — the cited query does not compute this figure.** `orgAnalyticsRepo.ts:174` is `getTopVolunteers(orgId, limit, fromDate)`: at most `limit` rows of **per-volunteer** hours, windowed from a date. Summing it gives the top N volunteers' hours since an arbitrary cutoff, not the org's recorded total. A new unwindowed `SUM` aggregate is needed. Re-estimate ~4h, not 3h. It is raw SQL — write one static template, never composed `Prisma.sql` fragments (CLAUDE.md Turbopack rule)
  - Roster adds in the feed are gated by the `staff_created_volunteers` flag; the header figure rides with the page, which is already gated. Note `screener.getActivityFeed` is an **`adminProcedure`** (`routers/screener.ts:256`), so the feed's "feature discovery for other staff" argument only reaches admins
  - Verify: assert the hours figure matches the impact report for the same org
- [x] **T32 (P1, human: ~4h / CC: ~25min)** — ui — Volunteer self-service: Organisations section on `/app/profile` with `Leave` ✅ **DONE**
  - Surfaced by: Design D13 — Security §2 claimed the recipient "can remove the roster link"; no such surface existed
  - Files: `src/app/(app)/app/profile/page.tsx` (`OrgMemberships`), `src/server/services/staffVolunteerService.ts` (`leaveOrgRoster`, `listMyOrgMemberships`), `repositories/orgVolunteerRepo.ts`, `routers/profile.ts`. `sendRosterAddedEmail.ts` needed no change — it already links here and promises exactly this
  - ⚠️ **The repo functions named here were DELETED in v0.37.0.0.** `listOrgVolunteersByUser` → `listMyOrgRelationships` (roster rows alone let an org deny the remedy), `softDeleteOwnOrgVolunteer` → `softDeleteOwnOrgVolunteerByOrg` (leaving is keyed on `orgId`, since an application-only org has no roster row to name). `sendRosterAddedEmail.ts` DID change in that ship — it now names profile visibility and says the exit removes access
  - **Ungated, per the Feature-flag gating table.** The procedures live on `profileRouter` under `protectedProcedure`, NOT on the `rosterProcedure`-throughout `volunteersRouter`: `ensureAppliedRosterRow` mints edges for every org regardless of the pilot flag, so gating the exit would strand volunteers on rosters they cannot leave. Housing them beside the flagged procedures would invite someone to make them "consistent"
  - Section is named "Organizations you volunteer with", not "Organizations" — the stat card above already says "Organizations" and counts `OrganizationMember` (staff membership), which is a different thing
  - The error branch renders BEFORE the empty check: on a consent surface a failed load must never read as "you are on nobody's roster"
  - Confirm-row copy is honest about what leaving does not do — the application stays sent, the hours stay recorded, and (as of T32) the org can add you again. Same correction the claim flow's decline row took in v0.34.0.0. The application clause is stated **only on `APPLIED` rows**, where it is the consent-material one; review caught a first draft that named two of the three while this doc claimed all three
  - ⚠️ **The "can add you again" clause was INVERTED in v0.37.0.0** — it is now "they won't be able to add you back", and that clause is the one distinguishing the control from the version that revoked nothing. Do not restore the older copy from this checklist entry
  - `ORG_VOLUNTEER_SOURCE_COPY` (a `Record` over the enum, not a ternary with an `else`) so T17's concierge import cannot silently render as "Added by their staff" on the surface whose whole job is answering "why am I on this list?"
  - `MY_MEMBERSHIPS_CAP` (200) on the list. Not pagination — the backstop for the fact that the row count is NOT the volunteer's to control: any org's staff can add any address, so the ceiling is however many orgs an attacker holds
  - Verify: ✅ 4 service tests + 8 integration tests against real Postgres + 3 repository unit tests + 5 router tests + 15 component tests. Files: `services/__tests__/staffVolunteerService.test.ts`, `repositories/orgVolunteer.integration.test.ts`, `repositories/orgVolunteerRepo.leave.test.ts`, `trpc/routers/profile.leave.test.ts`, `app/(app)/app/profile/page.test.tsx`
  - `SECURITY: cannot leave a roster on someone else's behalf` is **mutation-verified**: dropping the `userId` clause from one of the two statements leaves it green (the other still guards), dropping it from both turns it red
  - **`profile.leave.test.ts` is what pins the ungated decision** — it calls both procedures with a no-org, no-role caller, so moving them onto `rosterProcedure` fails the suite rather than silently removing the exit
  - `orgVolunteerRepo.leave.test.ts` covers the lost-race branch (`count === 0` after a successful read) that Postgres cannot be made to demonstrate on demand. Review found that branch had ZERO coverage and proved it by mutation — returning `row.orgId` unconditionally kept all 22 integration tests green while double-counting every two-tab leave
- [x] **T33 (P2, human: ~2h / CC: ~15min)** — ui — `Shifts` attended column, org-scoped ✅ **DONE**
  - Surfaced by: Design D21 — present in the approved mockup and in no task; counting off `User` without the `Shift.orgId` join leaks cross-org activity
  - Files: `src/server/repositories/orgVolunteerRepo.ts` (`countAttendedShiftsByUser`), `src/app/(app)/app/volunteers/page.tsx`
  - One grouped query per page rather than an N+1, joined through `shift: { orgId }`
  - Verify: ✅ `SECURITY: counts attended shifts for the CALLING org only` in `orgVolunteer.integration.test.ts` — one user attending shifts at two orgs sees each org report only its own count
- [ ] **T34 (P3, human: ~1h / CC: ~10min)** — docs — Correct DESIGN.md: sidebar, width, top bar
  - Surfaced by: Design D16 — DESIGN.md:92 describes a forest-green sidebar the app does not have, which made round one of this review's own mockups wrong
  - Files: `DESIGN.md`
  - Verify: re-read against `app-shell.tsx:126-136` and `app-sidebar.tsx`
- [x] **T35 (P2, human: ~4h / CC: ~25min)** — ui — `QueryErrorCard` migration + shifts error branch **(TD2, pulled in)** ✅ **DONE** (all four pages, shipped with T28)
  - ⚠️ **Nearly shipped as a false claim.** The first pass checked this off after fixing only `ShiftsClient`, on the reasoning that the other three "already had an `isError` branch". They did — but the branch was a hand-rolled `Card` rendering `{query.error.message}` **raw**, which is the leak `safeErrorMessage` exists to prevent, not the migration T35 asks for. Having an error state and having a SAFE error state are different properties, and "does this file check `isError`?" answers the wrong one. All four now render `QueryErrorCard` with `safeErrorMessage(query.error)`
  - Files: `applications/page.tsx:122`, `opportunities/OpportunitiesClient.tsx:138`, `settings/team/page.tsx:143`, `shifts/ShiftsClient.tsx`
  - Surfaced by: Design review TODO TD2, elected into this PR — the shifts client never checked `isError`, so a failed query rendered as an empty state: a broken page that looks correct
  - Verify: ✅ `query-error-card.test.tsx` pins `role="alert"` and asserts `safeErrorMessage` withholds a non-allowlisted code, plus a `ShiftsClient` test asserting the error card renders and "No shifts found" does **not** — the branch ordering is what makes the fall-through impossible
  - **Note the migration is scoped to these four pages only.** Counted after the ship: **13 other files under `src/app` render a tRPC `{error.message}` into JSX, and 31 touch one at all** once mutation `onError` toasts are counted (`my-applications`, `settings/background-checks`, `admin/platform/*`, `profile`, `apply/status`, `app/error.tsx`, …). Out of T35's stated scope; now tracked as **T37** in `docs/TODOS.md` — the "grep for what you are migrating TO" lesson applies to them too
### Split out by eng re-review — follow-up PR

- [ ] **T36 (P2, human: ~1.5d / CC: ~1h15min)** — ui — Mobile card lists for the four existing staff tables **(TD5)**
  - **MOVED OUT of this PR (eng re-review D2).** It was 12h — the largest single task and ~28% of everything after Lane A — on four pages no v1a task depends on, gated behind T28 which sits eighth in Lane B's queue. It is the tail of the critical path and moves the success metric (orgs with ≥10 roster rows in 7 days) by zero. **Lane M is deleted.** Ship it as a follow-up once T28 gives it a pattern to copy
  - Files: `applications/page.tsx`, `opportunities/OpportunitiesClient.tsx`, `shifts/page.tsx`, `settings/team/page.tsx`
  - Depends on: **T28** (the mobile roster) landing first, so there is one pattern to copy rather than four inventions
  - Verify: 375px viewport on all four, assert no horizontal scroll
  - **T28 is the pattern.** Copy the four rules recorded under "Responsive staff tables" in `CLAUDE.md`: pure-CSS `hidden lg:block`/`lg:hidden` switch (never `useMediaQuery` for layout), `gap-0 divide-y py-0` to stop `Card` fighting `divide-y`, visibility on a wrapper `div` rather than on `Card`, and a card-shaped skeleton whose bar heights match the real row's line boxes
- [ ] **T37 (P2, human: ~1d / CC: ~45min)** — ui — Finish the `safeErrorMessage` migration across the remaining `src/app` surfaces
  - Surfaced by: T35's own scope note — T35 fixed four pages, and the same raw-`error.message` leak stands everywhere else
  - **13 files render a tRPC `{error.message}` into JSX; 31 touch one at all** once mutation `onError` toasts are counted. Notables: `my-applications/page.tsx:229`, `profile/page.tsx:300,862,870`, `settings/background-checks/page.tsx` (12 sites), `admin/platform/*`, `apply/status/status-client.tsx`, `app/error.tsx`
  - Do the audit by grepping for `QueryErrorCard`/`safeErrorMessage` and listing what is missing them — **not** by grepping `isError`, which is the check that let T35 nearly ship a quarter done
  - Verify: force a query failure on each converted page; assert `role="alert"` and that no non-allowlisted tRPC code reaches the DOM

## Approved Mockups

| Screen | Mockup path | Direction | Constraints from review |
|---|---|---|---|
| `/app/volunteers`, populated | `~/.gstack/projects/thehashrocket-volunteerready.org/designs/volunteers-roster-20260726/v3-approved.png` | Real app chrome; five-column table in one card; status as its own column with neutral factual wording | No avatars. `Remove` is a quiet outline button, never red, no trash icon. Search + `Export CSV` above the card. `Load more`, never numbered pages. Desktop only — mobile is specified in the Responsive table above, not in this image |

Lineage: three variants → user selected C's layout → status promoted back to its own column per
user direction → two iterations to remove drift (avatars, red `Remove`, numbered pagination).
One generation was discarded outright for producing a purple sidebar and avatar bubbles, both on
DESIGN.md's anti-pattern list. `evolve --screenshot` did **not** reliably honour the source
capture; fidelity came from the written brief.

## Worktree lanes

| Lane | Steps | Depends on |
|---|---|---|
| **A** ✅ | ~~T1 → T2~~ **DONE** (both write `prisma/migrations/`, sequential within the lane) | — |
| **B** | T3, T10, T11, T12, T25, T26, T27, T28, T29, T30, T31, T33 | Lane A + T22 |
| **C** ✅ | ~~T4, T5, T6, T9~~ **DONE** — the gate on enabling the flag for a pilot org | Lane A |
| **D** | T7 | Lane A |
| **E** | T8, T23, T24 | Lane A + D + T22 |
| **F** ✅ | ~~T18, T34~~ **DONE** | — (fully independent, land first) |
| **G** ✅ | ~~T17, T19, T20~~ **DONE** — the roster is loadable in bulk, exportable, and measurable | Lane A + T2 (`OrgVolunteerSource`) |
| **H** | T21 | flag enablement, not code |
| **I** | T16 | Lane A (touches `app/layout.tsx` + `AppShell`) |
| **J** ✅ | ~~T22~~ **DONE** | Lane A — was the shared barrier for B and E; both now unblocked |
| **K** | T32 | Lane A **+ T3 + T12** — T32 edits `staffVolunteerService.ts` (created by T3) and `sendRosterAddedEmail.ts` (created by T12), both Lane B. The earlier "no overlap with B" was wrong |
| **L** | T35 | — (independent; 4 existing pages) |
| ~~M~~ | ~~T36~~ | **deleted** — T36 split to a follow-up PR (eng re-review D2) |

**Execution:** F immediately. A is the barrier. Then **J** (the shared badge component), then B,
C, D, I, L in parallel worktrees. Then E, then K (after T3 and T12), then G.

**Lane B is a queue, not a lane** (eng re-review). It holds twelve tasks totalling ~45h human,
and **eight of them** — T11, T25, T26, T27, T28, T29, T30, T31, T33 — all edit
`src/app/(app)/app/volunteers/`. They cannot run in parallel worktrees with each other; the lane
model buys nothing inside B. It is the critical path:

```
Lane A (11h) ──► J (2h) ──► Lane B (45h, serialized)
                              └─ 8 of 12 tasks in one directory
   critical path ≈ 58h human / ~6h15min CC
   (was ~70h before T36 was split out)
```

Sequence B by dependency, not by task number: **T3 → T11 → T25 → T33 → T27 → T26 → T31 → T28 →
T29 → T30**, with T10 and T12 landable any time after T3. T28 late is deliberate — it restructures
the layout the earlier tasks build, so doing it first means building the desktop table twice.

`/plan-design-review` is complete — see **Design Specification (v1a)** and **Approved Mockups**.
Build T11 and everything in Lanes B and E against that section, not against the prose in Flows.

**New conflict flags.** J is a hard barrier for B and E: both render `VolunteerStatusBadge` and
building it twice is the drift D17 exists to prevent. E and L both touch `shifts/page.tsx` —
L adds the missing `isError` branch, E adds the assign picker and suppression disclosure; land L
first, it is the smaller diff.

**Added by eng re-review:**
- **I and B both edit `app-sidebar.tsx`.** T11 adds the `Volunteers` nav item to `STAFF_NAV`;
  T16 makes that same item conditional on the new `hasVolunteerRoster` prop. Same array, same
  lines, two worktrees, and both also touch `app-sidebar.test.tsx`. Land **T11 before T16**, or
  do both in one worktree — the combined diff is smaller than the merge.
- **I now also edits `shifts/page.tsx`** (gating T24's picker), which puts it in the L → E
  ordering. Land I after E.
- **K is blocked on T3 and T12**, not just Lane A. See the table above.
- **`AuditLog.action` is a plain `String`** (`schema.prisma:218`), not a Prisma enum. So
  `VOLUNTEER_RESTORED` (T26) and `VOLUNTEER_LEFT` (T32) need **no migration** and neither task
  touches Lane A. The reflex on this repo is "new audit action → schema change"; it does not
  apply here.

**Conflict flags:** B and D both touch `server/services/`, different files. C is the only lane
touching `auth.ts`; land dependabot PR #155 (next-auth 4.24.15) before it and run the auth tests
against the new version — #155 changes only `package.json` and `pnpm-lock.yaml`, so there is no
merge conflict, but the behavioral surface T5 and T6 touch does change.

## Success Metrics

- **Primary:** orgs with >= 10 `OrgVolunteer` rows where `source = STAFF_ADDED`,
  `deletedAt IS NULL`, created within 7 days of `Organization.createdAt`.
- **Secondary:** `source = APPLIED` roster growth — how much of the roster arrives organically.
- Staff-assigned shift signups for unclaimed volunteers.
- Pilot conversion: does "send us your spreadsheet" move a founding-shelter conversation from
  "thinking about it" to "yes"? Qualitative.

## Original Open Questions — resolved

1. **`screeningStatus: CLEARED` for staff-added?** Premise was wrong. `ScreeningStatus` has exactly
   three values (`PASS`, `REVIEW`, `FAIL`) and no `CLEARED`. Nothing in the codebase branches on
   it — write-once at submit, display-only across eight UI files. Moot regardless, since roster
   rows are not applications.
2. **Does staff manual attendance exist?** Yes. `shifts.markAttendance` is a `staffProcedure`
   taking an arbitrary `userId`, already wired into two UIs. Only the assign mutation is new.
3. **Cross-org name visibility: accept or override?** Accept, via first-writer-wins. The override
   was scoped three times and kept growing; the per-application variant would not have touched any
   of the affected surfaces, all of which read `User` directly.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | CLEAR | 8 proposals, 7 accepted, 1 cut |
| Codex Review | `/codex review` | Independent 2nd opinion | 2 | ISSUES_FOUND | 13 findings, 12 folded |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 2 | ISSUES_FOUND | run 1: 18 issues; run 2 (post-design): 9 findings, 4 citation errors |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR | score 3/10 → 9/10, 20 decisions |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **CODEX:** two outside-voice passes, 13 findings. Pass 1 (on the design doc) forced email
  canonicalization to a hard prerequisite, widened the display-name retrofit, and extended
  org-relationship auth to credentials and background checks. Pass 2 (on the CEO plan) found the
  CSV route would collapse to session-derived tenancy, that a per-org flag cannot make a sitewide
  marketing claim true, that bulk assign needed new domain behavior rather than UI, and that
  canonicalization had to move below the service layer because `PrismaAdapter` bypasses services.
  One pass-2 finding was stale (it read the pre-inversion email guard).
- **CROSS-MODEL:** Claude and Codex independently converged on missing org-relationship
  authorization for `staffProcedure` endpoints taking naked ids — Claude found `profile`, Codex
  added `credentials`, background checks, and the shift routes. That convergence from different
  search paths is why a systematic sweep is filed as P1 rather than trusting greps. Codex also
  reversed a Claude recommendation outright: the never-write-`User.name` approach was scoped at 1
  surface, then 3, then 8+, and was abandoned for first-writer-wins on the third widening. Claude
  declined one Codex claim: reporting genuinely does work for free over shadow users (four
  implementations verified); only identity surfaces do not.
- **DESIGN:** one pass, 7 sections, 20 decisions, 3/10 → 9/10. Ratings: Info Arch 2→9, States
  1→9, Journey 3→9, AI Slop 2→9, Design System 4→9, Responsive/A11y 1→9, Unresolved 5 surfaced /
  5 resolved. Three findings changed behaviour rather than appearance: assigning an unclaimed
  volunteer silently suppressed their shift reminder with no disclosure anywhere
  (`shift-reminder-service.ts:75`); Security §2 claimed the recipient of the roster-added email
  "can remove the roster link" when no such surface existed in v1a; and the add form's three
  branches needed two of them worded identically, because a distinct message for the
  other-org-`UNCLAIMED` case discloses that another organisation already has that person on its
  roster — a leak §7 never considered. Two estimates were corrected upward against ground truth:
  T16 from 1h to 3h (`isFeatureEnabled()` has zero production callsites and there is no client
  flag read path, so its own verify step could not pass) and T11 from 5h to 7h. 15 tasks added
  (T22-T36), of which T35 and T36 are pre-existing defects elected into the PR rather than filed.
- **MOCKUPS:** 7 generated, 1 approved (`v3-approved.png`). One was discarded for producing a
  purple sidebar and avatar bubbles, both on DESIGN.md's anti-pattern list. Two useful artefacts
  came out of the process: `evolve --screenshot` did not reliably honour the source capture, so
  fidelity had to come from the written brief; and three independent generations, given no
  guidance on the badge, all reached for "Active / Inactive" — evidence that the plan's original
  "Not activated" would be read as volunteer engagement rather than account state. The approved
  wording is "No account yet / Has account".
- **DESIGN.md DIVERGENCE:** line 92 describes a forest-green staff sidebar; `app-shell.tsx:128`
  has no fill at all. Line 68 says 220px; the implementation is 224px. The 56px top bar is
  undocumented. This is why round one of this review's own mockups was wrong, and it will
  mislead the next agent that reads DESIGN.md before a visual decision. Filed as T34.
- **ENG RE-REVIEW (run 2, post-design):** the design review appended 15 tasks but also **edited
  the contract of tasks already cleared**, without changing their numbers. Nine findings, all
  verified against the codebase rather than inferred from the plan. Four are citation errors —
  the plan points at code that does not do what it claims:
  - `orgAnalyticsRepo.ts:174` is `getTopVolunteers(orgId, limit, fromDate)`, a windowed top-N of
    **per-volunteer** hours. T31 sourced its org-total header figure from it. Needs a new
    aggregate; T31 3h → 4h.
  - `getAttendedShiftsForUser(userId)` has **no org filter** (`shiftSignupRepo.ts:53`). T27's
    detail dialog reused it verbatim, leaking every shift a shared volunteer worked for another
    org — the identical class T33 wrote a mandatory `SECURITY:` test for, except the dialog shows
    the rows rather than a count.
  - `getSignupsByShift` selects `{id,name,email,image}` — no `accountState`, so T23 had no data
    source for the badge or the count it specifies.
  - `command.tsx` has **three** consumers, not zero. T24's "first consumer" note invited a novel
    wrapper where `team/page.tsx` is the pattern.

  The structural finding: **the flag gated one page after the feature became four surfaces.** An
  org with `staff_created_volunteers = false` would have found an "Add volunteer" picker in its
  shift dialog over a roster it cannot see. Resolved by extending the gate to T23/T24/T31 while
  leaving T10 (data) and T32 (volunteer self-service) ungated. T16 re-estimated a second time,
  3h → 5h, because `app/layout.tsx` has no `orgId` to resolve the flag against.

  Also: Lane K's "no overlap with B" was false (T32 edits two Lane B files); Lanes I and B
  collide on `app-sidebar.tsx`; Lane B is a 45h serialized queue, not a parallel lane. Two
  scope *reductions* found: `AuditLog.action` is a `String`, so T26 and T32 need no migration.
- **SCOPE (eng re-review D2):** **T36 split to a follow-up PR** and Lane M deleted — 12h on four
  pages no v1a task depends on, at the tail of the critical path, moving the success metric by
  zero. T35 kept: the `shifts/page.tsx` `isError` gap is a real silent failure in the exact file
  Lane E is editing. Critical path ~70h → **~58h human / ~6h15min CC**.
- **VERDICT:** CEO + DESIGN CLEARED; **ENG CLEARED ON RE-REVIEW after 9 findings were folded in.**
  Scope is v1a minus T36; v1b specified and blocked on a named P1. Build Lanes B and E against
  **Design Specification (v1a)**, not the prose in Flows. Land Lane J
  (`VolunteerStatusBadge`) before either. Sequence Lane B by dependency, not task number.

NO UNRESOLVED DECISIONS
