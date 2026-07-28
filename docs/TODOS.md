# TODOS

Deferred work captured during CEO + engineering plan reviews for Phase 6.
Each item includes enough context for a future engineer to pick it up cold.

---

## Deferred from the application-claim ship (`/ship`, 2026-07-27)

Found by the 7-specialist review of the `linkApplicationsToUser()` fix. The two
CRITICALs that review caught (an `ILIKE` wildcard hole and an impersonation
identity split) were fixed in that diff; these are what was left.

**The headline lesson, worth reading before touching any email predicate:**
`mode: 'insensitive'` in Prisma compiles to `ILIKE $1` with the value
interpolated **unescaped**. `_` and `%` become wildcards, and `_` is legal in an
address `zod.email()` accepts. Used on an authorization predicate that is a
hole — verified in Postgres: `'jason.shultz@x' ILIKE 'jason_shultz@x'` is TRUE.
Never use it to compare identities. Three regression tests in
`applicationClaim.integration.test.ts` pin this; all three go red if the
`insensitive` mode is reintroduced.

### [P2] `volunteerDashboardService` still email-matches orphan applications
`src/server/services/volunteerDashboardService.ts:57` and `:135` both do
`...(email ? [{ submittedByEmail: email, submittedByUserId: null }] : [])`. The
auto-*bind* is gone but the auto-*display* is not: an attacker-planted public
application still shows on the victim's dashboard as their own pending
application and still steers their recommended-opportunities query toward the
attacker's org. It mints no `APPLICATION` edge, so it is spoofing/phishing, not
the original escalation. Also uses case-sensitive equality, so it and the claim
card can now disagree about which rows are "yours". **Fix:** restrict to
`submittedByUserId: userId` and let the claim card be the only path by which an
unlinked application becomes visible. **Effort:** S.

### [P2] The consent card has no decline path
`src/app/(app)/app/my-applications/page.tsx` — the only control is "Add to my
account", and the card's dismissal condition is `claimable.length === 0`, a list
that only shrinks when the user claims. So in exactly the abuse case the feature
exists to stop, the victim sees a permanent un-dismissible card whose sole
button grants the attacker's org access. That is nag-until-yes on a security
decision. **Fix:** add an equal-weight "Not mine" that records a per-user
suppression, plus an audit row (a decline is *evidence* of the planted-
application attack and should be a platform-admin signal). **Effort:** M.

### [P2] `claimApplication` does not handle P2002 on the partial unique index
Migration `20260421151557` creates a partial unique index on
`(submittedByUserId, opportunityId)`. The claim sets the previously-NULL
`submittedByUserId`, so claiming when you already have an active application for
the same opportunity raises P2002. Nothing catches it, so tRPC returns
INTERNAL_SERVER_ERROR and the row is permanently unclaimable — and a 500 is
distinguishable from NOT_FOUND, which defeats the deliberate indistinguishability
of the refusal codes. Reachable because `submitVolunteerApplication` only dedupes
when `submittedByUserId` is set. **Fix:** catch P2002 inside the transaction and
return the same NOT_FOUND. **Effort:** S.

### [P2] Integration tests are the only proof of the email predicate, and nothing runs them
`vitest.config.mts` excludes `src/**/*.integration.test.ts`, and there is no
`.github/workflows` directory at all. Both faster layers mock the predicate away.
So the single check stopping a forged application from minting an authorization
edge is proven only by `pnpm test:integration`, which needs a live Postgres and a
separate command nobody is obliged to run. **Fix:** add a CI workflow with a
Postgres service running all three suites; a `.githooks` pre-push is already
wired (`"prepare": "git config core.hooksPath .githooks"`) if CI is too far off.
**Effort:** S.

### [P3] One more case-sensitivity divergence — and this entry was wrong twice
**Corrected 2026-07-27 by the red-team re-review.** The original text said the
remaining divergences were `volunteerStatusRepo.ts:7` and
`bulk-import-service.ts:126`, fixable by a one-time row backfill. Both halves
were wrong:

- `bulk-import-service.ts` is **fine** — `parseCsv` already lowercases at line 57.
- The problem is **input-side, not row-side**, so backfilling historical rows
  fixes nothing: every future mixed-case request still misses. The reader
  compares a raw user-typed address against canonical storage.

Still open: `volunteerStatusRepo.ts:7`, fed the raw `StatusToken.email` from
`publicStatusService.ts:19` — the public `/apply/status` lookup returns "no
applications" for anyone who typed their address with capitals. **Fix:**
normalize at the input boundary (`.transform(normalizeEmail)` on the token
request), not with a backfill. **Effort:** S.

(The third divergence, `checkAnonymousApplication`, was found and fixed in this
same ship — it had been actively regressed by adding `.transform` to `submit`
without adding it to the sibling reader.)

### [P2] Two pre-existing procedures have the same id/email split just fixed here
Out of this diff, but the identical bug class. `members.ts:77` passes
`ctx.session?.user?.email` alongside `ctx.session?.user?.id` into
`acceptInvitation`, which authorizes on the **email**
(`memberService.ts:98`) but creates the row for the **id**
(`memberService.ts:120`). `company.ts:140` does the same in `acceptInvite`
(`companyService.ts:308`). Under impersonation the email is the real admin's and
the id is the target's, so an admin holding an invitation addressed to
themselves can mint an `OrganizationMember` row for the impersonated victim —
and `ORG_MEMBER` is one of the kinds `requireOrgVolunteerRelationship()` accepts
as authorization. Notable that `company.ts` already knows about impersonation
(it stamps `impersonatedBy` at line 127) and still pairs the two identities
here. **Fix:** resolve the address with `findEmailByUserId(userId)`, exactly as
the claim path now does. **Effort:** S each.

### [P2] The claimable list is still starvable — ordering only narrowed it
**Corrected 2026-07-28.** An earlier version of this entry said oldest-first
ordering meant "a flood cannot bury a genuine row." That overstated it, and the
overstatement is the dangerous part: it reads as closed.

