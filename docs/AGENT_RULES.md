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

---

# 2. Organization Scope Is Mandatory

VolunteerReady is multi-tenant.

When adding queries or mutations:

- require orgId
- filter records by orgId
- ensure authorization checks use org membership

Failure to enforce org scope is a security bug.

Company-scoped resources (`CompanyAccount`, `CompanyMember`,
`CompanyNonprofitLink`, ESG reports) follow the same rule with `companyId`
as the tenant boundary. `companyId` must come from the request (URL param
or tRPC input, via the `companyScopedProcedure` factory in
`src/server/trpc/init.ts`) — never from session state. A user's session
tracks one "active" company, but a multi-company user can be viewing a
*different* company's URL; authorizing against the session instead of the
request serves or mutates the wrong tenant. See
`src/server/services/companyAccessService.ts`'s `requireCompanyAccess()`.

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
credential they are about to issue) authorizes nothing.

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
