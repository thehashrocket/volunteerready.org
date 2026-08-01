# AGENT_RULES

This document provides strict rules for AI coding agents working in this repository.

These rules exist to prevent architecture drift and accidental design regressions.

---

# 1. Respect Layer Boundaries

Code must follow the project architecture.

Layer responsibilities:

UI
-> tRPC router
-> service
-> repository
-> database

Do not skip layers unless absolutely necessary.

tRPC is the usual first layer but not the only legal one. A Route Handler under
`src/app/api/**` and a maintenance script under `scripts/**` both enter at the
**service** layer, and may additionally read straight from a repository for plain
resolution — `/api/org/[orgId]/roster/csv` and `scripts/import-roster.ts` each call
`findOrgByIdOrSlug()` directly. The rule that does not bend is the write side: **every
write goes through a service**, so audit logging and the guards around it cannot be
skipped. `scripts/import-roster.ts` loads a CSV by calling `addVolunteer()` per row
rather than inserting `OrgVolunteer` rows itself, which is why the `OrgVolunteerBlock`
refusal, the shadow-user branch, first-writer-wins on `User.name` and the audit row are
the same code the add form runs — and why the import service writes no audit rows of its
own. A bulk path that reimplements the insert is exactly how those guards get missed.

One deliberate exception worth knowing, because it looks like a violation: the importer
passes `sendNotification: false` and sends the roster-added emails itself afterwards.
`addVolunteer`'s own send is fire-and-forget behind a `.catch`, which is right for one
coordinator clicking Add and wrong for sixty rows against a rate limiter. Opting out of
a service's side effect to pace it is fine; opting out of its guards is not.

---

# 2. Organization Scope Is Mandatory

VolunteerReady is multi-tenant.

When adding queries or mutations:

- require orgId
- filter records by orgId
- ensure authorization checks use org membership

Failure to enforce org scope is a security bug.