A cap over an attacker-controllable list is starvable from whichever end gets
dropped; ordering only picks the end. `desc` dropped the oldest row, so an
attacker could bury an application that already existed. `asc` drops the newest,
so the attacker must **pre-plant** `CLAIMABLE_LIST_CAP` rows against an address
*before* its owner applies — costlier (needs foreknowledge, ~17 min at
`screener.submit`'s 3/min/IP limit) but not prevented. The
`(submittedByUserId, opportunityId)` partial unique index does not dedupe these,
because NULLs never conflict. A dropped row is unclaimable: deleting
`linkApplicationsToUser()` removed the only other bind path.

The integration test pins only the post-planting direction ("a flood of newer
rows cannot bury an older genuine one"); the pre-plant case is uncovered.

**Fix (ordering cannot do it):** ship the deferred decline path so declining
frees a slot, and/or bound per `(email, orgId)` so one org cannot consume every
slot. Also surface truncation — past the cap a user sees a partial list
presented as complete; return `total`/`hasMore` and render "showing 50 of N".
**Effort:** M.

### [P3] Index `submittedByEmail` before ~250k rows
Now that the query is plain equality it is finally indexable. Measured on a
500k-row synthetic clone: seq scan 16 ms, exact-equality-with-btree 0.043 ms.
Comfortable under ~250k rows, noticeable at 500k. **Fix:** partial index matching
the predicate — `CREATE INDEX CONCURRENTLY "VolunteerApplication_submittedByEmail_unclaimed_idx" ON "VolunteerApplication" ("submittedByEmail") WHERE "submittedByUserId" IS NULL;`
Hand-write it (CONCURRENTLY is the P3006 that breaks `prisma migrate dev` here).
**Effort:** S.

### [P3] `APPLICATION_CLAIMED` carries no `impersonatedBy`
A claim taken while impersonating is attributed solely to the impersonated user.
Every other identity-binding mutation stamps the real admin — `volunteers.ts:69`
has the house helper. Note `ctx.realUserId` is set on EVERY logged-in request, so
it must be compared, not truth-tested. **Effort:** S.

### [P3] Design/a11y polish on the consent card
Deferred from the design specialist: focus is dropped to `<body>` when a claimed
row unmounts; no `aria-live` success announcement; `disabled={claim.isPending}`
greys every row at once with no per-row spinner; `size="sm"` is 32px against a
44px touch target on a phone-first surface; a plain `<Card>` gives a consent
decision the same visual weight as the Status legend (the repo's `warning`
register would fit); and the copy could name what "your volunteer profile"
discloses and that the action has no undo. **Effort:** M total.

### [P3] Small cleanups in the claim path
`listClaimableApplications`'s `.map()` is a no-op identity mapper over the repo's
own `select`. `claimApplicationForUser`'s `tx` defaults to `prisma`, which
undercuts the atomicity invariant its own docstring asserts — a future 3-arg
caller would bind with no audit row and no type error; make it required and have
the integration test pass `prisma` explicitly. **Effort:** S.

---

## Deferred from the unclaimed-identity ship (Lane C, 2026-07-27, v0.33.0.0)

### [P3] A never-claiming volunteer accumulates one `SUPPRESSED_UNCLAIMED` row per cron run

Three of the four opted-in senders — `digest-service.ts`, `reengagement-service.ts`,
`opportunityDigestService.ts` — gate their "mark as sent" bookkeeping on `sendEmail`'s
boolean, and the unclaimed guard returns `false`. The record therefore stays eligible,
which is **deliberate and correct**: the moment the volunteer claims their account, the
digest or nudge they were owed goes out. The cost is that a volunteer who never claims is
re-attempted on every run forever, writing a fresh `SUPPRESSED_UNCLAIMED` row each time.

Two reviewers split on this: one read it as unbounded row growth to fix, the other as the
right retry semantics. Both are right about their half. The retry behaviour should stay;
what's missing is a bound on the observability rows.

`shift-reminder-service.ts` is deliberately different — it stamps `reminderSentAt`
unconditionally (pre-existing), because a reminder is tied to one shift at one time and is
worthless later.

Note this is not new: bounce-suppressed addresses have had the same unbounded retry since
that guard shipped, minus the rows (bounce suppression writes no `EmailEvent`).

**Fix when it matters:** collapse repeats — either skip the write when an identical
`(to, subject, SUPPRESSED_UNCLAIMED)` row already exists within some window, or add a
retention sweep to the existing cleanup cron (`EmailEvent` has `@@index([createdAt])`
already, and nothing prunes that table today — pre-existing). Do **not** "fix" it by
stamping the senders' bookkeeping on suppression; that trades a cheap row for a volunteer
silently never receiving mail they became eligible for. The clean fix is a discriminated
result from `sendEmail` (`sent | suppressed | failed`) so callers can tell "decided not to"
from "try again". **Effort:** S.

**Currently latent, which is why this is P3 and not P2.** `UserDigestPreference` rows are
only created by a user-initiated upsert, and re-engagement iterates `OrganizationMember` —
neither is reachable by a staff-created volunteer, whose edge is an `OrgVolunteer` row. The
one live path is shift reminders, which stamps `reminderSentAt` unconditionally and so
writes exactly one row per suppression. This becomes active the moment a roster volunteer
gains a digest preference or an org membership.

### [P3] `sendEmail` re-fetches a `User` the four cron senders already hold

The unclaimed guard looks the recipient up by email inside `sendEmail`, but all four
opted-in senders already load that user through an included relation. Roughly 15k extra
single-row indexed lookups/day (~0.2 qps), and the `Promise.all` means the added wall-clock
is near zero against the Resend HTTP call that dominates each iteration — so this is a
tidiness item, not a hot spot. Deliberately centralized so a sender cannot forget to guard.

**Fix when it matters:** add an optional `recipientAccountState` hint to `sendEmail` and
have the four senders widen their existing `user: { select: ... }`. Keep the lookup as the
fallback — a sender that omits the hint must still be guarded, not silently unguarded.
Confirmed indexed: the query is a bare column equality against `User_email_key`, not the
functional `lower(btrim(email))` index. **Effort:** S.

### [P2] Sign-in-chain behaviour is asserted against source-reading, not execution

T5/T6 rest on two claims about next-auth 4.24.14 internals: that `events.signIn` fires on
the Google linking path where `events.updateUser` does not, and that
`allowDangerousEmailAccountLinking` links rather than throwing. Both were verified by
reading `node_modules`, and the tests assert our *config object* — so a next-auth upgrade
that changes either would ship green. T15 (`e2e/staff-created-volunteers.spec.ts`) is the
task that closes this; the repo has zero e2e coverage of the real callback chain today
(`e2e/utils/db.ts` mints `Session` rows directly). **Effort:** M, owned by T15.

---

## Deferred from the shift org-scoping ship (`/ship`, 2026-07-27, v0.32.2.0)

Found by five specialists plus a Codex adversarial pass while reviewing the
eleven-IDOR fix. None were in that diff's blast radius; all three are the same
bug class.

**Status: all four are FIXED.** The two shift items and the vitest config
shipped in v0.32.3.0 (#160); the `inviteToApply` race shipped separately in
v0.32.4.0 (#161), because it introduces an advisory lock and warranted its own
review. Two of the four turned out to be wider or more severe than reported —
see the note on each. Original reports are kept in `<details>` blocks rather
than deleted.

- **[P1] ~~`shifts.create` accepts a foreign `opportunityId`~~** ✅ **FIXED** —
  closed by `requireOrgOpportunity()` in `shiftAccessService.ts`, wired into
  `createNewShift`, `updateExistingShift`, `createNewTemplate` and
  `updateExistingTemplate`. Scope was wider than this entry described: the
  relation is also included by `listUpcomingShiftsForOrg`, and
  `updateShiftTemplateSchema` is `createShiftTemplateSchema.partial()`, so
  template **update** carried the same hole on a template the caller genuinely
  owns. `shifts.update` gained a nullable `opportunityId` (previously the link
  was set-once at create and could never be changed or cleared). Covered by
  `services/__tests__/shiftOpportunityScoping.test.ts`.

  <details><summary>Original report</summary>
  `src/server/trpc/routers/shifts.ts:73` takes `opportunityId` from client input
  and `createNewShift` passes it to `createShift` with only `orgId: ctx.orgId`
  stamped. Nothing checks the opportunity belongs to the caller's org. Because
  `listShiftsByOrg` and `getShiftWithSignups` both
  `include: { opportunity: { select: { id: true, title: true } } }`, staff at
  org A can create a shift pointing at org B's opportunity and read B's
  opportunity title back through their own (legitimately scoped) shift list —
  so the v0.32.2.0 guard does not help, because the leaked row is reached by
  relation, not by id. `createShiftTemplateSchema`
  (`src/server/domain/shift.ts:236`) has the same hole, and
  `listTemplatesByOrg` includes the same relation. **Fix:** the same
  `where: { id: opportunityId, orgId }` check `inviteToApply` now uses — or
  `getOpportunity(id, orgId)` from `opportunityRepo`. **Effort:** S.
  </details>

- **[P2] ~~`getCheckinToken` and `selfCheckin` leak shift existence and
  status~~** ✅ **FIXED** — `getCheckinToken` now calls a new
  `requireOwnSignup()` guard before reading any shift state. `selfCheckin` got
  no guard: its check-in token is an HMAC over `(shiftId, userId, window)`, so
  validating it *is* the authorization, and moving that validation ahead of the
  shift lookup closes the leak with zero extra queries. The two procedures are
  authorized by different mechanisms and deliberately do not share a guard.
  `signUpForShift`/`joinWaitlist` were handled differently again — they stay
  open to any authenticated user by product decision, so the fix is an error
  mapping (`mapSignupFailure`) that collapses administrative facts
  (CANCELLED/COMPLETED) into the missing-shift NOT_FOUND while keeping capacity
  and caller-self facts specific, plus a `rateLimitByUser` throttle.
  `cancelSignup`/`leaveWaitlist` had the same ordering bug and were reordered
  too. **Known trade-off:** a legitimate volunteer whose shift is cancelled now
  sees "Shift not found." — unobservable today (no UI calls these), but the
  future self-serve flow should re-derive that message from data the caller is
  already entitled to rather than un-collapsing the mapping. Covered by
  `services/__tests__/shiftSignupDisclosure.test.ts` and new ordering tests in
  `routers/shifts.access.test.ts`.

  <details><summary>Original report</summary>

  `routers/shifts.ts:224` and `:320` load the shift
  by raw client id and branch on status *before* checking the caller has a
  signup, returning distinct messages: NOT_FOUND if missing, then
  `` `Shift is ${status}.` ``, then "QR code is available 24 hours before the
  shift", and only then FORBIDDEN for no signup. Any logged-in volunteer can
  learn, for an arbitrary shift id at an arbitrary org, that it exists, its
  exact status, and whether it starts within 24h. This directly contradicts the
  indistinguishability invariant v0.32.2.0 establishes on the same router.
  `signUpForShift` (`shiftSignupService.ts:76`) leaks the same way and is an
  unrate-limited write that puts the caller's name and email on an arbitrary
  org's roster. **Fix:** move the signup check ahead of the status/timing
  branches. **Effort:** S.
  </details>

- **[P2] ~~`inviteToApply`'s rate limit is not actually atomic~~** ✅ **FIXED** —
  closed by `lockOrgForInviteRateLimit()` in the new
  `repositories/volunteerInvitationRepo.ts`, a per-org
  `pg_advisory_xact_lock` taken as the first statement inside the existing
  transaction. No migration, no retry loop, and the rolling-24h semantics are
  unchanged.

  **The severity was understated.** The report predicted "the 10th and 11th
  invitations". Measured against a real database, five callers racing for one
  remaining slot from a seeded 9 produced **14 invitations against a 10/day
  cap** — every racer read 9 and every racer committed. The integration test
  fails 5 runs out of 5 with the lock removed.

  Two alternatives were considered and rejected, recorded so they are not
  rediscovered: `SERIALIZABLE` needs retry-on-40001 machinery that exists
  nowhere in this repo and can abort invitations that are not over quota at
  all, on predicate overlap alone. A counter table would silently convert the
  rolling 24h window into a calendar-day bucket, gameable with 10 invitations
  at 23:59 and 10 more at 00:01 — there is now a test pinning the rolling
  semantics specifically so that swap cannot be made silently.

  The Upstash limiter is **not** usable for this and never was:
  `src/server/lib/rate-limit.ts` fails **open** when `UPSTASH_REDIS_REST_URL`
  is unset, so it disables itself in dev, CI, and any deploy missing the env
  var. It stays appropriate for burst throttling, which is a different job.

- **[P3] ~~`vitest.integration.config.mts` serialization is silently dead~~**
  ✅ **FIXED** — `poolOptions: { forks: { singleFork: true } }` (removed in
  Vitest 4, so silently ignored) replaced with `fileParallelism: false`.
  Integration files now serialize by construction rather than by every file
  happening to use a distinct table prefix.

---

## Specialist review findings (`/ship`, 2026-07-27, branch thehashrocket/staff-created-volunteers-review)

Five specialists ran against the staff-created-volunteers foundation PR (v0.32.0.0).
Five CRITICALs were found and **all fixed in that PR**; the items below are the
deferred INFORMATIONAL findings, kept because each touches files outside that PR.

### [P2] Nav layout resolves the feature flag against the wrong org on impersonation failure
**Priority:** P2
**Tracked as:** [#157](https://github.com/thehashrocket/volunteerready.org/issues/157)
`app/(app)/app/volunteers/layout.tsx` was fixed in v0.32.0.0 to check
`impersonation.resolutionFailed` before deriving the effective user. Its sibling
`app/(app)/app/layout.tsx` was NOT — on a failed impersonation
`getImpersonationContext()` returns `isImpersonating: false` with
`resolutionFailed: true`, so the layout falls through to `session.user.id` (the
REAL admin), resolves `activeOrgId` from the admin's memberships, and evaluates
`staff_created_volunteers` against the admin's own org.

**Impact is cosmetic, not a leak:** the route guard fails closed independently,
so the nav item may appear but clicking it redirects to `/app`. No cross-tenant
data is served.

**Why it was left:** CLAUDE.md states that read-only nav/banner rendering via
`getImpersonationContext()` may ignore `resolutionFailed`, and `hasOrg` /
`hasCompany` in that same layout already fall through the same way (documented
in the v0.31.0.0 note). v0.32.0.0 added a *feature-flag lookup* to that layout,
which is arguably more than nav rendering — hence this item.

**Fix:** extract the shared `getActiveOrgContext()` helper already filed below
and have it return `resolutionFailed`, so both layouts make one decision instead
of two. Doing it as part of that extraction avoids touching the impersonation
fallback twice.

### [P2] Six hand-rolled copies of the same timing-safe comparison
**Priority:** P2
`timingSafeCompare` now exists, character-for-character, in six places:
`api/resend/webhook/route.ts`, `adapters/background-check/checkr.ts`,
`adapters/background-check/sterling.ts`, `lib/case-study-token.ts`,
`lib/digest-unsubscribe-token.ts`, and `lib/checkin-token.ts`. Six copies of a
security primitive is six chances to omit the length pre-check, and omitting it
makes `timingSafeEqual` **throw** instead of returning false. Extract to
`src/server/lib/crypto-compare.ts` and have all six call it.

### [P2] Active-org resolution now exists in three places with different rules
**Priority:** P2
`auth.ts` (session callback), `trpc/init.ts` (tRPC context) and the new pure
`domain/active-org.ts` each decide "which org is this user acting as". The first
two assign `currentOrgId` unconditionally; the new one additionally verifies the
membership still exists. That divergence is deliberate and documented — it gates
an access decision — but three copies of one rule will drift. Have `init.ts` and
`auth.ts` call `resolveActiveOrgId()`.

### [P2] The two SSR layouts duplicate the whole active-org block
**Priority:** P2
`app/(app)/app/layout.tsx` and `app/(app)/app/volunteers/layout.tsx` repeat the
same ~10 lines (resolve effective user → load membership ids → resolve active
org). One drives nav visibility and the other the route guard, so drift produces
a nav item linking to a page that redirects. Extract
`getActiveOrgContext()` returning `{ effectiveUserId, membershipOrgIds, activeOrgId, resolutionFailed }`.

### [P3] `STAFF_CREATED_VOLUNTEERS_FLAG` is a second literal, not a derivation
**Priority:** P3
The constant exists so the app shell "cannot drift from the registry by typo",
but it is itself a hand-written copy of the same string and typed as plain
`string`. Rename the registry key and it still compiles while `isFeatureEnabled`
silently returns the default. Derive a `FeatureFlagKey` union from
`FEATURE_FLAG_REGISTRY` and type the constant against it.

### [P3] `getAuditActors` duplication and a hand-rolled ctx type
**Priority:** P3
`routers/volunteers.ts` re-implements the `impersonatedBy` expression from
`routers/company.ts` and declares a structural `AuditCtx` instead of the
inferred tRPC ctx, so a ctx shape change would leave it compiling against a
shape that no longer exists. Extract `getAuditActors(ctx)` into `trpc/init.ts`.

### [P3] `membershipRepo.ts` overlaps `orgRepo.ts`
**Priority:** P3
`orgRepo.getFirstOrgForUser()` already queries `OrganizationMember` with the same
`orderBy`. Two repositories now answer "what orgs does this user belong to".
Move `listMembershipOrgIds` into `orgRepo.ts` and delete `membershipRepo.ts`.

### [P3] `TxClient` type alias copy-pasted across repositories
**Priority:** P3
The same non-obvious conditional type over Prisma internals is declared in
`orgRepo.ts`, `orgVolunteerRepo.ts` and others. Declare it once in
`repositories/prisma.ts` so a Prisma major upgrade is a one-line change.

### [P3] Direct Prisma access inside `staffVolunteerService`
**Priority:** P3
CLAUDE.md says repositories own Prisma access, but the service calls
`tx.user.findUnique`, `tx.user.create`, `prisma.organization.findUnique` and
`prisma.user.findUnique` directly while routing everything else through
`orgVolunteerRepo`. ~20 existing services do the same, so this is established
(if non-conforming) practice — the sharper problem is the inconsistency *within
one new file*. Add a `userRepo.ts` accepting `TxClient`.

### [P3] Cross-file comments pin line numbers that will rot
**Priority:** P3
Several new comments reference `file.ts:40-75`-style ranges; at least one was
already off by one when written. Replace with symbol names, which survive edits
and are greppable.

### [P3] `EmailBounceStatus.email` is not canonicalized
**Priority:** P3
Deliberately excluded from the v0.32.0.0 backfill because it is UNIQUE (so
lowercasing needs a merge policy) and because `sendEmail` already looks it up as
`to.toLowerCase()` — mixed-case rows are invisible today either way. Worth doing
with an explicit merge rule (keep the highest `bounceCount`).

### [P3] Roster page: remove-flow and Load-more interactions untested
**Priority:** P3
`page.test.tsx` stubs the remove mutation with a throwaway `mutate` and never
captures `onSuccess`/`onError`, so the Remove click payload, the success toast +
`invalidate()`, the error branch, and the `Load more` click are all uncovered.
Use the callback-capture pattern from `AddVolunteerDialog.test.tsx`.

### [P3] `getRoster` / `getRosterCount` have no direct test
**Priority:** P3
Neither is imported by the service test, and the router test mocks them, so the
row mapping — including the `?? 0` default that makes the Shifts column render
`0` rather than blank — is unproven.

### [P3] `pickSurvivor` untested when 2+ rows are verified
**Priority:** P3
`verified.length === 1 ? verified : group` means a group with two verified rows
falls back to the whole group, so an *unverified* row can win on `createdAt` —
the opposite of the documented rule. Either add the case or document the
behaviour.

## Animal-shelters screenshot copy — found during `/document-release` (2026-07-14)

- **[P4] `/for/animal-shelters`'s first annotation label claims the captured
  screenshot shows an "approved" application status** (`src/app/(public)/for/animal-shelters/page.tsx`,
  the marker at x:72/y:46: `'Every application carries a clear status —
  approved, in review, or rejected — and why.'`), but the 3 applications
  seeded for that capture (`prisma/seed-dev.ts`, linked to `rasDogWalking`)
  are `SUBMITTED`/PASS, `REVIEW`/2 flags, and `REJECTED`/FAIL — no
  `APPROVED`-status row exists, so the badge visible at that marker position
  reads "Submitted", not "Approved" (`ApplicationStatusBadge`'s
  `statusConfig`, `src/components/my-applications/ApplicationStatusBadge.tsx`).
  Found by the Codex cross-model doc review while verifying this release's
  CHANGELOG entry, which had the same inaccuracy — the CHANGELOG wording was
  corrected in v0.29.0.0 (0.29.0.0 doc-sync commit) to say "submitted,
  flagged, and rejected" to match; the page copy itself is unchanged pending
  a product-copy fix (out of scope for a docs-only pass). **Start:** change
  the marker label to "submitted, in review, or rejected" (or recapture with
  a 4th application seeded at `APPROVED` status if showing all four states
  is preferred). **Effort:** XS | **Priority:** P4 | **Depends on:** None.

---

## ~~ESG Dashboard — regression found during `/ship` (2026-07-14)~~ ✅ Root-caused and fixed (2026-07-15, `/investigate`)

- ~~**[P0] BUG: `/app/company/[companyId]/esg` renders the generic volunteer
  app shell instead of the ESG report**~~ — **not an application bug.**
  Root cause: `e2e/esg-dashboard.spec.ts`'s `cleanup()` matched rows by the
  shared literal `__esg_e2e__` prefix and ran unscoped in `afterAll`.
  Playwright's `fullyParallel: true` runs this file's two tests in separate
  worker processes, each with its own `beforeAll`/`afterAll`. When the fast
  "non-member redirected" worker finished first, its `afterAll` cleanup swept
  *every* row matching the prefix — including the slower "loads real
  aggregates" worker's still-in-use session/company/user rows, deleted out
  from under it mid-test. That worker's subsequent requests resolved to an
  unauthenticated/company-less context, which is what rendered as the
  generic volunteer shell. Confirmed via `pid`-tagged logging in `cleanup()`:
  one worker's `afterAll` logged "about to delete 4 users" — 2 more than
  *its own* `beforeAll` had created — proving the cross-worker deletion.
  Reproduced deterministically (5/5) with default parallel workers, 0/5 with
  `--workers=1`, and 0/5 after the fix even at full default parallelism (also
  confirmed clean across all 48 e2e specs in the same run). This also
  explains why earlier sightings (2026-07-12 client-null-crash, 2026-07-13
  "wrong page rendered") looked like different bugs — same race, different
  point mid-render where the yanked session/company data got dereferenced.
  **Fix:** `e2e/esg-dashboard.spec.ts` now tracks the exact
  user/company/org IDs each worker's `beforeAll` creates and scopes
  `afterAll` cleanup to just those IDs (`cleanupIds()`); the shared-prefix
  sweep (`cleanupByPrefix()`) is now used only in `beforeAll`, before this
  run has created anything of its own, and is hardened with a 30-minute
  `createdAt` age cutoff (`STALE_LEFTOVER_MS`) so a late-starting
  `beforeAll` can't match a sibling's freshly created (seconds-old) rows —
  see the residual-risk note below for the narrow case this doesn't fully
  close.
  Validated with 16 consecutive passing runs at default parallel workers
  post-fix (vs. deterministic 3/3 failure pre-fix). **Effort:** S |
  **Priority:** P0 | **Depends on:** None.
  **Residual (accepted risk, adversarial review):** the 30-minute age gate
  narrows the original race to "practically impossible" rather than
  structurally eliminating it — a worker whose `beforeAll → test → afterAll`
  lifecycle somehow exceeded 30 minutes could still theoretically collide
  with `cleanupByPrefix()`. Playwright's default 30s per-test/hook timeout
  (no override in `playwright.config.ts`) already bounds this well below the
  30-minute window, and this race is local-only — `playwright.config.ts` sets
  `workers: 1` in CI, so cross-worker collision is structurally impossible
  there. Not actioned further; would need a per-run marker (e.g. a `runId`
  column) to close completely, which is disproportionate to the near-zero
  residual likelihood.

---

## Screenshot pipeline — test coverage gaps found during `/ship` (2026-07-14)

`/ship`'s test coverage audit (81% — above the 80% target) added the one cheap,
high-value regression test (FINDING-001's fix, in `screenshot-section.test.tsx`)
inline. These remaining gaps were lower-severity or non-trivial to test
correctly, so deferred rather than rushed:

- **[P3] `useVariantState`'s priority-gated pre-hydration check is untested**
  — `src/components/annotated-screenshot.tsx`'s `useEffect` that detects an
  image already broken before hydration (`el.complete && naturalWidth === 0`)
  has zero coverage for either branch (fires when `priority` + already-broken;
  stays silent when `!priority`). Non-trivial to test cleanly: by the time
  `render()` returns, the effect has already run, so simulating "broken
  before React attached listeners" needs either a custom ref/mock or
  `Object.defineProperty` tricks on the `<img>` node before commit. Worth
  doing carefully, not rushing.
- **[P3] `/for/animal-shelters` has no dedicated legend/marker e2e assertion**
  — its sibling pages (`/how-it-works`, `/screening`) get a targeted "exactly
  1 visible legend, 3 items" check in `e2e/public-pages.spec.ts`; the
  animal-shelters page only gets the generic image-count check from
  `SCREENSHOT_PAGES`. Mechanical addition, same pattern as the existing
  `how-it-works / screening annotations` describe block.
- **[P4] `seed-dev.ts`'s devOrg rename + new shelter opportunities have no
  automated assertion** outside the manual `pnpm screenshots` pipeline —
  consistent with this repo's existing convention of not unit-testing seed
  scripts, so low priority, but flagging since a future seed refactor could
  silently break the shelter screenshot's content without any test failing.
- **[P4] `/screening`'s alt/caption copy-accuracy fix has no test** — static
  marketing copy, not logic; very low severity.
- **[P4] `e2e/capture.spec.ts`'s variant/manifest-mismatch runtime guard is
  untested** — the `throw new Error(...)` when a scenario declares a `dark`
  variant but the manifest entry has no `darkSrc` is only indirectly
  protected by a static assertion in `marketing-screenshots.test.ts` (found
  by `/ship`'s testing specialist, confidence 5.5/10). Low priority — if the
  static test is ever weakened this is the last line of defense, but
  extracting the src/darkSrc selection into a testable pure helper is a
  larger refactor than the gap justifies today.

---

## Adversarial review findings (`/ship`, 2026-07-21, branch thehashrocket/oauth-logout-opportunities-bug)

Cross-model pass (Claude adversarial subagent + Codex `exec` + Codex structured
`review`, GATE: PASS — no P1s) on the qualification-match-filter feature and the
company/organization redirect fix. One finding fixed immediately; three deferred
as pre-existing or out-of-scope for this PR.

- ~~**Qualification filter failed open on a missing `matchResults` entry**~~ ✅
  **Fixed same-branch (2026-07-21)** — Claude's subagent found that
  `matchResults?.[o.id]?.matchType !== 'NONE'` evaluates `true` (shown, not
  hidden) if an entry is ever missing for an opportunity id. Not currently
  reachable — both server pages (`browse/page.tsx`,
  `opportunities/[orgSlug]/page.tsx`) build `matchResults` from the exact same
  `opportunities` array passed to the component, so every id is guaranteed
  present whenever `hasMatching` is true — but the filter had no defense if
  that invariant is ever broken (pagination, partial re-scoring, a future
  refactor with separate queries). Hardened both `OpportunitiesListing.tsx`
  and `BrowseOpportunities.tsx` to treat a missing entry as unqualified
  (hidden) rather than shown.
- **[P2] Marketplace browse page can show a false "no opportunities match your
  skills" empty state past 200 published opportunities** — Codex adversarial.
  `listAllPublishedOpportunities` (`publicOpportunityRepo.ts`) hard-caps at
  200 rows ("Capped at 200 to prevent SSR OOM... Long-term: move skill-match
  ranking server-side"); `browse/page.tsx` computes matches only for that
  truncated set, and the new default-hide qualification filter then drops
  every `NONE` result client-side. Once the marketplace exceeds 200 published
  opportunities, a volunteer could see an empty state even though older
  qualifying opportunities exist outside the first 200 rows — silent result
  loss, not just a ranking quirk. Root cause predates this PR (the cap
  itself); this PR's filter is what makes the truncation user-visible as a
  wrong "you're not qualified for anything" message instead of just a
  reordering quirk. **Fix:** move skill-match ranking server-side (already
  flagged in-code as the long-term direction) so filtering happens before the
  200-row limit, not after.
- **[P2] `matchResults`/the qualification filter apply to any authenticated
  user with a saved skill profile, not just volunteers** — Codex structured
  review. Staff and company users who also happen to have personal
  `VolunteerSkill` entries (e.g., they're also a volunteer elsewhere) can hit
  `/app/browse` directly (no server-side role gate on that route, only a nav
  visibility check) and see published opportunities disappear based on their
  own irrelevant skill profile. Pre-existing: `matchResults` was already
  computed for any signed-in user with skills before this PR (shown as a
  cosmetic "Skills needed" badge); this PR escalates that to actually hiding
  listings. Properly scoping "volunteer intent" needs a role-model decision
  (there's no clean `isVolunteer` flag distinct from org/company membership)
  — out of scope for this PR. **Fix:** decide whether match-based filtering
  should require the user to have zero org/company memberships (pure
  volunteer), or add an explicit opt-in, before this becomes a bigger problem.
- **Deferred, no change** — Claude's subagent noted that `layout.tsx`'s
  no-org redirect target now depends on `hasCompany`, which — during the
  pre-existing impersonation `resolutionFailed` fallback (a transient DB
  error resolving an impersonation cookie) — reflects the real admin's own
  memberships, not the impersonated target's, since `effectiveUserId` falls
  back to `session.user.id` in that branch. Before this PR the redirect
  target was always `/app/welcome` regardless, so this fallback identity
  quirk was inert; now it can send an impersonating admin to their own
  `/app/company` instead of the target's `/app/welcome`. No data leak or
  cross-tenant exposure (`company/page.tsx` independently fails closed on
  `resolutionFailed`) — worst case is a confusing redirect target for the
  admin, only in the narrow window of a transient resolution failure.
  `resolutionFailed` is documented as ignorable for "pure read-only/nav"
  consumers; this redirect decision sits right at that boundary. Recorded so
  a future pass on `layout.tsx`'s impersonation handling has the context
  rather than re-discovering it.

**Effort:** S–M (per item) | **Priority:** see above | **Depends on:** None.

---

## Adversarial review findings (`/ship`, 2026-07-14)

Cross-model pass (Claude adversarial subagent + Codex `exec`) after PR1-3
landed. One finding fixed immediately (multi-specialist confirmed); one
scope disagreement resolved by explicit user decision; one deferred as low
severity.

- ~~**[P2] `/how-it-works`'s dashboard shot had no dark variant**~~ ✅
  **Completed v0.29.0.0 (2026-07-14)** — both Claude's subagent and Codex independently found
  this. `MARKETING_SCREENSHOTS.dashboard` gained a `darkSrc`
  (`dashboard-dark.png`, captured via the existing scenario pipeline); only
  the `/how-it-works` call site passes it, since the homepage's `priority`
  hero deliberately omits `darkSrc` (Tension 1, eager preload of a hidden
  sibling would double the fetch). Confirmed the manifest-holds-both /
  call-site-opts-in split isn't a structural limitation — Codex's framing
  ("the manifest stores variant data per asset key, not per usage site")
  overstated it; the fix was two lines.
- **Resolved, no change** — Codex flagged (High) that gating the
  pre-hydration "broken before hydration" check on `priority`
  (`annotated-screenshot.tsx`'s `useVariantState`) removed recovery
  protection for the non-priority images that make up most marketing pages.
  User reviewed the tradeoff and chose to keep the `priority` gate: the
  check's `complete && naturalWidth === 0` signature can't distinguish
  "hasn't loaded yet because it's lazy/off-screen" from "attempted and
  failed" for any non-priority image — broadening it would trade a rare,
  narrow-window failure (a lazy image failing between SSR paint and
  hydration) for a common one (ordinary below-the-fold images misreported
  as broken). Recorded here so a future pass doesn't re-litigate this
  without the context.
- **[P4] `createApplicationIfNotExists`'s backfill match has no uniqueness
  guarantee** — `prisma/seed-helpers.ts`'s `findFirst({ orgId,
  submittedByEmail })` has no `orderBy`; if a seeded org ever gets two
  applications from the same email, a rerun of `pnpm seed:dev` could
  backfill `opportunityId` onto the wrong row nondeterministically (Codex,
  Low). Pre-existing lookup shape, not introduced by this fix — no current
  seed caller passes a duplicate `(orgId, email)` pair, so dormant today.
  Fix if a future seed scenario needs multiple applications per email per
  org: add a distinguishing filter (e.g. `opportunityId: null` first, or an
  explicit `orderBy: { createdAt: 'asc' }`).

**Effort:** S (per item) | **Priority:** see above | **Depends on:** None.

---

## Platform Admin Console — follow-ups from Tier 1 ship (2026-04-17)

Deferred from the Tier 1 adversarial review. None block the Tier 1 ship; all
are quality-of-life improvements for admins or observability.

- ~~**[P2] Banner error surfacing**~~ ✅ **Completed v0.23.2.0 (2026-04-21)** — `impersonation-banner.tsx` now branches on `res.ok`; on failure, shows the error text inline and re-enables the button so admins can retry without losing context.
- ~~**[P2] `handleImpersonate` error parsing**~~ ✅ **Completed v0.23.2.0 (2026-04-21)** — `platform/users/[id]/page.tsx` now checks `Content-Type` and extracts the Zod `issues` array (JSON) or reads the plain-text body so admins see why impersonation start failed.
- ~~**[P2] Audit page error state**~~ ✅ **Completed v0.23.2.0 (2026-04-21)** — `platform/audit/page.tsx` now has an `isError` branch rendering a destructive card with the error message.
- ~~**[P2] Org detail error state**~~ ✅ **Completed v0.23.2.0 (2026-04-21)** — `platform/orgs/[id]/page.tsx` now differentiates `isError` (failed load, destructive) from `!data` (not found, muted).
- ~~**[P3] `UserAuditList` shows actor-only rows**~~ ✅ **Completed v0.23.2.1 (2026-04-21)** — `users/[id]/page.tsx` now passes `subjectId: userId` to get bidirectional rows; `auditRepo.ts` uses `OR: [actorId, entityId]`; two new DB indexes added; tRPC Zod schema updated.
- ~~**[P3] Banner reload-on-expiry guard**~~ ✅ **Completed v0.23.2.1 (2026-04-21)** — one-shot `useRef` guard navigates to `/app/admin/platform/users` exactly once on expiry instead of calling `reload()`.
- ~~**[P3] Sensitive-key audit detection → Sentry**~~ ✅ **Completed v0.23.2.1 (2026-04-21)** — `auditQueryService.ts` now calls `Sentry.captureMessage` instead of `console.warn`.
- ~~**[P3] Structured error logging on `resolveImpersonation`**~~ ✅ **Completed v0.23.2.1 (2026-04-21)** — both `init.ts` and `impersonation-context.ts` wrap `resolveImpersonation()` in try/catch, report to Sentry with `IMPERSONATION_RESOLVE_FAILED` tag, and fail open. **Superseded by v0.29.3.0** — the two independent try/catch blocks were consolidated into the shared `resolveEffectiveUserId()` in `impersonation-context.ts`, and the fail-open contract was changed to fail **closed** (`resolutionFailed: true`) since the resolver is now reused by mutation paths. See the P1 item above.
- ~~**[P3] Self-demotion guard**~~ ✅ **Completed v0.23.2.1 (2026-04-21)** — `platformUserService.setPlatformAdmin` throws `BAD_REQUEST` when actor === target and `value` is `false`; UI button is disabled with tooltip.
- **[P3] Require second admin before demotion** —
  `platformUserService.setPlatformAdmin` hard-blocks self-demotion (shipped in
  P3 PR), but an admin can still demote the only other platform admin, leaving the
  platform unmanageable. Before allowing any demotion (self or other), verify at
  least one other `isPlatformAdmin=true` user remains. Query `prisma.user.count({
  where: { isPlatformAdmin: true, id: { not: input.id } } })` and reject with
  `'Cannot revoke the last platform admin. Promote another admin first.'` if zero.

  **Why:** Prevents accidental lockout from any path, not just self-demotion.
  **Effort:** S | **Priority:** P3 | **Depends on:** Self-demotion hard block (P3 PR)

- **[P3] Move sensitive-key audit detection to write sites** —
  `auditQueryService.redactAuditMetadata` currently fires `Sentry.captureMessage`
  on the READ path. Old bad rows in the DB re-alert on every admin browse and on
  every deploy (the `warnedKeys` Set only dedupes per process). The correct fix
  is to validate audit metadata at every `writeAuditLog` / `writeAuditLogTx` call
  site so the signal fires once, at the producer. The `warnedKeys` de-dup on the
  read path can then be removed.

  **Why:** Accurate, low-noise Sentry signals. Current read-path implementation
  acceptable short-term (per-process dedup with documented caveat).
  **Effort:** S | **Priority:** P3 | **Depends on:** Sentry captureMessage shipped (P3 PR)

- **[P3] `PlatformConfig.catalogRevision` singleton** — deferred from Tier 2
  design review. A revision counter bumped on every skill/screener-default
  edit would let clients cache-bust the catalog. Not needed until we see
  actual stale-data bugs in admin UIs or opportunity-matching. Revisit if
  admins report "I edited a skill but the opportunity form still shows the
  old name." Current boot-guard merge-on-version-bump stays untouched.

---

## Platform Admin Console — Tier 2 (Catalog Editors) ✅ Shipped

**Completed:** 2026-04-17

Platform admin UI for editing skill families, skills, and default screener
question templates from the browser — replaces the "edit TS constant →
redeploy" loop. Routes under `/app/admin/platform/catalog/`:

- `/catalog/skills` — skill family + skill CRUD (add, rename, deactivate/reactivate)
- `/catalog/screener-defaults` — default screener question template CRUD

Key design choices:
- **`isTemplate` flag on `ScreenerQuestion`** — templates stored as
  `isTemplate=true` rows on the platform org. All regular screener
  repository functions (`listQuestions`, `getQuestion`, `updateQuestion`,
  `deleteQuestion`, `swapOrders`, …) explicitly scope to
  `isTemplate: false` so platform-org admins cannot edit templates via
  non-catalog routes (bypassing audit).
- **Create-only boot-guard semantics** — `seedCatalog()` +
  `seedPlatformTemplateQuestions()` use `findUnique`/`create` patterns (no
  upserts that overwrite). Admin edits survive version bumps.
- **`seedDefaultQuestions()` reads from DB templates**, not the TS constant.
  The constant (`DEFAULT_SCREENER_QUESTIONS`) is only used by the boot guard
  to seed first-time templates.
- **No retro-push** — editing a template never mutates any existing org's
  screener. Templates apply only when a new org is created.

Follow-ups (all P3):
- Drag-and-drop reordering (currently order is edited numerically).
- Diff view in AuditLog entries for catalog edits (currently `before`/`after`
  JSON blobs; could render side-by-side).
- "Revert to platform default" action on org screener questions when a
  template changes — deferred until admins ask for it.

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

### ~~[P2] CONSIDER State Review UI Action~~ ✅ Done

Replaced the generic "Issue Credential" dialog on CONSIDER rows with a dedicated
"Review & Issue" dialog (`ReviewIssueDialog`) that shows the volunteer's name, locks
type to BACKGROUND_CHECK / VERIFIED, and calls the new atomic
`backgroundChecks.issueAndResolve` tRPC procedure. This eliminates the partial-success
trap where credential issuance could succeed but FCRA resolution could fail as separate
client-side mutations. Both operations now run in a single DB transaction.

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
seed data. Ready for integration into public landing pages. *(Set has since
changed — current source of truth is `src/lib/marketing-screenshots.ts`:
shifts.png retired, applications-queue.png added, impact-report.png added and
credentials recaptured in v0.28.0.0 (issue #139), which also made regeneration
deterministic via `pnpm screenshots`.)*

---

### ~~[P2] Public Stories Index Page (/stories)~~ ✅ Completed v0.23.2.0 (2026-04-21)

`src/app/(public)/stories/page.tsx` ships. Queries `listConsentedOrgSummaries()` (single query with `_count` for application volume), renders a grid of org cards with logo/name/count, JSON-LD breadcrumb, empty state, and CTA banner. Route registered in `public-pages.ts` with sitemap config.

**Effort:** S | **Priority:** P2 | **Completed:** v0.23.2.0 (2026-04-21)

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

### [P3] Timezone-Aware Opportunity Digest Delivery

**What:** Switch the weekly marketplace opportunity digest from fixed Monday 8am UTC
to per-user local-time delivery (e.g., Monday 8am in the volunteer's timezone).

**Why:** The 11C Foundation digest ships with a fixed UTC send window because
`UserMarketplacePreference` has no timezone reference (cross-org model, unlike
`UserDigestPreference` which uses `Organization.timezone`). A volunteer in Sydney
currently receives the digest at 6pm Sunday local time, not Monday morning.

**Context:** Depends on Volunteer Profiles (Phase 3/4) landing a `User.timezone`
field. When that ships, add `timezone` to `UserMarketplacePreference` (migration),
populate it from the volunteer's profile on upsert, and update `opportunityDigestService.ts`
to use the same `getTimezonesMatchingHour()` pattern as `digest-service.ts`.

**Pros:** Better delivery timing → higher open rates. Consistent UX with the org digest.
**Cons:** Requires Volunteer Profiles work first; migration to backfill existing rows.

**Effort:** S | **Priority:** P3 | **Depends on:** Volunteer Profiles (Phase 3/4), `User.timezone` field

---

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

**Context:** Would need a multi-select UI on the background checks page
(`/app/settings/background-checks`, formerly the credentials page), a batch
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

## Concierge Activation Engine (Phase 12)

### [P3] HMAC Survey Tokens for Feedback Form Authentication

**What:** Replace unauthenticated feedback survey with HMAC-signed tokens embedded in
the email link, so responses are attributable without requiring login.

**Why:** The initial feedback form (Phase 12) skips auth for simplicity with 3 concierge
orgs. As the platform scales beyond concierge, unauthenticated feedback is exploitable
(anyone with the URL can submit fake responses). HMAC tokens tie each response to a
specific org + time window without requiring the org admin to have a VolunteerReady account.

**Context:** Token format: `HMAC-SHA256(orgId + timestamp, SECRET)`. Embed in email link
as query param. Validate on form submission. Expire after 7 days. Reuse pattern from
`src/server/lib/checkin-token.ts` (QR check-in already uses HMAC tokens). The feedback
cron (`/api/cron/org-feedback`) would generate tokens when sending emails. The survey
route (`/screening/feedback`) would validate before accepting submissions.

**Pros:** Attributable responses; prevents spam/fake submissions; no login friction.
**Cons:** Token management complexity; need to handle expired token UX gracefully.

**Effort:** S | **Priority:** P3 | **Depends on:** Concierge feedback cron shipped

---

### ~~[P2] Content Flywheel — Structured Case Study Generation from Concierge Data~~ ✅ Complete

**Completed:** v0.17.1 (2026-03-21)

Full content flywheel: `caseStudyService.ts` aggregates org usage data (applications,
background checks, retention, fill rates, top volunteers, feedback pull quotes) into
`CaseStudyData`. Admin UI at `/app/admin/case-studies` with consent toggle, approval
email, PDF download, markdown copy. Public stories at `/stories/[orgSlug]`. Two-step
HMAC consent flow (GET confirmation page + POST mutation). Testimonial components on
screening landing page. 25 unit tests covering token and domain logic. 7 security
fixes applied during review (consent-on-GET, auto-consent from feedback, XSS, HTML
injection, timingSafeEqual crash, missing env var).

**Effort:** ~~M~~ | **Priority:** ~~P2~~

---

### [P2] Self-Serve Org Signup Flow

**What:** Public signup page where nonprofit admins can create their own org account
without concierge onboarding — the transition from concierge-first to self-serve growth.

**Why:** The concierge model validates demand and refines onboarding, but doesn't scale.
Once the concierge playbook is proven (3 orgs successfully activated), a self-serve
flow unlocks organic growth. The landing page (`/screening`) already attracts traffic;
converting visitors to signups is the next step.

**Context:** Would need: (1) `/signup` route with org name, admin email, org type fields,
(2) email verification flow, (3) automated org provisioning (create Organization + first
OrganizationMember with ADMIN role), (4) guided onboarding wizard (reuse OrgHealthWidget
activation steps), (5) free tier with upgrade path. The concierge onboarding checklist
becomes the self-serve onboarding wizard. Key decision: whether to require email
verification before org creation or after.

**Pros:** Unlocks organic growth; removes founder bottleneck from onboarding.
**Cons:** Requires trust & safety (spam orgs, abuse); support burden increases.

**Effort:** L | **Priority:** P2 | **Depends on:** Concierge playbook validated (3 orgs active), billing integration

---

### [P3] Feedback Form Server-Side Length Validation

**What:** Add max-length validation on the server side for feedback form responses
(currently only client-side `maxLength` on `<Textarea>`).

**Why:** The `submitFeedback` server action in `src/app/(public)/screening/feedback/actions.ts`
accepts arbitrary-length strings. A malicious or accidental submission could store 1MB+ of
text in the `OrgFeedback.responses` JSON field. Safe during concierge (3 trusted orgs) but
must be fixed before self-serve signup or public traffic.

**Context:** Add a `MAX_RESPONSE_LENGTH = 2000` constant. In `actions.ts`, truncate or
reject responses exceeding the limit. The client-side `<Textarea>` already has no explicit
`maxLength` prop — add one to match. Consider Zod schema validation in the server action
for consistency with repo conventions.

**Pros:** Prevents oversized payloads; consistent with Zod-everywhere convention.
**Cons:** Minimal — trivial change.

**Effort:** S | **Priority:** P3 | **Depends on:** Feedback form shipped (done)

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

---

## Dedupe Volunteer Applications

### [P3] Email-Based Dedup for Anonymous Applicants

**What:** Check by email whether an anonymous (unauthenticated) visitor has already applied
to the same opportunity, and show a warning if so.

**Why:** The auth-only dedup (v1) covers most cases since authenticated volunteers have
a `submittedByUserId`. But anonymous visitors can submit duplicate applications with the
same email address, creating extra work for org admins reviewing applications.

**Context:** Deferred from the dedupe-volunteer-apply PR because auth-only dedup covers
the primary use case. Email matching introduces complexity: typos, aliases (user+tag@),
shared emails, and privacy implications (confirming an email exists in the system).
The backend unique constraint is on `(submittedByUserId, opportunityId)` where userId
is NOT NULL, so anonymous duplicates are not blocked at the DB level.

**Pros:** Catches duplicate submissions from unauthenticated repeat visitors.
**Cons:** Privacy risk (email existence confirmation); complexity of email normalization;
edge cases with shared/family email addresses.

**Effort:** S | **Priority:** P3 | **Depends on:** Auth-only dedup implementation (this PR)

---

### ~~[P2] Application Withdrawal / Cancel Flow~~ ✅ Completed v0.23.2.0 (2026-04-21)

Full withdrawal flow shipped: `WITHDRAWN` enum value added, partial unique index updated to exclude both REJECTED and WITHDRAWN, `withdrawVolunteerApplication()` service with status guard (SUBMITTED/REVIEW only), audit log, volunteer email, and org admin in-app notification. `screener.withdrawApplication` tRPC procedure. Withdrawal button + confirmation dialog on My Applications detail page. 17 tests (service unit + component).

**Effort:** S | **Priority:** P2 | **Completed:** v0.23.2.0 (2026-04-21)

---

## Reference Data & Skill Catalog

### [P3] Admin-Extensible Skill Catalog

**What:** Admin UI + API for orgs to create custom skills scoped to their org, extending
the platform-wide skill catalog.

**Why:** Different nonprofits need domain-specific skills (e.g., "Equine Therapy" doesn't
exist in the platform catalog of 13 families / 62 skills). Custom skills unlock org-specific
matching and make the platform feel tailored to each org's domain.

**Context:** The `Skill` model currently has no `orgId` — all skills are platform-global.
Custom skills would need either an `orgId` field on `Skill` (nullable, NULL = platform-wide)
or a separate `OrgSkill` model. The data model decision depends on Phase 3 Matching Engine
design — the engine will heavily consume skills, and the wrong model forces workarounds.
The boot guard PR (`thehashrocket/fix-missing-seed-data`) extracts `SKILL_CATALOG` to
`src/server/domain/reference-data.ts` and adds version tracking via `ReferenceDataMeta`,
which provides the foundation for catalog extensibility.

**Pros:** Higher matching accuracy; orgs feel the platform fits their domain.
**Cons:** Complexity in matching engine (org-scoped vs platform skills); moderation concerns
(inappropriate custom skills); data model decision is blocked by Phase 3 design.

**Effort:** M | **Priority:** P3 | **Depends on:** Phase 3 Matching Engine design decisions

---

## SEO & Discoverability

### [P2] Content Hub / Blog Infrastructure

**What:** A `/blog` or `/resources` section for SEO content targeting searches like "how to
screen volunteers," "volunteer management best practices," and "background check requirements
for nonprofits." This is the standard SaaS playbook for building organic traffic through
topic authority — Google and AI assistants favor sites with a full content ecosystem over
one-off landing pages.

**Why:** VolunteerReady's current public pages are transactional (apply, browse opportunities,
pricing). There's no content that captures top-of-funnel searches — nonprofit staff researching
how to improve their volunteer program. A content hub would position VolunteerReady as the
authoritative source, driving organic traffic that converts to signups.

**Context:** Would need MDX or CMS-backed pages, a listing page with categories, RSS feed,
and an editorial workflow. Consider starting with MDX (static markdown files in the repo)
for simplicity, then migrating to a CMS when volume justifies it.

**Pros:** High long-term organic traffic value; builds topic authority; supports AI discoverability
(GEO); content can be repurposed for social media and email.
**Cons:** Requires ongoing content creation (not just engineering); needs an editorial owner;
initial infrastructure is a product feature, not just an SEO fix.

**Effort:** L | **Priority:** P2 | **Depends on:** Content strategy, editorial owner identified

---

### [P3] Programmatic City/Region Landing Pages

**What:** Location-specific pages like `/volunteer/dallas` or `/volunteer/austin` targeting
"volunteer opportunities in [city]" searches. These would pull from opportunity data to show
location-filtered volunteer listings with city-specific metadata and structured data.

**Why:** Volunteers overwhelmingly search by location ("volunteer opportunities near me",
"volunteer in Dallas"). These searches have high intent and low competition for a platform
like VolunteerReady. Programmatic landing pages capture this long-tail traffic at scale.

**Context:** Requires geographic data on opportunities (city/region fields), enough org
coverage per city to produce useful pages (thin content pages hurt SEO), and a route
structure like `src/app/volunteer/[city]/page.tsx` with `generateStaticParams` from
the opportunity database.

**Pros:** High organic traffic potential; captures volunteer-side searches (currently weak);
scales automatically as more orgs join in each city.
**Cons:** Premature without sufficient data density — pages with <3 opportunities look empty
and may be penalized by Google as thin content; requires geographic normalization.

**Effort:** L | **Priority:** P3 | **Depends on:** >50 orgs across multiple cities; geographic
data on opportunities

---

### [P3] WebSite JSON-LD with SearchAction

**What:** Add `WebSite` JSON-LD schema to the root layout with a `SearchAction` pointing to
a public search endpoint (e.g., `/search?q={query}`).

**Why:** Google uses WebSite schema with SearchAction to power sitelinks search boxes in
search results. This improves discoverability and provides a direct search experience from
Google.

**Blocked by:** No public search endpoint exists yet. Implement this after building a public
search feature (e.g., opportunity search across all orgs).

**Effort:** S | **Priority:** P3 | **Depends on:** Public search endpoint

---

### [P3] Sitemap Index Splitting & Tenant Scoping

**What:** The current sitemap queries all organizations and emits all routes in a single
response. At scale (16k+ orgs), this exceeds the 50,000-URL sitemap limit and risks
timeouts. Additionally, all org slugs are publicly enumerable via the sitemap.

**When to address:** When org count exceeds ~5,000 or when tenant privacy becomes a concern.

**Fix:** Implement sitemap index (`/sitemap.xml` → `/sitemap-static.xml` + `/sitemap-orgs-1.xml`
etc.) with pagination. Consider filtering to orgs with published content only.

**Effort:** S | **Priority:** P3 | **Depends on:** Org count growth

---

## Marketing & Conversion (v0.18+)

### [P2] Founder Demo Video on /screening and Homepage

**What:** Record a 60-90 second Loom-style walkthrough (create org, post opportunity, run
background check) and embed on `/screening` and the homepage. The video placeholder was
removed from `/screening` in the marketing page update PR — re-add the section with the
real embed when the recording is ready.

**Why:** SaaS conversion research (2026) shows founder video is the #1 conversion tool —
80%+ lift on landing pages. A raw, direct-to-camera walkthrough builds trust faster than
any amount of copy.

**Context:** The `/screening` page previously had a video placeholder section (lines 137-151)
showing "Founder demo video — embed URL here." It was removed for being unprofessional.
When a real video exists, re-add the section using the same layout (aspect-video container,
caption below). The homepage could use a similar section after the hero or after the
competitive positioning section.

**Effort:** S (30 min to record, 5 min to embed) | **Priority:** P2 | **Depends on:** Founder recording the video

---

### [P3] G2 and Capterra Review Listings

**What:** Get VolunteerReady listed on G2 and Capterra. Once listed with initial reviews,
embed live review badges on the homepage and `/screening` page.

**Why:** Third-party review platforms are the strongest trust signal for B2B SaaS buyers.
Live review feeds from G2/Capterra embedded on landing pages are a top conversion driver
in 2026.

**Context:** VolunteerReady is not currently listed on any review platform. Getting listed
requires: (1) creating a vendor profile on G2 and Capterra, (2) getting 5-10 initial reviews
from real users, (3) embedding the review badge widget on marketing pages. Both platforms
offer free listing tiers. The embed is typically a `<script>` tag or React component.

**Effort:** M (1 week for listing + first reviews, 5 min to embed) | **Priority:** P3 | **Depends on:** Having real customers to provide reviews

---

## Phase 11 — Deferred Items (from /autoplan review 2026-03-22)

Items deferred from Phase 11 during CEO + Eng review. Original scope was 13 items / 12 PRs.
Revised scope: 7 items / 6 PRs (marketplace foundation + key volunteer experience).
Deferred items become Phase 11B when there are API consumers and PRO customers.

### [P2] Public REST API v1

**What:** REST API with SHA-256 hashed API keys, scoped permissions, 100 req/min rate limit.
Endpoints: opportunities, applications, credentials, shifts, webhooks.
OpenAPI spec via `zod-to-openapi`, Swagger UI at `/api/v1/docs`.

**Why deferred:** No identified API consumers. High maintenance commitment (versioning,
backward compat, docs) for a solo operator. Premature until there's customer demand.

**Codex note:** Write endpoints need idempotency keys or hard conflict semantics to prevent
duplicate side effects from client retries.

**Effort:** L | **Priority:** P2 | **Depends on:** Customer demand for API access

---

### [P2] Outbound Webhooks

**What:** HMAC-SHA256 signed events, initial delivery + retry via waitUntil() + cron sweep.
Admin UI at `/app/settings/webhooks` with delivery health table.

**Why deferred:** Depends on API. High maintenance (delivery monitoring, retry infrastructure).
`waitUntil()` context issue: only available in request context, not arbitrary services.
Retry state machine not fully coherent (1 fast + 4 cron attempts, but 5 intervals specified).

**Effort:** M | **Priority:** P2 | **Depends on:** API v1

---

### ~~[P3] Grant/Funding Tracker~~ — PERMANENTLY REMOVED (2026-03-22)

**Why removed:** Founder has direct experience building a grant matching application.
Grant program APIs vary wildly by state and funder; integrating outside California or
federal programs is prohibitively difficult. Not a fit for this platform. Do not
re-propose without evidence of a standardized grant API ecosystem.

---

### [P3] Volunteer Streaks & Gamification

**What:** `VolunteerStreak` tracking (consecutive weeks with ATTENDED), milestone badge
computation, display on profile and dashboard.

**Why deferred:** Gamification before marketplace critical mass is premature.

**Effort:** S | **Priority:** P3 | **Depends on:** Active volunteer base

---

### [P3] "Bring a Friend" Referral System

**What:** `ReferralLink` with short token, 30-day expiry, landing page, rate limit.

**Why deferred:** Phase 12 already has referral system (`/apply/refer` + referral prompt).
Duplicating with a slightly different model is unnecessary.

**Effort:** S | **Priority:** P3 | **Depends on:** Evaluate if Phase 12 referral is sufficient

---

### [P3] Google Calendar Sync

**What:** "Add to Calendar" links (Google URL + .ics), subscribable `.ics` feed with
hashed token auth.

**Why deferred:** Nice-to-have, not adoption-driving.

**Effort:** S | **Priority:** P3 | **Depends on:** Active volunteer base using shifts

---

## Geo-Targeted Landing Pages (Deferred from CEO Review 2026-04-11)

### ~~[P2] Lead Analytics Dashboard~~ **Completed:** v0.19.0 (2026-04-11)

Built as `/app/admin/leads` with location filtering, total count, and lead detail cards.
Platform admin gated via `platformAdminProcedure`.

---

### [P3] Email Retry Queue for Lead Notifications

**What:** Dead letter table or scheduled reprocess for failed lead notification emails
(both instant response to lead and founder notification).

**Why deferred:** Fire-and-forget with logging is acceptable at zero traffic. Retry
mechanism matters once lead volume makes silent failures costly.

**Context:** Lead capture service uses Nodemailer fire-and-forget. Failures are logged
but not retried. A `FailedEmail` table with a cron reprocess (similar to existing
`org-feedback` cron pattern) would close the gap.

**Effort:** S | **Priority:** P3 | **Depends on:** Lead capture pipeline shipped, observed email failures

---

### [P3] Automated Nonprofit Count Refresh

**What:** Periodic refresh of county nonprofit counts from IRS NTEE data or Census API.
Update `locations.ts` registry or move counts to a DB table with a refresh cron.

**Why deferred:** Hardcoded counts from manual research are fine for 6 pages. Automation
matters if location pages scale beyond Central Valley.

**Context:** Current design uses a TypeScript registry (`src/lib/locations.ts`) with
hardcoded `nonprofitCount` per location. IRS Exempt Organizations Business Master File
(BMF) is the canonical source. Refresh cadence: quarterly would be sufficient.

**Effort:** M | **Priority:** P3 | **Depends on:** Initial location pages validated, decision to scale beyond 6 pages

---

## Design review follow-ups (/design-review, 2026-06-11, branch thehashrocket/design-review)

Nine findings were fixed atomically on the branch (Geist body font, pricing
contrast, undefined token classes, 44px touch targets, Fraunces on apply flow,
slideInLeft keyframes, marketplace empty-state CTA, off-palette colors,
curly quotes). The following were deferred — too broad or needing an owner call:

- **[P2] Arbitrary type sizes** — ~46 instances of `text-[32px]` plus 10px/11px
  one-offs on public pages. 32px isn't in the DESIGN.md scale (nearest: 30/36).
  Sweep to the defined scale tokens.
- **[P2] Card-led app UI** — volunteer dashboard, `/app/welcome`, and platform
  admin compose as stacked/tiled cards instead of layout regions (flagged by
  both Codex and Claude outside voices as the "stacked cards instead of layout"
  rejection). Structural redesign of app entry points.
- **[P3] Fixed-width panels** — admin feedback split view hardcodes 360px
  panels (`admin/feedback/page.tsx`), my-skills hardcodes a 400px popover; not
  mobile-safe.
- **[P3] Hardcoded content widths** — `w-[1040px]` and bespoke max-widths drift
  from the 1120px DESIGN.md content width; consolidate to one container token.
- **[P3] Login copy claim** — "Join thousands of volunteers" on `/login` is an
  unbacked claim at current scale; founder copy decision.

Full report: `~/.gstack/projects/thehashrocket-volunteerready.org/designs/design-audit-20260611/`

## Design review follow-ups (/design-review, 2026-07-12, branch thehashrocket/design-review-v1)

Eleven findings fixed atomically on the branch (five of six marketing product
screenshots recaptured with realistic data — esg.png recaptured as a clean
zero-state pending the ESG query bugfix below — the old ones showed skeleton
states, empty states, a locked paywall, and dev emails; missing
applications-queue.png created; dark-mode calculator card; `<main>` landmarks
on all public pages; Playfair font drift removed; apply-page duplicate
heading; About/Security hero CTAs; stats-bar Fraunces numbers). Deferred:

- ~~**[P0] BUG: ESG dashboard client crash — "Cannot read properties of null
  (reading 'id')"**~~ ✅ **Same root cause as the ESG Dashboard entry above
  (TODOS:~30), fixed 2026-07-15 via `/investigate`.** Not an application
  bug — `e2e/esg-dashboard.spec.ts`'s `afterAll` cleanup matched rows by a
  shared literal prefix and ran unscoped, so a faster parallel worker's
  cleanup could delete a slower worker's still-in-use session/company mid-test.
  This "client null.id crash" and the later "wrong page rendered" sighting
  (2026-07-13/07-14) were the same race manifesting at different points in
  the render depending on exactly when the yank happened — not two separate
  bugs. Fix: cleanup is now scoped to each worker's own created IDs.
- ~~**[P1] BUG: ESG summary query 500s, UI shows it as empty state**~~ ✅
  Fixed (issue #126). Root cause confirmed: `Prisma.join()`/`Prisma.sql`
  fragments interpolated into `$queryRaw` templates lose `Sql` class
  identity across Turbopack dev module graphs and get sent as one literal
  parameter. Both ESG queries rewritten as static NULL-checked templates;
  same latent pattern fixed in `publicOpportunityRepo.searchWithTsvector`.
  Page got real error states (esgQ + companyQ) with retry; exports disabled
  on error. `to` dates now normalized to end-of-day. Verified NOT broken in
  production builds (dev-server-only bug) via authenticated Playwright e2e
  (`e2e/esg-dashboard.spec.ts` — new auth harness seeds a DB session).
  `public/marketing/esg.png` recaptured with real seeded aggregates.
  **Completed:** v0.26.4.0 (2026-07-12)
- **[P2] Nav misroutes in app sidebar** — "ESG Report" pointed to
  `/app/company/[id]/team` (route named "team" rendered the ESG page);
  "Settings" pointed to `/app/credentials`; Company + ESG Report both
  highlighted active (prefix-match). Fixed: route renamed to `/esg`,
  credentials moved to `/app/settings/background-checks`, new settings hub,
  longest-match single-highlight nav. **Completed:** v0.27.0.0 (2026-07-13)
- **[P3] Two-column settings shell when /app/settings outgrows stacked panels** —
  (from /plan-design-review of issue #127, 2026-07-12.) The settings hub ships
  as two stacked panels (Organization profile form + "Access & setup" nav rows)
  per the approved mockup — Codex's outside-voice review argued for a two-column
  shell (form workspace + settings nav rail), overruled because today's content
  is one form and three links. Revisit when the hub exceeds ~6 sections
  (webhooks admin at TODOS:~1064 and notification/billing settings are likely
  growth). Start: `src/app/(app)/app/settings/page.tsx`, approved mockups at
  `~/.gstack/projects/thehashrocket-volunteerready.org/designs/settings-hub-20260712/`.
  **Effort:** M | **Priority:** P3 | **Depends on:** settings hub shipping (issue #127).
- **[P1] Local `pnpm build` fails prerender with React useContext null** (#136) —
  BLOCKED ON UPSTREAM, filed as [vercel/next.js#95741](https://github.com/vercel/next.js/issues/95741)
  (2026-07-13, /investigate). Root cause confirmed: an upstream Next.js 16.x
  Turbopack bug prerendering the internal `/_global-error` page (matches
  vercel/next.js #86178, #84994, #87719 — all closed only for lacking a
  repro, not fixed). The recurring "unique key prop... `<html>`" warning on
  every build is the tell — Turbopack batches routes' root elements
  (including global-error's self-contained `<html>`) into one render pass
  without keys, and the crash lands on whichever route gets scheduled
  adjacent to the broken batch (why the victim page varies by run/branch).
  Ruled out via elimination (each verified with a fresh `pnpm build`): the
  orphaned root-level `instrumentation.ts`/`instrumentation.client.ts`/
  `sentry.client.config.ts` files, `@sentry/nextjs`/`withSentryConfig`
  entirely, stale `.next` cache, Node version mismatch (22.23.1 vs pinned
  24.11), our custom `global-error.tsx`, and a bump to `next@16.2.10`
  (latest 16.2.x). `experimental.cpus: 1` doesn't fix it either — it just
  relocates the crash directly onto `/_global-error`, confirming the bug
  is intrinsic to Next's own error-page prerender. `--webpack` isn't a
  viable workaround: it fails immediately on an unrelated pre-existing bug
  (see the new P3 item below). Vercel builds are unaffected, so this blocks
  only local production-build verification (`/ship`'s build gate runs
  blind). No further action on our side until upstream responds — recheck
  vercel/next.js#95741 periodically. **Effort:** — (upstream) | **Priority:** P1 | **Depends on:** vercel/next.js#95741.
- **[P3] Orphaned root-level Sentry instrumentation files** — (found during
  #136 investigation, 2026-07-13.) `instrumentation.ts`, `instrumentation.client.ts`,
  and `sentry.client.config.ts` at repo root are dead code, leftover from an
  earlier Sentry wizard run — superseded by `src/instrumentation.ts` and
  `src/instrumentation-client.ts`, which are the versions Next actually
  resolves under the project's `src/` layout. Safe to delete; confirmed via
  build testing that removing them changes nothing. **Effort:** S | **Priority:** P3 | **Depends on:** —
- **[P3] `node:crypto` reachable from a client bundle** — (found during #136
  investigation, 2026-07-13, testing `next build --webpack` as a workaround.)
  `src/server/lib/checkin-token.ts` (uses Node's `crypto`) is reachable from
  a client component graph via `src/components/app/qr-checkin-code.tsx` →
  `src/app/(app)/app/my-shifts/page.tsx`. Only surfaces as a hard failure
  under webpack today (Turbopack tolerates it), but it's a real server-only
  boundary violation that should be fixed regardless — e.g. mark
  `checkin-token.ts` with `import 'server-only'` and move token generation
  behind a server action/tRPC call instead of importing it directly into a
  client component's module graph. **Effort:** S | **Priority:** P3 | **Depends on:** —
- **[P3] No `engines.node` pin in package.json** — (found during #136
  investigation, 2026-07-13.) Local shell drifted to Node v22.23.1 despite
  `.nvmrc` pinning `24.11`, with nothing catching the mismatch. Add an
  `engines.node` field (and consider a `preinstall` check) so a version
  drift like this fails loudly instead of silently. **Effort:** S | **Priority:** P3 | **Depends on:** —
- **[P3] OrgSlugHistory permanent namespace lock needs an admin release tool** —
  (from /ship adversarial review of issue #127, 2026-07-13.) Slug history rows
  persist forever and now block BOTH new-org creation (`slugExistsInHistory`)
  and other orgs' renames (foreign-history check) — correct anti-squatting
  defaults, but a malicious org can still permanently retire 3 slugs/day
  (rate limit caps velocity, not accumulation), and platform admins have no
  release/purge tool. Options: history TTL, per-org history cap, or a platform
  admin "release slug" action that deletes history rows. Start:
  `src/server/services/orgService.ts` (checks), `OrgSlugHistory` model.
  **Effort:** M | **Priority:** P3 | **Depends on:** issue #127 shipping.
- **[P3] ESG date filters use UTC day boundaries** — (from /ship red-team
  review of issue #126, 2026-07-12.) Date-only `from`/`to` values parse as
  UTC midnight on every path (page date inputs, CSV/PDF query params), and
  `normalizeESGDateRange` bumps `to` to UTC end-of-day. For a UTC-8 user,
  "To: Jan 31" covers through 3:59pm local Jan 31 — evening local shifts on
  the chosen end day are excluded. Every test pins UTC so nothing catches
  it. Fix: send the raw `YYYY-MM-DD` plus an IANA timezone to the server
  and compute day bounds there, or label the filters/exports as UTC in the
  UI. **Effort:** M | **Priority:** P3 | **Depends on:** deciding whose
  timezone governs a company-wide report (company setting vs viewer).
- ~~**[P2] Company pages: URL scoping vs session scoping mismatch**~~ ✅
  **Completed (2026-07-15)** — new `requireCompanyAccess()` service
  (`src/server/services/companyAccessService.ts`) is the single source of
  truth for company membership/role/plan-tier checks, always keyed off a
  caller-supplied `companyId` (never session state). New input-driven
  `companyScopedProcedure` factory in `src/server/trpc/init.ts` replaced
  the deleted session-based `companyProcedure`/`companyAdminProcedure`/
  `companyPlanTierProcedure`. All 5 `company.ts` router procedures and
  `esgReport.getSummary` migrated to take `companyId` from input; both
  client pages (`company/[companyId]/page.tsx`,
  `company/[companyId]/esg/page.tsx`) read `companyId` via `useParams()`
  and thread it through every query/mutation/export-URL. CSV/PDF export
  routes deduped onto the shared service. `CompanySwitcher.tsx` now
  navigates to the new company's URL on switch (preserving subpath), with
  two additional bugs caught and fixed by adversarial review before ship:
  (1) the switch-navigation regex also matched the bare `/app/company/{id}`
  route incorrectly (`undefined` capture group looked like "no match") and
  (2) the regex separately false-matched the static `/app/company/new`
  route, treating the literal segment "new" as a companyId — both fixed
  with a shared `matchCompanyRoute()` helper and mirrored in
  `app-sidebar.tsx`'s identical `urlCompanyId` pattern. `company/[companyId]/page.tsx`
  also gained `isLoading`/`isError` handling for its two queries (previously
  near-infallible session reads, now real auth-checked network calls that
  can 403) via a new shared `QueryErrorCard`/`safeErrorMessage`
  (`src/components/app/query-error-card.tsx`, extracted from the ESG page's
  existing pattern). Full test coverage added: `companyAccessService.test.ts`,
  `CompanySwitcher.test.tsx`, `company/[companyId]/__tests__/page.test.tsx`,
  `esg/__tests__/page.test.tsx` extended, `app-sidebar.test.tsx` extended,
  and a new multi-company e2e case in `e2e/esg-dashboard.spec.ts`.

- ~~**[P1] Impersonation context doesn't propagate to raw Next.js route
  handlers or the company layout guard**~~ ✅ **Completed v0.29.3.0
  (2026-07-20)** — extracted `resolveEffectiveUserId(realUserId, cookieValue)`
  as a pure function in `impersonation-context.ts` (no `getServerSession`/
  `cookies()` inside it) and threaded it through `createTRPCContext`
  (replacing its inline `resolveImpersonation()` call) plus every raw call
  site: `esg-report/{csv,pdf}/route.ts`, `company/[companyId]/layout.tsx`,
  `company/page.tsx` (also fixes a redirect loop for an impersonated
  non-member — Codex outside-voice finding), `invite/company/[token]/page.tsx`
  (was unconditionally FORBIDDEN under impersonation — checked the real
  admin's email against the invite instead of the target's), and
  `checkr/oauth/callback/route.ts` (CSRF `state` check now resolves the
  target's org, not the admin's). ESG audit logs
  (`employerReportService.ts` + `esg-report.ts` router), the Checkr
  `CHECKR_CONNECTED` audit action, and company-invite-acceptance audit logs
  all gained `impersonatedBy` metadata matching the `org.ts`/`orgService.ts`
  convention (Checkr + invite-accept found missing by a Claude adversarial
  pass and a `codex review` pass during `/ship`, respectively).
  **Also found and fixed during `/ship`'s adversarial review (`codex
  review`, 2 rounds):** `resolveEffectiveUserId()` originally preserved the
  pre-existing (v0.23.2.1) fail-*open* behavior — falling back to the real
  admin's identity when `resolveImpersonation()` throws. That was safe for
  the old read-only consumers but unsafe once reused by mutation paths
  (Checkr connect, invite accept) and read-then-write SSR pages
  (`settings/page.tsx` renders org data, then a separate tRPC mutation
  saves it) — a transient resolution error could seed a save that writes
  to the wrong tenant. Changed to fail **closed**: `resolveEffectiveUserId()`
  now returns `effectiveUserId: null` + `resolutionFailed: true` on a
  thrown resolution error; `getImpersonationContext()` propagates
  `resolutionFailed`; `company/page.tsx` and `settings/page.tsx` explicitly
  check it and refuse to fall back to the admin's own session data.
  `app/layout.tsx`'s banner/nav rendering was deliberately left on the old
  fail-open behavior — no mutation is seeded from its rendered state, so
  read-only degradation is an acceptable, previously-accepted tradeoff.
  44+ new/updated unit tests across `impersonation-context.test.ts` and
  every touched call site's colocated test.
- **[P2] Impersonated actions on a multi-org/multi-company target always
  resolve to the target's *oldest* membership, with no way for the admin
  to pick another one** — (found by both an internal red-team pass and
  `codex exec` adversarial review during the impersonation-context fix
  above, 2026-07-20; NOT introduced by that fix — mirrors a heuristic
  already in `app/layout.tsx` before this change, now extended to two
  additional, more consequential surfaces.) `checkr/oauth/callback/route.ts`
  and `company/page.tsx` resolve the impersonated target's org/company via
  `organizationMember`/`companyMember.findFirst({ orderBy: { createdAt:
  'asc' } })` since there's no session-token-derived "current" org/company
  for a user who isn't actually signed in. Verified this is internally
  consistent (both the OAuth `state` embedding via `ctx.orgId` and the
  callback's verification use the identical heuristic, so the round-trip
  doesn't silently break) and doesn't leak cross-tenant data — but for a
  target who belongs to 2+ orgs/companies, the impersonating admin has no
  way to act on any org/company besides the target's oldest one. Fix would
  need an explicit org/company selector surfaced to the impersonating admin
  (mirroring how ESG export routes take `companyId` from the URL, never
  session state) rather than an implicit "first membership" guess.
  **Effort:** M | **Priority:** P2 | **Depends on:** None.
  **Split via `/plan-eng-review` (2026-07-20):** the `company/page.tsx` +
  `app/(app)/app/layout.tsx` sidebar-link half is ✅ **fixed in this PR** —
  explicit picker via the shared `LinkRowList` component when 2+ company
  memberships exist, plus routing the sidebar's "Company" link to the bare
  `/app/company` picker instead of a guessed company when ambiguous. The
  `checkr/oauth/callback/route.ts`
  half is deferred to its own item below — it touches CSRF `state` validation
  and a DB write (Checkr token persistence), which warrants isolated
  adversarial review rather than riding along with an unrelated UX fix.
- **[P2] Checkr OAuth org-selection for multi-org impersonated targets** —
  (split off the item above via `/plan-eng-review`, 2026-07-20.)
  `src/app/api/checkr/oauth/callback/route.ts:75-101` resolves the
  impersonated target's org via the same "oldest membership"
  `organizationMember.findFirst({ orderBy: { createdAt: 'asc' } })` heuristic,
  but here the guessed org feeds a CSRF `state` validation *and* a subsequent
  DB write (`connectCheckrAccount()` persists the Checkr access token onto
  that `Organization` row). An admin impersonating a target in 2+ orgs can
  never connect Checkr for any org but the target's oldest one. The OAuth
  `state` param is set to `ctx.orgId` at URL-generation time
  (`getCheckrOAuthUrl` tRPC procedure) using the identical heuristic, so the
  round-trip is internally consistent today (doesn't break, doesn't leak
  cross-tenant data) — it's just permanently pinned to one org. **Fix
  direction:** surface an explicit org selection at OAuth-initiation time
  (mirroring how ESG export routes take `companyId` from the URL, never
  session state), validated the same way `state` is today. **Effort:** M |
  **Priority:** P2 | **Depends on:** None — independent of the company-page
  half above.
- **[P3] Generalize `impersonatedBy` audit metadata into `writeAuditLog()`
  itself** — (spun off from the impersonation-context fix above,
  `/plan-eng-review` 2026-07-20.) `org.ts`/`orgService.ts`,
  `employerReportService.ts`, `backgroundCheckService.ts`, and
  `companyService.ts` each now hand-roll `impersonatedBy` into their own
  `metadata` shape independently — four copies of the same
  `...(impersonatedBy ? { impersonatedBy } : {})` pattern as of v0.29.3.0.
  Add `impersonatedBy?: string | null` to `AuditLogInput`
  (`src/server/repositories/auditRepo.ts:17`) and fold it into `metadata`
  once inside `writeAuditLog`/`writeAuditLogTx`, instead of every call site
  reimplementing the same shape. Optional — every existing caller works
  fine without it; this just removes a copy-paste-miss risk for the next
  one. **Effort:** S | **Priority:** P3 | **Depends on:** None.
- ~~**[P2] Banned grid patterns on public pages**~~ ✅ **Completed v0.27.1.0
  (2026-07-13)** — homepage `pillars` + `differentiators` sections
  consolidate into a shared `EditorialList` component (icons dropped from
  pillars); `/for` `audiences` section mirrors the existing
  `locations/page.tsx` link-row pattern (divide-y, alternating stripe,
  hover, ArrowRight) instead of a grid. Design doc:
  `docs/designs/banned-grid-patterns.md`. See below for spun-off follow-ups.
- ~~**[P3] Annotated product imagery for homepage/`/for`**~~ ✅ **Completed
  v0.28.0.0 (2026-07-13)** (issue #139) — homepage `pillars` replaced with 3 annotated
  screenshot rows (numbered gold markers + HTML legend via new
  `src/components/annotated-screenshot.tsx`); `/for/nonprofits`,
  `/for/volunteers`, `/for/employers` screenshots annotated via a new
  `annotations` prop on `ScreenshotSection`. The `/for` index deliberately
  keeps `LinkRowList` (navigation index ≠ content surface — won't-do, per
  eng review). Assets are wired through `src/lib/marketing-screenshots.ts`
  (single source of truth) and regenerated deterministically by
  `pnpm screenshots` (e2e Playwright `capture` project +
  `e2e/capture-scenarios.ts`; 2 new captures: credentials wallet, impact
  report). CI guards: manifest-driven asset-existence test + scrolled
  naturalWidth e2e assertions + 375px mobile pillar test. Spun-off
  follow-ups tracked above (animal-shelters screenshot, dark-mode variants,
  how-it-works/screening annotations).
- ~~**[P3] Annotated screenshots for `/how-it-works` + `/screening`**~~ ✅
  **Completed 2026-07-14** — the two remaining plain `ScreenshotSection`
  callers after #139 got 3 marker/label pairs each, drawn from their own
  screenshot's real UI. `/screening`'s screener.png shares the homepage
  "Background checks" pillar's underlying image but uses distinct copy (FCRA
  workflow framing vs the homepage's broader compliance framing) — no
  conflict, since marker data lives per-page, not baked into the PNG. Also
  fixed `/screening`'s stale alt/caption, which described an "application
  review queue" — screener.png actually shows the Screener Questions config
  UI. `/design-review` ran first (its own blocking precondition) and also
  caught and fixed a real bug in the same component family: the homepage's
  `priority` `dashboard.png` hero shot was invisible on any viewport under
  ~820px tall (`FadeInOnScroll` started it at `opacity:0` and the reveal
  threshold never fired) — fixed by skipping the fade-in wrapper for
  `priority` images. `e2e/public-pages.spec.ts` gained legend/marker
  assertions for both pages.
- ~~**[P3] Dark-mode marketing screenshot variants**~~ ✅ **Completed
  v0.29.0.0 (2026-07-14)** — CSS-only swap (not `<picture>`, not `useTheme()`):
  `AnnotatedScreenshot` renders two `<Image>` elements toggled via Tailwind
  `dark:hidden`/`hidden dark:block`, matching the pre-paint `.dark` class
  `next-themes` already sets — the first `dark:` utility usage in
  `src/app/(public)/**` (which otherwise carries dark mode via CSS tokens
  only, per open issue #131). `MARKETING_SCREENSHOTS` entries gained an
  optional `darkSrc` field; `capture-scenarios.ts` gained a
  `variants: ('light'|'dark')[]` field; the capture runner now calls
  `page.emulateMedia({ colorScheme })` before `page.goto()` per variant.
  Every entry except `dashboard.png`'s homepage usage got a dark variant (the
  `priority`-loaded hero call site stays light-only; `dashboard.png` itself
  later gained a `darkSrc` for its non-priority `/how-it-works` reuse — see
  "Adversarial review findings" below). Error handling: per-variant
  state, hides only the variant whose image fails — achieved by having each
  variant's own wrapper (image + legend together) null itself independently,
  with zero JS theme detection. **Two real bugs caught and fixed during
  implementation, both verified live in a real browser (not just unit
  tests):** (1) the pre-hydration "broken before hydration" check
  (`el.complete && naturalWidth===0`) false-positived on every hidden dark
  variant, since a `display:none` image that never attempted to load reports
  the identical signature as a genuinely broken one — fixed by gating that
  check on `priority` (its only real use case). (2) the CSS visibility class
  was originally applied only to the image frame, not the legend below it —
  both variants' legends rendered simultaneously regardless of theme; fixed
  by moving the class to the shared outer wrapper. `pnpm screenshots`
  regenerated all 7 light+dark pairs against a freshly reset local dev DB
  (a stale DB had accumulated duplicate boot-guard + seed-dev.ts screener
  questions, dirtying the first capture attempt). `e2e/public-pages.spec.ts`
  gained a dark-mode counterpart of the existing image-loaded suite.
- ~~**[P3] Screenshot for `/for/animal-shelters`**~~ ✅ **Completed
  v0.29.0.0 (2026-07-14)** — the last `/for` sub-page without a `ScreenshotSection`.
  Reused `devOrg` instead of seeding a new org from scratch: it already had
  shelter-flavored screener questions (`comfort_reactive_animals`,
  `attest_no_abuse`) and sample applications, just zero opportunities and an
  unusable public-facing name. Renamed its display name (slug unchanged) to
  "Riverside Animal Shelter" and added 2 shelter-flavored opportunities ("Dog
  Walking & Enrichment", "Front Desk & Adoption Support"), linking the 3
  existing sample applications to the first so the captured applications
  queue shows real status/screening variety (Rejected/Fail/1 flag, In
  review/Needs review/2 flags, Submitted/Pass) instead of the opportunity
  column's "—" empty-fallback. New capture scenario + `shelterAdmin` actor
  (`admin@volunteermatch.local`, the only seeded account scoped to a single
  org — no org-switcher clutter in the screenshot) added alongside the other
  7 in the existing light+dark pipeline. 3 markers added to the page,
  positioned to avoid overlapping table text. Added to
  `e2e/public-pages.spec.ts`'s `SCREENSHOT_PAGES` (covered automatically by
  both the light and dark-mode describe blocks). **Known pre-existing,
  unrelated test failure surfaced during verification (resolved 2026-07-15,
  see TODOS:~30):** `e2e/esg-dashboard.spec.ts`'s "loads real aggregates"
  test failed here — the page rendered the generic volunteer app shell
  instead of the company ESG view. Confirmed unrelated to this PR: that spec
  seeds its own fully isolated `__esg_e2e__`-prefixed data and doesn't touch
  `devOrg`/Acme Corp; the failure symptom (wrong page rendered) also didn't
  match the `esgReport.getSummary` 500 the spec was written to catch (issue
  #126, closed). Root cause was a test-isolation race in the spec's own
  cleanup, not application code — see the resolved P0 entry above for the
  full root cause and fix.
- ~~**[P3] Shared link-row component for `/for` + `/locations`**~~ ✅
  **Completed v0.27.3.0 (2026-07-13)** (issue #140) — extracted
  `src/components/link-row-list.tsx` (`LinkRowList`, fixed prop shape,
  `<h2>` headings, `href` as key), consumed by both `for/page.tsx` and
  `locations/page.tsx`. Also added e2e coverage for the `/locations` index
  page's navigation (previously untested) and expanded slug-level smoke
  coverage from 1 to all 6 locations. Raised by Codex during the issue #128
  outside-voice review; deliberately deferred from that PR since
  `/locations` wasn't in scope for a P2 fix.
- ~~**[P2] Eyebrow/kicker inconsistency**~~ ✅ **Completed v0.27.2.0
  (2026-07-13)** — extracted `src/components/eyebrow.tsx` (`as` prop for
  p/h2/dt, `tone` prop for primary/muted) with 30 direct call sites across
  13 files (public pages, apply flow, footer); pages that render through
  `PublicHero`/`LocationHero` (homepage, about, pricing, screening,
  security, search, how-it-works, `/for` + sub-pages, privacy, terms, all
  6 location pages) inherit it automatically (issue #129).
- **[P3] Two hero systems** — PublicHero vs LocationHero (different grids,
  breakpoints, alignment) plus hand-rolled centered heroes on
  stories/locations/opportunities index pages.
- **[P3] Dark-mode coverage on public pages** — theme toggle is exposed
  publicly but public pages have no `dark:` classes; tokens carry most
  surfaces (verified), but hardcoded whites are a per-page risk. Either
  sweep or hide the toggle on public routes.
- **[P3] Pill-radius policy** — `rounded-full px-8` CTAs contradict
  DESIGN.md "md: 8px buttons"; the pills look intentional — recommend
  amending DESIGN.md instead of the buttons.
- **[P3] JSON-LD script-tag console warning** on public pages (FAQ/breadcrumb
  components render <script> inside React trees).

Full report: `~/.gstack/projects/thehashrocket-volunteerready.org/designs/design-audit-20260712/`

## Deferred from the staff-created-volunteers eng review (2026-07-26)

Raised during `/plan-eng-review` of `docs/designs/staff-created-volunteers.md`.
That plan was split into v1a (roster + staff shift assignment + email guard)
and v1b (invite email, `/welcome/[token]`, token lib, claim/decline). Items
below were deliberately kept out of the v1a diff.

- ~~**[P1] `linkApplicationsToUser()` auto-links applications across all orgs
  with no scope**~~ ✅ **FIXED (2026-07-27)** — took the "explicit confirmation"
  branch of the two options below rather than org-scoping, because scoping by
  org breaks the legitimate anonymous-apply-then-sign-up path that
  `screener.submit` exists to serve, and that path is load-bearing for the
  public marketplace. `linkApplicationsToUser()` is deleted; nothing binds an
  orphan application implicitly any more.

  Replaced by `listClaimableApplications()` / `claimApplication()` in
  `my-applications.ts`, backed by `listClaimableApplicationsByEmail()` /
  `claimApplicationForUser()` in `volunteer-applications.ts`, surfaced as an
  "Is this you?" card on `/app/my-applications`. The email predicate lives in
  the repository's `where` clause, not in a caller-side comparison, so passing
  another user's application id matches zero rows instead of binding it;
  `claimApplication` throws `NOT_FOUND` for all three of "already claimed",
  "not yours", and "does not exist" so an id probe learns nothing. Claims write
  an `APPLICATION_CLAIMED` audit row (no migration — `AuditLog.action` is a
  plain `String`).

  Two things fixed in passing: the case mismatch, and the writing read path.

  ⚠️ Corrected — an earlier draft of this entry said "the lookup is now
  case-insensitive." **It is not, and must not be.** That was the intermediate
  version, and making it `mode: 'insensitive'` is the ILIKE wildcard CRITICAL
  described at the top of this file. What actually shipped is **plain equality
  against the canonical form**, made correct from both ends: T1's migration
  backfilled `VolunteerApplication.submittedByEmail` to `lower(btrim(...))`, and
  `screener.submit` / `screener.checkAnonymousApplication` now
  `.transform(normalizeEmail)` on input so no new row can be written dirty. The
  original problem was real — T1's trigger covered `User.email` but not this
  column, so a bare equality would have missed mixed-case submissions — but the
  fix was to canonicalize both sides, not to loosen the predicate.

  And the read path no longer writes: the old code ran an `updateMany` on every
  `/app/my-applications` load.

  Coverage — four files (counts deliberately omitted; they rot on every added
  case): `src/server/services/__tests__/my-applications.claim.test.ts`,
  `src/server/trpc/routers/screener.claim.test.ts` (the suite that pins the
  authorization boundary — that the address is resolved from the session user id
  and never from procedure input),
  `src/app/(app)/app/my-applications/__tests__/claimable-applications.test.tsx`,
  and `src/server/repositories/applicationClaim.integration.test.ts` (real DB —
  the security property is a `where` clause, which mocks cannot prove).

  **Correction to the severity claim below:** the "authorizes a paid background
  check" line was overstated. `backgroundChecks.initiate` requires the *caller*
  to supply the SSN/DOB — see the `pii` object in its zod input
  (`src/server/trpc/routers/background-checks.ts`, cited by symbol rather than
  line so the reference does not rot) — so an attacker without the victim's SSN
  could never reach the Checkr/Sterling call.
  The real escalation was `profile.getOrgVisibleProfile` (a stranger's
  staff-visible volunteer profile) and `credentials.issue`. Still P1, still
  fixed — but noting it so the next audit isn't calibrated off an inflated
  example. Original entry follows.

  - **[P1] `linkApplicationsToUser()` auto-links applications across all orgs
  with no scope** — Codex outside voice. `src/server/services/my-applications.ts:96-107`
  runs `updateMany({ where: { submittedByUserId: null, submittedByEmail: email } })`
  on every sign-in with no `orgId` filter, so any orphaned application matching
  the signing-in address is silently attached, regardless of which org created
  it. Live today, independent of the roster feature. Does not bite v1a because
  the review moved roster membership onto a dedicated `OrgVolunteer` join table
  instead of `VolunteerApplication`, so staff-add no longer produces orphan
  applications. It becomes load-bearing for **v1b**: a coordinator typo plus an
  ordinary magic-link login is exactly the wrong-email scenario Security §1 of
  the design doc worries about, and it happens with no invite involved.
  **Fix:** scope the auto-link to the org whose invite/roster row the user is
  claiming, or require an explicit confirmation step before attaching.
  **Blocks:** v1b. **Effort:** M.

  **SECOND CONSEQUENCE (2026-07-27, found by `/ship` security specialist):** this
  is no longer only a v1b blocker — it is now a live bypass of the
  `requireOrgVolunteerRelationship` guard. `APPLICATION` is an accepted
  relationship, and an application can be forged by someone who is not even
  authenticated: `screener.submit` is a `publicProcedure`
  (`src/server/trpc/routers/screener.ts:111`) accepting an arbitrary
  `submittedByEmail` and storing `submittedByUserId: null`. This unscoped
  `updateMany` then binds that row to whoever owns the address the next time
  they open `/app/my-applications`. So a staff user can plant a public
  application carrying a victim's email against their OWN org, wait, and their
  org acquires an `APPLICATION` edge to that victim — which authorizes a paid
  background check on them.

  Shipped knowingly: the guard is still a strict improvement (these procedures
  had NO check before), the attack needs an insider plus a victim action, and
  the correct fix is here at the root rather than in the guard's relationship
  set. **Do not close this ticket by narrowing the guard** — dropping
  `APPLICATION` would break the applications detail page and every org's real
  volunteers. **Fix:** distinguish "applied while authenticated" from "email
  matched later" (e.g. a `linkedAt` column set by this function, with the
  relationship probe requiring `linkedAt IS NULL`), which closes both this and
  the original v1b blocker.

- ~~**[P1] `shifts.markAttendance` and `shifts.getSignups` are unguarded
  cross-tenant IDORs**~~ ✅ **FIXED v0.32.2.0** — shipped wider than specified.
  The three named procedures were fixed, plus five more of the same class found
  while reading the file: `getById` (leaked the signup roster with names and
  emails) and the four mutations `update` / `cancel` / `complete` / `remove`,
  which accepted `orgId` and spent it only on the audit row — so the write hit
  the victim and was filed under the attacker. `remove` cascades to
  `ShiftSignup`, so it destroyed attendance history. Two more found by the
  `/ship` reviewers in `shiftTemplateService`: `update` and `remove` had the
  identical shape. Eleven total, all now through `requireOrgShift` /
  `requireOrgTemplate` in `src/server/services/shiftAccessService.ts`.
  Router-level `shifts.access.test.ts` pins that `ctx.orgId` (not an
  input-supplied org) reaches each service. Original entry follows.

  - **[P1] `shifts.markAttendance` and `shifts.getSignups` are unguarded
  cross-tenant IDORs** — found by the `/ship` security specialist while
  reviewing the guard fix; the first concrete findings of the systematic sweep
  called for below. Both take a client-supplied `shiftId` and never compare it
  to `ctx.orgId`:
  `getSignups` (`src/server/trpc/routers/shifts.ts:139`) reads another org's
  signup roster; `markAttendance` (`:144`) *writes* ATTENDED/NO_SHOW to another
  org's `ShiftSignup` and stamps the audit row with the victim org's `orgId` but
  the attacker's `actorId`. `shiftSignupService.ts:307` loads the shift and
  checks only that it exists. The sibling `checkinByQr` in the same router DOES
  check `shift.orgId !== ctx.orgId`, so this is an oversight, not a design
  choice. `getWaitlist` (`:211`) likely has the same shape — check it.
  **Fix:** pass `ctx.orgId` into `markAttendance`/`getShiftSignups`/`getWaitlist`
  and throw NOT_FOUND when `shift.orgId !== orgId`, mirroring `checkinByQr`.
  Deliberately kept out of the guard PR to keep one security fix per diff.
  **Effort:** S.

- **[P1] Audit every `staffProcedure` that accepts a naked `userId`** — eng
  review X3. Three procedures were found to take a user id with no check that
  the target has any relationship to the caller's org:
  `profile.getOrgVisibleProfile` (`src/server/trpc/routers/profile.ts:73`),
  `credentials.issue` (`src/server/trpc/routers/credentials.ts:47`), and
  background-check initiate (`src/server/trpc/routers/background-checks.ts:45`).

  **CORRECTION (2026-07-27):** this entry previously read "All three are being
  fixed in the v1a PR via a shared `requireOrgVolunteerRelationship()` helper."
  **They were not.** v0.32.0.0 shipped the roster foundation only; the helper
  did not exist in the tree and all three procedures stayed open. A security
  item recorded as fixed while live is worse than one recorded as open — noting
  the failure mode here so the next audit distrusts "being fixed in" phrasing
  about an unmerged PR. The three named procedures are now genuinely fixed (see
  `orgVolunteerAccessService.ts`), plus a fourth the original entry missed:
  `credentials.revoke`, which routes through the same `upsertCredential` as
  `issue` and so *creates* a REVOKED credential row when none matches — a
  cross-tenant write, visible to the victim because `getCredentialsByUserId` has
  no org filter. `credentials.remove` was checked and is safe by construction
  (`delete` on the compound key including `orgId` → P2025 on a foreign id).
  The systematic sweep below is still open.

  Both reviewers found the original three by grep, not by systematic sweep. Same
  bug class as the v0.29.2.0 company URL-scoping fix and the v0.29.3.0
  impersonation fix, both of which were found reactively. **Fix:** enumerate
  every `staffProcedure` in `src/server/trpc/routers/` whose input contains a
  user/volunteer id and confirm each authorizes against `ctx.orgId` — most
  should now just call `requireOrgVolunteerRelationship()`. **Effort:** M.

- **[P2] Both background-check/credential dialogs take a free-text "Volunteer
  User ID"** — found while fixing the P1 above.
  `src/app/(app)/app/settings/background-checks/page.tsx:211` and `:513` are raw
  `<Input placeholder="cuid…">` fields validated only by `z.string().min(1)`,
  with no org-scoped picker behind them. `requireOrgVolunteerRelationship()` now
  rejects a foreign id server-side, so this is no longer a vulnerability — but
  it is still a form that invites the mistake and whose only failure feedback is
  "Volunteer not found in this organization." **Fix:** replace both with a
  volunteer picker sourced from an org-scoped query. **Depends on:** the
  `/app/volunteers` roster work, which supplies the component to reuse — doing
  it before that means inventing a picker twice. **Effort:** M.

- ~~**[P1] `discovery.inviteToApply` does not scope `opportunityId`**~~
  ✅ **FIXED v0.32.2.0** — `inviteToApply` now resolves the opportunity with
  `where: { id, orgId }` before the rate-limit transaction, throwing NOT_FOUND.
  The guard selects the same fields step 4 needed, so it replaced that fetch
  rather than adding one. `volunteerId` remains deliberately unscoped — the
  cross-org directory is the feature. Original entry follows.

  - **[P1] `discovery.inviteToApply` does not scope `opportunityId` to the
  caller's org** — found by adversarial review of the guard fix.
  `src/server/trpc/routers/discovery.ts:32` is a plain `staffProcedure` taking
  `{ volunteerId, opportunityId }`, and `inviteToApply()`
  (`volunteerDiscoveryService.ts:36`) validates neither against `ctx.orgId`, so
  staff at org A can send an invitation naming org B's opportunity. Separately
  `discovery.searchVolunteers` → `searchPublicProfiles(filters)` takes no
  `orgId` at all — a deliberate cross-org recruiting directory, but it means
  `volunteerId` is an arbitrary stranger by design.

  This was very nearly an escalation path into the new access guard: creating a
  `VolunteerInvitation` would have minted a relationship authorizing a paid
  background check on the invited stranger. Closed from the guard's side by
  excluding `INVITATION` from the relationship set (an invitation is an
  outbound solicitation, not a relationship — the volunteer has not answered
  it). **The `opportunityId` scoping bug is still live and independent of
  that.** **Fix:** validate `opportunityId` belongs to `ctx.orgId`.
  **Effort:** S.

- **[P2] `ORG_VOLUNTEER` is a staff-mintable relationship** — accepted risk,
  recorded so it stays a decision rather than becoming an oversight.
  `volunteers.add` takes an *email*, so staff can roster anyone whose address
  they know and thereby authorize themselves to issue that person credentials or
  run a background check on them. Kept in the relationship set anyway, because
  the roster IS the org's assertion of a relationship — that is the premise of
  the staff-created-volunteer feature, and removing it would make staff-added
  volunteers unschedulable, defeating v1a. Gated per-org behind
  `staff_created_volunteers` today; the exposure arrives when that flag flips.
  **Revisit if:** a stricter, volunteer-initiated-only set (`APPLICATION` /
  `SHIFT_SIGNUP`) is ever warranted specifically for the background-check path,
  whose cost and PII exposure justify more than the profile-read path does.
  **Effort:** M.

- **[P2] No blast-radius audit for rows created before the guard landed** —
  `issueCredentialAndResolveFcra` and the webhook auto-issue path correctly skip
  the guard (both are scoped by `request.orgId` off an existing
  `BackgroundCheckRequest`, which going forward can only be created through the
  guarded `initiateProviderCheck`). But `BackgroundCheckRequest` and
  `VolunteerCredential` rows created during the vulnerable window against
  unrelated users still exist, and those paths will mint a VERIFIED credential
  on them today. **Fix:** a read-only query joining both tables against
  `findOrgVolunteerRelationship`'s criteria to list rows with no authorizing
  edge, then triage. **Effort:** S.

- **[P3] Smaller findings deferred from the `/ship` review of the access guard**
  (2026-07-27). None are security issues; grouped to keep them out of the guard
  PR.
  - `VolunteerApplication` has `@@index([submittedByUserId])` and
    `@@index([orgId, status])` but no `@@index([orgId, submittedByUserId])`.
    That is the guard's first probe and it runs on *every* guarded call, so
    Postgres re-checks `orgId` on each heap tuple. Highly selective already;
    a composite index would make it index-only.
  - `credentials.remove` surfaces a raw Prisma P2025 as INTERNAL_SERVER_ERROR
    for an unrelated `userId`, while its `issue`/`revoke` siblings on the same
    UI now return a clean NOT_FOUND. Catch P2025 and rethrow so all three
    mutations speak one error language.
  - `issueCredentialAndResolveFcra` (`backgroundCheckService.ts:959`) writes a
    CREDENTIAL_ISSUED audit row via `upsertCredential` directly, so that action
    now carries `relationship` on one path and not the other. Stamp it (the
    requestId→orgId check already establishes the edge) or route through
    `issueCredential`.
  - Probe ORDER in `findOrgVolunteerRelationship` puts `APPLICATION` first,
    which is right today but self-invalidating: a staff-created roster volunteer
    has no application by definition, so every guarded call against one pays two
    queries. Re-evaluate swapping `ORG_VOLUNTEER` first once roster adoption
    lands. The sequential-with-short-circuit shape itself is correct — do NOT
    convert to `Promise.all`, which would make every legitimate 1-query accept
    pay 4x to speed up the rejection path.
  - `findOrgVolunteerRelationship` re-implements the live-roster predicate that
    `findLiveOrgVolunteer` already owns in the same file. If liveness ever gains
    a condition, the security guard is the copy that gets missed.
  - CLAUDE.md's Testing Guidelines say unit tests are "colocated with source",
    but ~32 service tests live in `src/server/services/__tests__/`. Record the
    actual rule (services → `__tests__/`, repositories and routers → colocated)
    so it stops being inferred by counting files.
  **Effort:** S each.

- **[P3] The volunteer identity panel swallows query errors** —
  `src/app/(app)/app/applications/[id]/page.tsx:328-345` handles `isLoading` and
  `!profile` but never `isError`; both collapse to `return null`, so a 500 or a
  network failure is indistinguishable from "this volunteer's profile is
  private", and nothing is logged. The comment at `:344` is now stale too — it
  enumerates three null cases and the guard added a fourth. Not a regression
  (the `APPLICATION` probe always matches on this page, which only renders when
  `app.submittedByUserId` is set on an org-scoped application), but this is now
  one of the few places a guard rejection could surface. **Fix:** render
  `QueryErrorCard`. **Effort:** S.

- **[P2] Eight email senders interpolate org-controlled values into HTML
  without escaping; three files carry private `escapeHtml` copies** — eng
  review Q3. Unescaped: `sendInviteToApplyEmail.ts:15-18` (`volunteerName`,
  `orgName`, `opportunityTitle`), `sendInviteEmail.ts:13` (`orgName`, `role`),
  `sendCredentialClaimedEmail.ts:16-23`, `sendCredentialRequestEmail.ts:14-21`,
  `send-billing-emails.ts:23`, `companyService.ts:268`, and both senders in
  `sendFcraEmails.ts`. Duplicate local helpers at `leadCaptureService.ts:6`,
  `share-token-expiry-service.ts:3`, and an inline chain at
  `shiftService.ts:232`, alongside the shared `src/server/lib/html.ts`. Org
  names are org-controlled input, so this is HTML injection into a third
  party's inbox. Deliberately excluded from the v1a diff (eleven unrelated
  files); the new roster-notification sender uses the shared helper so the pile
  does not grow. **Fix:** route every sender through `lib/html.ts`, delete the
  three copies. **Effort:** M.

- **[P3] Suppress notifications at creation for unclaimed users, not only at
  transport** — Codex outside voice. The v1a email guard blocks inside
  `sendEmail()` (`src/server/lib/email.ts:20`), which is the transport layer.
  `Notification` rows are created upstream (`notificationService.ts:42`) and
  the digest cron later mails every row with `emailSentAt = null`
  (`digest-service.ts:85`), so in principle notifications could queue for an
  unclaimed user and be dumped on them after activation. **Verified not
  reachable in v1a:** `digest-service` selects `UserDigestPreference` rows and
  nothing creates one for a shadow user. Becomes reachable the moment v1b or
  any later feature enrols them. **Fix:** gate `Notification` creation on
  `accountState`, or stamp rows created for unclaimed users as intentionally
  skipped. **Depends on:** v1b or any feature giving shadow users a digest
  preference. **Effort:** S.

- **[P3] `shiftSignupService` still lacks tests for `signUpForShift`,
  `cancelSignup`, and waitlist promotion** — eng review T1. The module has no
  test file; `shiftWaitlistService`, `shiftCompletionService`, and
  `checkinService` all have one, making this the outlier. The v1a PR adds tests
  for `assignVolunteerToShift` and backfills `markAttendance` (the two
  functions the roster feature depends on), leaving three untested — including
  waitlist auto-promotion on cancel (`shiftSignupService.ts:194-213`), the
  subtlest logic in the file. **Fix:** finish the module in
  `src/server/services/__tests__/shiftSignupService.test.ts`. **Depends on:**
  the v1a test file existing. **Effort:** S.

## Deferred from the staff-created-volunteers CEO review (2026-07-26)

Raised during `/plan-ceo-review` (SELECTIVE EXPANSION) of the same design doc,
after two adversarial spec-review passes and a second Codex outside voice.

- **[P2] Bulk-select assign volunteers to a shift from the roster** — CEO review
  E2, accepted then cut. Twelve people for a Saturday adoption event is twelve
  trips through the single-assign dialog, which is the ergonomics gap the whole
  roster feature exists to close. Cut because Codex established it is not the
  thin UI wrapper it looked like: `validateSignup` (`src/server/domain/shift.ts:99`)
  only rejects over-capacity signups and never yields a waitlist outcome, and
  `signUpForShift` (`src/server/services/shiftSignupService.ts:59`) only creates
  `CONFIRMED` rows before flipping the shift to `FULL`. Waitlisting is a separate
  explicit user action (`joinWaitlist`). So the promised "9 confirmed, 3
  waitlisted" batch result and a per-batch `allowOverCapacity` flag both require
  new domain behavior, roughly doubling the estimate. The adversarial reviewer
  had independently flagged E2 as the weakest accepted item — an unevidenced
  workflow at five pilot shelters and the only accepted item needing a new UI
  interaction pattern. **Fix:** add a waitlist outcome to the domain layer, then
  build the batch mutation and multi-select UI on top. **Depends on:** v1a's
  `assignVolunteerToShift` (T8). **Effort:** M-L.

- **[P2] Volunteer roster is knowingly partial until v1b** — CEO review D4. E1a
  creates an `OrgVolunteer` row when an approved application already has a
  linked user, and in the sign-in link path. It does **not** create rows for
  anonymous applications (`submittedByUserId = null`), which are the majority
  path: the column is nullable (`prisma/schema.prisma:253`) and
  `bulk-import-service.ts:149` creates email-only rows. Doing so would mean
  minting a shadow `User` from `submittedByEmail` on every approval — a change
  to the semantics of every public application, with no source for
  `displayName` (anonymous applications carry only an email, and
  `DEFAULT_SCREENER_QUESTIONS` has no name question). Split out as E1b.
  **Consequence:** an org with anonymous applicants sees a roster that does not
  include all of its volunteers. Do not describe the roster as complete in UI
  copy or marketing until this closes. **Fix:** ship E1b with v1b, and decide
  whether `displayName` becomes nullable with a render fallback or the default
  screener gains a name question. **Depends on:** v1b. **Effort:** M.

- **[P3] Cross-org name leak accepted via first-writer-wins** — CEO review T1
  reversal. `User.email` is unique, so two orgs adding the same person share one
  `User` row, and `User.name` is a single global field. v1a writes it only when
  currently null, so org B sees whatever org A typed. The stronger fix (never
  write `User.name`; render an org-scoped `OrgVolunteer.displayName` everywhere)
  was scoped three times and grew each time: one surface, then three
  (`shiftSignupRepo.ts:10`, `scan/Scanner.tsx:150`, `orgAnalyticsRepo.ts:192`),
  then eight-plus once Codex added `volunteerCredentialRepo.ts:53`,
  `backgroundCheckRepo.ts:57`, `settings/background-checks/page.tsx:955,1202`,
  and the background-check emails at `backgroundCheckService.ts:615,696`.
  Abandoned on the third widening because the estimate would not converge.
  **Fix, if a customer ever reports it:** add the display-name overlay
  surface-by-surface, starting with the shift roster and the Scanner check-in
  confirmation (the two a coordinator sees daily). **Effort:** L.

## Deferred from the staff-created-volunteers design review (2026-07-26)

`/plan-design-review` on `docs/designs/staff-created-volunteers.md`, 20 decisions,
design completeness 3/10 → 9/10. Two further items (QueryErrorCard migration,
mobile card lists for the four existing staff tables) were elected into the PR
itself as T35 and T36 rather than deferred here.

- **[P2] `shifts/page.tsx` renders raw enum values as user-facing labels** — the
  inline `STATUS_VARIANTS` (`:91-100`) and `ATTENDANCE_VARIANTS` (`:281-287`)
  maps use the enum string directly as the badge label, so a coordinator reads
  `WAITLISTED`, `NO_SHOW` and `COMPLETED` in screaming snake case. One of the two
  maps is declared inside the component body. Every other status in the product
  goes through a `*StatusBadge` component with a `{label, icon, variant}` record
  and human copy — see `ApplicationStatusBadge` ("In review", "Withdrawn"),
  `ScreeningStatusBadge` ("Needs review"), `OpportunityStatusBadge`. Found while
  mapping badge patterns for design decision D17. **Fix:** extract
  `ShiftStatusBadge` and `AttendanceStatusBadge` following the existing three.
  **Why not now:** T24 is already editing this file for the assign picker; a
  parallel refactor of the same lines would conflict. **Depends on:** T24
  landing. **Effort:** S.

- **[P2] No staff-side waitlist when assigning to a full shift** — design
  decision D11 gave staff an over-capacity override but no third option, because
  `signUpForShift` hardcodes `status: 'CONFIRMED'` (`shiftSignupRepo.ts:156`).
  Meanwhile `shiftWaitlistService` and `validateWaitlistJoin` already exist and
  are tested, so a coordinator facing a full shift can break the cap or give up
  while the sensible answer sits unused. Same root cause that cut bulk assign
  (NOT in scope #3). **Fix:** add "Add to waitlist" to the D11 confirm strip,
  which needs a position-ordering decision against volunteer-initiated waitlist
  entries and coverage in the `shiftSignupService` tests. **Depends on:** T8,
  T24. **Effort:** M.

- **[P3] Volunteer detail is a dialog, not a deep-linkable route** — design
  decision D4 chose a dialog matching `ShiftDetailDialog`, which is the right
  call for v1a but cannot be shared between two coordinators, does not survive a
  refresh, and has nowhere to grow when credentials, background-check state and
  notes need a home. `getActiveHref()` already handles child routes correctly, so
  nav highlighting for `/app/volunteers/[id]` is free
  (`app-sidebar.tsx:80-95`). **Fix:** promote the dialog body to a route with
  loading, error and not-found states. **Trigger:** the first time a coordinator
  asks to send someone a link to a volunteer. **Depends on:** T27.
  **Effort:** M.