**A table with no `orgId` column is still org-scoped.** `ShiftSignup` is keyed on
`(shiftId, userId)` and the org lives on `Shift`. A `User` row is shared by every
org that person volunteers for — that is the premise of the shadow-user model —
so a read keyed only on `userId` is a cross-tenant read, not an org-scoped one.
Join through the row that owns the org: `where: { userId, shift: { orgId } }`.
Where two surfaces show the same fact at different resolutions (the roster row's
`Shifts` count and the detail dialog's history behind it), share ONE `where`
builder instead of hand-writing the join twice — `attendedShiftWhere()` in
`src/server/repositories/orgVolunteerRepo.ts`, which returns the complete
predicate rather than a fragment to spread, since `{ ...fragment, shift: { … } }`
compiles, typechecks and silently drops the org join. The one deliberately
cross-org read is `getAttendedShiftsForUser()` in `shiftSignupRepo.ts` (a
volunteer's own lifetime hours, platform tenure badges); it must never back a
staff surface.

Company-scoped resources (`CompanyAccount`, `CompanyMember`,
`CompanyNonprofitLink`, ESG reports) follow the same rule with `companyId`
as the tenant boundary. `companyId` must come from the request (URL param
or tRPC input, via the `companyScopedProcedure` factory in
`src/server/trpc/init.ts`) — never from session state. A user's session
tracks one "active" company, but a multi-company user can be viewing a
*different* company's URL; authorizing against the session instead of the
request serves or mutates the wrong tenant. See
`src/server/services/companyAccessService.ts`'s `requireCompanyAccess()`.

**Route Handlers under `/api/org/[orgId]/**` must call `requireOrgAccess()`** in
`src/server/services/orgAccessService.ts` (v0.38.0.0). This is the same rule as the
company paragraph above, with one wrinkle: for tRPC, reading the session's active org
is *correct* — that is what `staffProcedure` and `ctx.orgId` do. It is only wrong for a
URL-scoped route, where the org being asked about is the one in the path and the two
can differ for a multi-org user. So `staffProcedure` cannot be reused here even in
spirit: `requireOrgAccess({ userId, orgId, minRole })` takes `orgId` as a parameter and
re-checks membership, role rank AND org suspension against it. Do not hand-roll the
check in the handler, and do not add a second copy of `roleRank` — it lives in
`src/server/domain/permissions.ts` (it was consolidated there from two private copies
when this guard became the third caller).

Org scope is not only about the rows you read. A `userId` arriving in a
procedure's **input** is untrusted even when the caller is staff: `staffProcedure`
proves the caller is staff somewhere and `ctx.orgId` says where, but neither says
the person named in the input has ever heard of that org. User ids are not secret
(`/v/[userId]` is a public route). Any staff procedure that acts on an
input-supplied `userId` must first call `requireOrgVolunteerRelationship()` in
`src/server/services/orgVolunteerAccessService.ts`, which resolves the
relationship (application, roster row, shift signup, or org membership) or throws
`NOT_FOUND`. Do not widen the accepted-relationship set at a callsite — a
relationship staff can mint unilaterally against a stranger (an invitation, a
credential they are about to issue) authorizes nothing. An `OrgVolunteerBlock`
overrides the whole set except `ORG_MEMBER` and `EXISTING_CREDENTIAL`; see the
volunteer-facing rules below.

That set stays safe only as long as nothing mints those relationships on a
user's behalf. `application` qualifies **because** an anonymous application is
bound to a user only by that user's explicit confirmation
(`claimApplicationForUser()` in
`src/server/repositories/volunteer-applications.ts`, v0.33.1.0). `screener.submit`
is a `publicProcedure` accepting an arbitrary `submittedByEmail`, so orphan
applications are attacker-controllable; its predecessor bound them automatically
by address on every `/app/my-applications` load and thereby handed anyone an
`APPLICATION` edge into a stranger's profile and credentials. If you add another
path that sets `submittedByUserId`, route it through that function or repeat its
`where` — and never relax the email predicate to Prisma's `mode: 'insensitive'`,
which is a matching convenience, not an authorization check.

The one exemption is a write that is already org-scoped by construction:
`removeCredential()` deletes on the `(userId, orgId, type)` compound key, so a
stranger's row cannot match and the delete throws instead. If your write can
*create* a row, it is not exempt — `revokeCredential()` looks like a narrowing
operation but shares `upsertCredential()`, whose create branch would mint a
REVOKED credential on an unrelated account.

The same reasoning runs in reverse on **volunteer-facing** procedures. A
volunteer is not an `OrganizationMember`, so there is no membership to check and
no `ctx.orgId` to scope by — the scoping key is the caller's own `userId`. Three
rules for that case, all of which `profile.leaveOrgRoster` follows:

1. **A tenant id from the client is a claim, never an authorization.** Prefer
   sending a row id and reading the `orgId` back off the matched row. Where that
   is impossible, prove the relationship before writing: `leaveOrgRoster` takes
   an `orgId` as of v0.37.0.0, because an org holding only a
   `VolunteerApplication` or a `ShiftSignup` has no roster row to name and must
   be leavable too — otherwise an org denies the remedy by removing the
   volunteer first and keeps everything the surviving edges authorize. The
   service calls `hasLeavableOrgRelationship()` first, so an arbitrary `orgId`
   cannot mint an `OrgVolunteerBlock` against an org the caller has never
   touched.
2. **`userId` goes inside the Prisma `WHERE` of every statement**, read and
   write alike — never a caller-side comparison after the fact, and never in
   only one of the two. Mutation testing on the org-keyed
   `softDeleteOwnOrgVolunteerByOrg()` confirms neither clause is dead code: drop
   it from one statement and the security test still passes, drop it from both
   and it fails. Do not tidy either one away.
3. **"Not mine" and "not real" must be indistinguishable.** Return null /
   `NOT_FOUND` for both, the same way `requireOrgVolunteerRelationship()` throws
   `NOT_FOUND` rather than `FORBIDDEN`. `leaveOrgRoster` answers `NOT_FOUND` for
   an unknown org, a stranger's org, and an org already left.

Do not "fix" such a procedure by adding a membership check to make it match the
staff-side ones. And do not move volunteer-facing roster procedures onto
`rosterProcedure`: `profile.listMyOrgMemberships` and `profile.leaveOrgRoster`
are deliberately **ungated** by the roster feature flag, because roster rows get
minted regardless of the flag and gating the exit would strand volunteers on
rosters they cannot leave.
`src/server/trpc/routers/profile.leave.test.ts` goes red if you do. Corollary:
grepping `rosterProcedure` does not enumerate every roster surface. **Grep
`isRosterEnabledForOrg` instead** — it lives in `src/server/services/featureFlagService.ts`
and has six callers of four shapes (the `rosterProcedure` middleware, two Server
Components, the roster CSV Route Handler, and two onboarding reads — which hide a
checklist step rather than guarding anything). Note the concierge
importer checks no flag at all, so it matches neither grep; see CLAUDE.md.

One more rule, specific to the org↔volunteer guard. Leaving writes an
`OrgVolunteerBlock`, and `findOrgVolunteerRelationship()` suppresses every kind
except `ORG_MEMBER` and `EXISTING_CREDENTIAL` while one stands. Only the
volunteer lifts it, through `liftOrgVolunteerBlock()`, and only by re-engaging
themselves — applying while signed in, claiming an application, or signing up
for a shift. Do not add a staff-reachable lift path, and do not lift on an
anonymous application: `screener.submit` is a `publicProcedure` accepting an
arbitrary `submittedByEmail`, so an address alone clearing a block would hand
the revocation to anyone who can type it. Any new path that **creates a live
`OrgVolunteer` row, OR acts on one without going through
`requireOrgVolunteerRelationship()`**, must check `findOrgVolunteerBlock()`
first. Phrasing the rule as "creates" alone is not enough — it would miss
`assignVolunteerToShift`, which creates no roster row but reads one directly and
would otherwise schedule and email someone who had revoked the org.

Three creators (`addVolunteer`, `ensureAppliedRosterRow`, `restoreVolunteer`)
plus that one actor make **four refusal points** today. `restoreVolunteer` is the
one to watch: it reads as a state flip rather than a create, and
`restoreOrgVolunteer` matches any row with `deletedAt` set without recording who
deleted it, so a volunteer's own departure is indistinguishable from a staff
removal.

---

# 3. Routers Must Stay Thin

Routers should:

- validate input
- enforce access rules
- call services
- return results

Routers should not contain:

- complex workflows
- large Prisma queries
- business rules

---

# 4. Business Logic Lives in Services

Services orchestrate workflows.

Examples:

- submitVolunteerApplication
- createScreenerQuestion
- updateOrganizationMemberRole

Services may:

- call repositories
- enforce business rules
- write audit logs

---

# 5. Repositories Are Persistence Only

Repositories should contain:

- Prisma queries
- entity fetch/update logic

Repositories should not contain:

- authorization logic
- workflow orchestration
- cross-entity business rules

Raw SQL rule: never compose `Prisma.sql` fragments (via `Prisma.join`, or
conditional `Prisma.sql`/`Prisma.empty`) and interpolate them into a
`$queryRaw` template. Turbopack dev duplicates the generated client's `Sql`
class across module graphs, the `instanceof` check fails, and the fragment is
sent to Postgres as one literal parameter — "invalid input syntax" 500s that
only reproduce under `next dev`. Write a single static template with
NULL-checked optional filters instead (see the "Raw SQL" rule in `CLAUDE.md`
for the preferred sargable patterns).

CSV rule: there is exactly one parser and one writer, in
`src/server/domain/csv.ts` (`parseCsvRecords`, `escapeCsvField`, `toCsvLine`,
`unescapeCsvField`). Never hand-roll `line.split(',')` and never add a second
escaper. A naive split is wrong for the files this product actually receives — a real
volunteer spreadsheet contains `"Smith, Jane"`, and splitting on the comma shifts every
later column left, so the email field arrives holding a first name. Two copies of a
formula-injection guard is also where one of them stops being maintained, which is why
`esg-report.ts` now re-exports `escapeCsvField` rather than keeping its own. There is
still one violation on purpose-not-yet-fixed: `bulk-import-service.parseCsv` (the
applications importer) has its own naive parser, tracked in `docs/TODOS.md` — converting
it is the fix, not a precedent.

---

# 6. Never Access Prisma Directly from UI or Routers

Prisma calls must live inside repositories or server modules.

Do not import Prisma inside:

- React components
- tRPC routers
- UI utilities

---

# 7. Use Explicit Names

Prefer descriptive function names.

Good:

- submitVolunteerApplication
- listOrganizationMembers
- createScreenerQuestion

Bad:

- handleSubmit
- doThing
- processData

---

# 8. Audit Important Actions

If a change affects organization state, consider writing an audit log.

Examples:

- member role changes
- screener updates
- volunteer applications submitted

---

# 9. Prefer Small, Composable Services

Avoid giant services.

Split services when they grow too large or cover unrelated domains.

---

# 10. Write Code for Future Platform Expansion

VolunteerReady will expand beyond screening.

When designing features, consider:

- will this work across multiple organizations?
- should this be reusable later?
- does this belong in a new service?

Build primitives, not hacks.
